import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { db } from "../database/client.js";
import { contacts, inAppReads, releasePublications, releases, workspaces } from "../database/schema.js";
import { decryptSecret, encryptSecret, hmacSha256Hex, randomToken, safeEqual } from "../utils/crypto.js";
import { AppError, badRequest, conflict, notFound, unauthorized } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { upsertContact } from "./audience.service.js";
import { track } from "./events.service.js";
import { getPublicWorkspaceByKey, getWorkspaceRow, publicChangelogUrls } from "./workspace.service.js";

/**
 * The embeddable "What's New" widget. Addressed by the workspace's public key
 * (the widget "project ID"), never by internal ids, and scoped to releases
 * published to the in-app channel. Read state is per visitor.
 */

export async function getWidgetConfig(publicKey: string) {
  const workspace = await getPublicWorkspaceByKey(publicKey);
  return {
    workspace: { name: workspace.name, slug: workspace.slug },
    accentColor: workspace.accentColor,
    theme: workspace.widgetTheme,
    placement: workspace.widgetPlacement,
    launcherMode: workspace.widgetLauncherMode,
    showUnreadBadge: workspace.widgetShowUnreadBadge,
    emailSubscribe: workspace.widgetEmailSubscribe,
    /** "View all updates" target: the public changelog, or null when the workspace turned it off. */
    changelogUrl: workspace.changelogEnabled ? publicChangelogUrls(workspace).url : null,
  };
}

function inAppWhere(workspaceId: string) {
  return and(
    eq(releases.workspaceId, workspaceId),
    eq(releases.status, "published"),
    isNull(releases.deletedAt),
    sql`exists (select 1 from ${releasePublications} rp where rp.release_id = "releases"."id" and rp.channel = 'in_app' and rp.status = 'published')`,
  );
}

export async function listWidgetUpdates(publicKey: string, visitorId: string | null, limit: number) {
  const workspace = await getPublicWorkspaceByKey(publicKey);
  const rows = await db
    .select({ release: releases, readAt: inAppReads.readAt, dismissedAt: inAppReads.dismissedAt })
    .from(releases)
    .leftJoin(inAppReads, and(eq(inAppReads.releaseId, releases.id), eq(inAppReads.visitorId, visitorId ?? "")))
    .where(inAppWhere(workspace.id))
    .orderBy(desc(releases.publishedAt))
    .limit(limit);

  const items = rows
    .filter((row) => !row.dismissedAt)
    .map(({ release, readAt }) => {
      const variant = release.channelVariants.in_app;
      return {
        id: release.id,
        slug: release.slug,
        publishedAt: release.publishedAt!.toISOString(),
        category: release.category,
        format: variant?.format ?? "feed",
        title: variant?.title || release.title,
        summary: variant?.summary || release.summary,
        body: variant?.body || release.body,
        cta: release.cta ?? undefined,
        reactions: release.reactions,
        read: Boolean(readAt),
      };
    });
  return { items, unreadCount: items.filter((item) => !item.read).length };
}

async function findWidgetRelease(publicKey: string, releaseId: string) {
  const workspace = await getPublicWorkspaceByKey(publicKey);
  const [release] = await db.select({ id: releases.id }).from(releases).where(and(inAppWhere(workspace.id), eq(releases.id, releaseId))).limit(1);
  if (!release) throw notFound("UPDATE_NOT_FOUND", "Update not found.");
  return { workspaceId: workspace.id, releaseId: release.id };
}

export async function markWidgetUpdateRead(publicKey: string, releaseId: string, visitorId: string) {
  const target = await findWidgetRelease(publicKey, releaseId);
  const inserted = await db
    .insert(inAppReads)
    .values({ releaseId: target.releaseId, workspaceId: target.workspaceId, visitorId })
    .onConflictDoNothing()
    .returning({ releaseId: inAppReads.releaseId });
  if (inserted.length) {
    await track(db, { workspaceId: target.workspaceId, type: "in_app.viewed", releaseId: target.releaseId, channel: "widget", visitorId });
    await db.update(releases).set({ views: sql`${releases.views} + 1` }).where(eq(releases.id, target.releaseId));
  }
  return { id: releaseId, read: true };
}

