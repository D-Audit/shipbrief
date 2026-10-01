import { and, eq, inArray } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db } from "../database/client.js";
import { integrationItems, integrations } from "../database/schema.js";
import { consumeOAuthState, createOAuthState } from "../integrations/oauth-state.js";
import { sourceProviders } from "../integrations/source/providers.js";
import { ProviderRequestError, type CompletedWork, type TrackMode } from "../integrations/source/types.js";
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "../types/domain.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { AppError, badRequest, notConfigured, notFound, upstreamError } from "../utils/errors.js";
import { escapeHtml } from "../utils/html.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { summarizeChanges } from "./ai.service.js";
import { audit } from "./audit.service.js";
import { notifyWorkspace } from "./notification.service.js";
import { createRelease } from "./release.service.js";

type IntegrationRow = typeof integrations.$inferSelect;

const redirectUri = (provider: IntegrationProvider) => `${config.APP_URL}/api/integrations/${provider}/callback`;

function isConfigured(provider: IntegrationProvider) {
  const source = sourceProviders[provider];
  return Boolean(source.clientId && source.clientSecret);
}

/**
 * Code hosts track every commit on the default branch by default — that also
 * covers teams who merge pull requests, since merged work lands as commits —
 * or, if chosen, only merged pull/merge requests. Issue trackers always track
 * completed issues.
 */
const tracksCode = (provider: IntegrationProvider) => provider === "github" || provider === "gitlab";
const trackOf = (row?: IntegrationRow): TrackMode => (row?.config.track === "pull_requests" ? "pull_requests" : "commits");

/** Every provider is listed; unconnected ones are "available" (and flagged if the installation lacks OAuth credentials). */
function toIntegrationDto(provider: IntegrationProvider, row?: IntegrationRow) {
  const source = sourceProviders[provider];
  return {
    id: provider,
    provider,
    name: source.name,
    status: !row ? ("available" as const) : row.status === "connected" ? ("connected" as const) : ("disconnected" as const),
    detail: row?.detail ?? "",
    lastSync: row?.lastSyncAt?.toISOString() ?? null,
    account: row?.status === "connected" ? (row.accountLabel ?? undefined) : undefined,
    lastError: row?.lastError ?? undefined,
    configured: isConfigured(provider),
    targetHint: source.targetHint,
    track: tracksCode(provider) ? trackOf(row) : undefined,
  };
}

export async function listIntegrations(actor: Actor) {
  const rows = await db.select().from(integrations).where(eq(integrations.workspaceId, actor.workspaceId));
  return INTEGRATION_PROVIDERS.map((provider) => toIntegrationDto(provider, rows.find((row) => row.provider === provider)));
}

async function findIntegration(workspaceId: string, provider: IntegrationProvider) {
  const [row] = await db.select().from(integrations).where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, provider))).limit(1);
  return row;
}

/** Step 1 of OAuth: returns the provider URL the browser should visit. */
export async function startConnect(actor: Actor, provider: IntegrationProvider) {
  if (!isConfigured(provider)) {
    throw notConfigured("INTEGRATION_NOT_CONFIGURED", `${sourceProviders[provider].name} isn't configured for this ShipBrief installation yet. An administrator needs to add its OAuth app credentials.`);
  }
  const { state, codeChallenge } = await createOAuthState({ purpose: "integration", provider, userId: actor.userId, workspaceId: actor.workspaceId });
  return { authorizeUrl: sourceProviders[provider].authorizeUrl({ state, redirectUri: redirectUri(provider), codeChallenge }) };
}

/** Step 2 of OAuth: the provider redirects back here. The state binds the callback to the user and workspace that started it. */
export async function completeConnect(provider: IntegrationProvider, input: { code: string; state: string; userId: string | null }) {
  const stored = await consumeOAuthState(input.state, "integration", provider);
  if (!stored || !stored.workspaceId || !stored.userId || stored.userId !== input.userId) {
    throw badRequest("OAUTH_STATE_INVALID", "This connection link expired or belongs to another session. Start again from Integrations.");
  }
  const source = sourceProviders[provider];
  const tokens = await source.exchangeCode({ code: input.code, redirectUri: redirectUri(provider), codeVerifier: stored.codeVerifier ?? "" });
  const account = await source.describeAccount(tokens.accessToken);
  const values = {
    status: "connected" as const,
    accountLabel: account.label,
    config: account.config ?? {},
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    tokenExpiresAt: tokens.expiresAt ?? null,
    scopes: tokens.scopes ?? null,
    lastError: null,
    connectedBy: stored.userId,
  };
  await db
    .insert(integrations)
    .values({ workspaceId: stored.workspaceId, provider, ...values })
    .onConflictDoUpdate({ target: [integrations.workspaceId, integrations.provider], set: values });
  await recordActivity(db, { workspaceId: stored.workspaceId, type: "integration", message: `${source.name} connected (${account.label})`, link: "/app/integrations", actorUserId: stored.userId });
  await audit({ action: "integration.connected", workspaceId: stored.workspaceId, userId: stored.userId, targetType: "integration", targetId: provider });
}