export async function dismissWidgetUpdate(publicKey: string, releaseId: string, visitorId: string) {
  const target = await findWidgetRelease(publicKey, releaseId);
  await db
    .insert(inAppReads)
    .values({ releaseId: target.releaseId, workspaceId: target.workspaceId, visitorId, dismissedAt: new Date() })
    .onConflictDoUpdate({ target: [inAppReads.releaseId, inAppReads.visitorId], set: { dismissedAt: new Date() } });
  return { id: releaseId, dismissed: true };
}

export async function markAllWidgetUpdatesRead(publicKey: string, visitorId: string) {
  const workspace = await getPublicWorkspaceByKey(publicKey);
  await db.execute(sql`
    insert into ${inAppReads} (release_id, workspace_id, visitor_id)
    select ${releases.id}, ${workspace.id}, ${visitorId} from ${releases} where ${inAppWhere(workspace.id)}
    on conflict do nothing
  `);
  return { ok: true };
}

export async function recordWidgetClick(publicKey: string, releaseId: string, visitorId: string) {
  const target = await findWidgetRelease(publicKey, releaseId);
  await track(db, { workspaceId: target.workspaceId, type: "in_app.clicked", releaseId: target.releaseId, channel: "widget", visitorId });
  return { ok: true };
}


// ---------------------------------------------------------------------------
// Identified users ("secure mode")
//
// The customer's page passes the signed-in user to the widget together with
// userHash = HMAC-SHA256(identity secret, user.id), computed on their server.
// Only a verified user becomes (or updates) a contact, so nobody can add
// someone else's address to a mailing list from the browser console.
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function readIdentitySecret(stored: string | null) {
  return stored ? decryptSecret(stored) : null;
}

/** The workspace's identity secret, created on first request. */
export async function getWidgetIdentitySecret(actor: Actor) {
  const workspace = await getWorkspaceRow(actor.workspaceId);
  const existing = readIdentitySecret(workspace.widgetIdentitySecret);
  if (existing) return { secret: existing };
  return rotateWidgetIdentitySecret(actor);
}

/** Replaces the secret. Every page signing with the old one stops identifying users until it is updated. */
export async function rotateWidgetIdentitySecret(actor: Actor) {
  const secret = `sbis_${randomToken(32)}`;
  await db.update(workspaces).set({ widgetIdentitySecret: encryptSecret(secret), updatedAt: new Date() }).where(eq(workspaces.id, actor.workspaceId));
  return { secret };
}

/** Read state for an identified user follows them across browsers and devices. */
function contactVisitorId(contactId: string) {
  return `c_${contactId.replace(/-/g, "")}`;
}