export async function disconnect(actor: Actor, provider: IntegrationProvider) {
  const row = await findIntegration(actor.workspaceId, provider);
  if (!row) throw notFound("INTEGRATION_NOT_FOUND", "That integration isn't connected.");
  // Credentials are deleted, not just flagged, when a workspace disconnects.
  const [updated] = await db
    .update(integrations)
    .set({ status: "disconnected", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null, accountLabel: null, lastError: null })
    .where(eq(integrations.id, row.id))
    .returning();
  await recordActivity(db, { workspaceId: actor.workspaceId, type: "integration", message: `${sourceProviders[provider].name} disconnected`, link: "/app/integrations", actorUserId: actor.userId, actorName: actor.name });
  await audit({ action: "integration.disconnected", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "integration", targetId: provider });
  return toIntegrationDto(provider, updated);
}

export async function updateIntegration(actor: Actor, provider: IntegrationProvider, input: { detail: string; track?: TrackMode }) {
  const row = await findIntegration(actor.workspaceId, provider);
  if (!row) throw notFound("INTEGRATION_NOT_FOUND", "Connect this integration first.");
  const detail = input.detail.trim();
  if (detail && row.status === "connected") await assertTargetExists(row, detail);
  const config = input.track && tracksCode(provider) ? { ...row.config, track: input.track } : row.config;
  const [updated] = await db.update(integrations).set({ detail, config }).where(eq(integrations.id, row.id)).returning();
  return toIntegrationDto(provider, updated);
}

/**
 * Refuses a scope the connection can't see (a typo, the wrong owner, or a repo
 * the account has no access to), suggesting the closest real one by name.
 */
async function assertTargetExists(row: IntegrationRow, target: string) {
  const source = sourceProviders[row.provider];
  let found: boolean;
  let token: string;
  try {
    token = await accessTokenFor(row);
    found = await source.targetExists({ accessToken: token, target, config: row.config });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const rejected = error instanceof ProviderRequestError && (error.status === 401 || error.status === 403);
    throw upstreamError("INTEGRATION_TARGET_CHECK_FAILED", rejected ? `${source.name} rejected the connection. Reconnect it.` : `Couldn't reach ${source.name} to check that. Try again.`);
  }
  if (found) return;

  // Same name under another owner/group is the usual mistake ("ship/app" vs "acme/app").
  const name = target.split("/").at(-1)!.toLowerCase();
  const suggestion = await source
    .listTargets({ accessToken: token, config: row.config })
    .then((targets) => targets.find((t) => t.value.split("/").at(-1)!.toLowerCase() === name)?.value)
    .catch(() => undefined);
  const noun = row.provider === "github" ? "repository" : row.provider === "linear" ? "team" : "project";
  throw badRequest(
    "INTEGRATION_TARGET_NOT_FOUND",
    `${source.name} can't find the ${noun} “${target}”, or this connection can't access it.${suggestion ? ` Did you mean “${suggestion}”?` : ` Choose it from the list instead.`}`,
    suggestion ? { suggestion } : undefined,
  );
}

async function accessTokenFor(row: IntegrationRow) {
  if (!row.accessTokenEnc) throw badRequest("INTEGRATION_NOT_CONNECTED", "Connect this integration before syncing.");
  const source = sourceProviders[row.provider];
  if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    // Not a 401: that status means the ShipBrief session is gone, and the app signs the user out on it.
    if (!row.refreshTokenEnc || !source.refresh) throw badRequest("INTEGRATION_EXPIRED", `The ${source.name} connection expired. Reconnect it.`);
    const tokens = await source.refresh(decryptSecret(row.refreshTokenEnc));
    await db
      .update(integrations)
      .set({
        accessTokenEnc: encryptSecret(tokens.accessToken),
        // Some providers rotate refresh tokens on every use.
        refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : row.refreshTokenEnc,
        tokenExpiresAt: tokens.expiresAt ?? null,
      })
      .where(eq(integrations.id, row.id));
    return tokens.accessToken;
  }
  return decryptSecret(row.accessTokenEnc);
}

/** Repositories / projects / teams the connected account can see, so the scope can be picked instead of typed. */
export async function listTargets(actor: Actor, provider: IntegrationProvider) {
  const row = await findIntegration(actor.workspaceId, provider);
  if (!row || row.status !== "connected") throw badRequest("INTEGRATION_NOT_CONNECTED", "Connect this integration first.");
  const source = sourceProviders[provider];
  try {
    const token = await accessTokenFor(row);
    return await source.listTargets({ accessToken: token, config: row.config });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const rejected = error instanceof ProviderRequestError && (error.status === 401 || error.status === 403);
    logger.warn({ provider, workspaceId: actor.workspaceId, err: error }, "Listing integration targets failed");
    throw upstreamError("INTEGRATION_TARGETS_FAILED", rejected ? `${source.name} rejected the connection. Reconnect it.` : `Couldn't load your ${source.name} list. Try again.`);
  }
}

/**
 * Pulls work completed since the last sync. New items are stored (deduplicated
 * by provider id) and turned into one draft release for the team to review.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back "Sync from date" may reach. */
export const MAX_SYNC_LOOKBACK_DAYS = 90;

/**
 * `options.since` (YYYY-MM-DD) pulls work completed from that date instead of
 * "since the last sync". Already-imported items are skipped either way, so an
 * earlier start date never duplicates a release.
 */
export async function sync(actor: Actor, provider: IntegrationProvider, options: { since?: string } = {}) {
  const row = await findIntegration(actor.workspaceId, provider);
  if (!row || row.status !== "connected") throw badRequest("INTEGRATION_NOT_CONNECTED", "Connect this integration before syncing.");
  const source = sourceProviders[provider];
  let since = row.lastSyncAt ?? new Date(Date.now() - 14 * DAY_MS);
  if (options.since) {
    const chosen = new Date(`${options.since}T00:00:00Z`);
    if (chosen.getTime() > Date.now()) throw badRequest("SYNC_DATE_IN_FUTURE", "Choose today or an earlier date.");
    if (chosen.getTime() < Date.now() - MAX_SYNC_LOOKBACK_DAYS * DAY_MS) {
      throw badRequest("SYNC_DATE_TOO_OLD", `You can sync up to ${MAX_SYNC_LOOKBACK_DAYS} days back.`);
    }
    since = chosen;
  }

  let work: CompletedWork[];
  try {
    const token = await accessTokenFor(row);
    work = await source.listCompletedWork({ accessToken: token, target: row.detail, since, config: row.config, track: trackOf(row) });
  } catch (error) {
    const message = error instanceof ProviderRequestError && (error.status === 401 || error.status === 403)
      ? `${source.name} rejected the connection. Reconnect it.`
      : error instanceof ProviderRequestError && error.status === 404
        ? `${source.name} can't find “${row.detail}”, or this connection can't access it. Choose it again in Manage.`
        : error instanceof Error ? error.message : "Sync failed";
    await db.update(integrations).set({ lastError: message.slice(0, 300), status: error instanceof ProviderRequestError && error.status === 401 ? "error" : row.status }).where(eq(integrations.id, row.id));
    await notifyWorkspace({ workspaceId: actor.workspaceId, setting: "integrationErrors", message: `${source.name} sync failed: ${message.slice(0, 140)}`, link: "/app/integrations" });
    logger.warn({ provider, workspaceId: actor.workspaceId, err: error }, "Integration sync failed");
    if (error instanceof AppError) throw error;
    throw upstreamError("INTEGRATION_SYNC_FAILED", message);
  }

  const inserted = work.length
    ? await db
        .insert(integrationItems)
        .values(work.map((item) => ({ workspaceId: actor.workspaceId, integrationId: row.id, externalId: item.externalId, kind: item.kind, title: item.title, url: item.url ?? null, completedAt: item.completedAt })))
        .onConflictDoNothing()
        .returning({ id: integrationItems.id, externalId: integrationItems.externalId })
    : [];
  const fresh = work.filter((item) => inserted.some((row) => row.externalId === item.externalId));

  if (fresh.length) {
    let draft: { title: string; summary: string; body: string; category: string };
    try {
      const summary = await summarizeChanges(actor, fresh.map((item) => ({ kind: item.kind, title: item.title })));
      draft = { title: summary.title, summary: summary.summary, body: summary.bodyHtml, category: summary.category };
    } catch {
      // Without AI (or if it fails) the draft still lists the real work items — nothing is invented.
      draft = {
        title: fresh.length === 1 ? fresh[0]!.title : `${fresh.length} updates from ${source.name}`,
        summary: "",
        body: `<ul>${fresh.map((item) => `<li>${escapeHtml(item.title)}</li>`).join("")}</ul>`,
        category: "Improvement",
      };
    }
    const release = await createRelease(actor, {
      ...draft,
      sourceRefs: fresh.slice(0, 50).map((item) => ({ id: `${provider}:${item.externalId}`, type: provider, label: item.label, url: item.url })),
    }, { changeNote: `Drafted from ${source.name} sync` });
    await db.update(integrationItems).set({ releaseId: release.id }).where(inArray(integrationItems.id, inserted.map((item) => item.id)));
    const noun = trackOf(row) === "commits" && tracksCode(provider) ? "commit" : provider === "github" ? "merged pull request" : provider === "gitlab" ? "merged merge request" : "completed issue";
    await recordActivity(db, { workspaceId: actor.workspaceId, type: "integration", message: `${source.name} detected ${fresh.length} ${noun}${fresh.length === 1 ? "" : "s"} for “${release.title}”`, link: `/app/releases/${release.id}`, actorName: source.name });
  } else {
    await recordActivity(db, { workspaceId: actor.workspaceId, type: "integration", message: `${source.name} sync completed — nothing new`, link: "/app/integrations", actorUserId: actor.userId, actorName: actor.name });
  }

  const [updated] = await db.update(integrations).set({ lastSyncAt: new Date(), lastError: null, status: "connected" }).where(eq(integrations.id, row.id)).returning();
  return { ...toIntegrationDto(provider, updated), newItems: fresh.length };
}