function signSession(publicKey: string, contactId: string) {
  const payload = Buffer.from(JSON.stringify({ k: publicKey, c: contactId, x: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${hmacSha256Hex(config.ENCRYPTION_KEY, `widget-session:${payload}`).slice(0, 43)}`;
}

/** The contact behind a widget session token, if it is valid for this widget. */
export function readWidgetSession(publicKey: string, token: string | undefined) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, hmacSha256Hex(config.ENCRYPTION_KEY, `widget-session:${payload}`).slice(0, 43))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { k?: unknown; c?: unknown; x?: unknown };
    if (data.k !== publicKey || typeof data.c !== "string" || typeof data.x !== "number" || data.x < Date.now()) return null;
    return { contactId: data.c, visitorId: contactVisitorId(data.c) };
  } catch {
    return null;
  }
}

function toWidgetUser(contact: typeof contacts.$inferSelect) {
  return { email: contact.email, name: contact.name, subscribed: Boolean(contact.email) && !contact.unsubscribedAt };
}

export async function identifyWidgetUser(
  publicKey: string,
  input: { user: { id: string; email?: string; name?: string; plan?: string; tags?: string[]; signedUpAt?: string }; userHash: string },
  anonymousVisitorId: string | null,
) {
  const workspace = await getPublicWorkspaceByKey(publicKey);
  const secret = readIdentitySecret(workspace.widgetIdentitySecret);
  if (!secret) {
    throw badRequest("WIDGET_IDENTITY_NOT_SET_UP", "Identity verification isn't set up for this widget. Copy the identity secret from Widget install in ShipBrief.");
  }
  if (!safeEqual(input.userHash.toLowerCase(), hmacSha256Hex(secret, input.user.id))) {
    throw unauthorized("userHash doesn't match user.id. Compute it on your server as HMAC-SHA256(identity secret, user.id), hex encoded.", "WIDGET_IDENTITY_INVALID");
  }

  const { id: externalId, ...profile } = input.user;
  let contact;
  try {
    contact = await upsertContact(workspace.id, { externalId, ...profile }, { source: "widget", seen: true });
  } catch (error) {
    // The email already belongs to a different user id: identify them without taking over that address.
    if (!(error instanceof AppError) || error.code !== "CONTACT_EXISTS") throw error;
    const { email: _email, ...withoutEmail } = profile;
    contact = await upsertContact(workspace.id, { externalId, ...withoutEmail }, { source: "widget", seen: true });
  }

  const visitorId = contactVisitorId(contact.id);
  if (anonymousVisitorId && anonymousVisitorId !== visitorId) {
    // Keep what they already read in this browser before signing in.
    await db.execute(sql`
      insert into ${inAppReads} (release_id, workspace_id, visitor_id, read_at, dismissed_at)
      select release_id, workspace_id, ${visitorId}, read_at, dismissed_at from ${inAppReads}
      where workspace_id = ${workspace.id} and visitor_id = ${anonymousVisitorId}
      on conflict do nothing
    `);
  }
  return { session: signSession(publicKey, contact.id), user: toWidgetUser(contact) };
}

/** An identified user turning release emails on or off from inside the widget. */
export async function setWidgetSubscription(publicKey: string, sessionToken: string | undefined, subscribed: boolean) {
  const session = readWidgetSession(publicKey, sessionToken);
  if (!session) throw unauthorized("Sign in to your product again to manage email updates.", "WIDGET_SESSION_INVALID");
  const workspace = await getPublicWorkspaceByKey(publicKey);
  const where = and(eq(contacts.id, session.contactId), eq(contacts.workspaceId, workspace.id));
  const [current] = await db.select({ email: contacts.email }).from(contacts).where(where).limit(1);
  if (!current) throw notFound("CONTACT_NOT_FOUND", "We couldn't find your subscription.");
  if (subscribed && !current.email) throw conflict("CONTACT_HAS_NO_EMAIL", "Your account has no email address to send updates to.");
  const [contact] = await db
    .update(contacts)
    .set({ unsubscribedAt: subscribed ? null : sql`coalesce(${contacts.unsubscribedAt}, now())` })
    .where(where)
    .returning();
  return toWidgetUser(contact!);
}

/**
 * ShipBrief's own "What's new": the signed-in ShipBrief user, signed with the
 * identity secret of the workspace named by PRODUCT_UPDATES_WIDGET_KEY, so the
 * app can identify them to that widget exactly like a customer's product would.
 */
export async function productUpdatesIdentity(user: { id: string; email: string; name: string }) {
  const key = config.PRODUCT_UPDATES_WIDGET_KEY;
  if (!key) return null;
  const [workspace] = await db
    .select({ id: workspaces.id, secret: workspaces.widgetIdentitySecret })
    .from(workspaces)
    .where(and(eq(workspaces.publicKey, key), isNull(workspaces.deletedAt)))
    .limit(1);
  if (!workspace) return null;
  const secret = readIdentitySecret(workspace.secret) ?? (await rotateWidgetIdentitySecret({ workspaceId: workspace.id } as Actor)).secret;
  return { key, user: { id: user.id, email: user.email, name: user.name }, userHash: hmacSha256Hex(secret, user.id) };
}
