import crypto from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { config } from "../config/env.js";
import { db, type DbExecutor } from "../database/client.js";
import { audiences, memberships, subscriptions, workspaces } from "../database/schema.js";
import type { Channel, WorkspaceNotificationSettings } from "../types/domain.js";
import { badRequest, conflict, forbidden, isUniqueViolation, notFound } from "../utils/errors.js";
import { RESERVED_WORKSPACE_SLUGS, WORKSPACE_SLUG_PATTERN } from "../utils/slug.js";
import type { Actor } from "../utils/http.js";
import { audit } from "./audit.service.js";

export const TRIAL_DAYS = 14;

function newPublicKey(slug: string) {
  return `sb_${slug.replace(/-/g, "").slice(0, 10)}_${crypto.randomBytes(4).toString("hex")}`;
}

export function assertValidSlug(slug: string) {
  if (!WORKSPACE_SLUG_PATTERN.test(slug)) {
    throw badRequest("INVALID_SLUG", "Use a URL-safe workspace address between 3 and 50 characters.");
  }
  if (RESERVED_WORKSPACE_SLUGS.has(slug)) {
    throw conflict("SLUG_TAKEN", "That workspace address is reserved. Try another.");
  }
}

/** Creates a workspace with its owner, a trial subscription and the default "All users" audience. */
export async function createWorkspace(
  tx: DbExecutor,
  input: {
    name: string;
    slug: string;
    ownerId: string;
    onboarding?: { role?: string; goal?: string; channels?: Channel[] };
    isDevSeed?: boolean;
  },
) {
  assertValidSlug(input.slug);
  let workspace: typeof workspaces.$inferSelect;
  try {
    [workspace] = (await tx
      .insert(workspaces)
      .values({
        name: input.name,
        slug: input.slug,
        publicKey: newPublicKey(input.slug),
        onboarding: input.onboarding ?? {},
        createdBy: input.ownerId,
        isDevSeed: input.isDevSeed ?? false,
      })
      .returning()) as [typeof workspaces.$inferSelect];
  } catch (error) {
    if (isUniqueViolation(error, "workspaces_slug_key")) {
      throw conflict("SLUG_TAKEN", "That workspace address is already taken. Try another.");
    }
    throw error;
  }

  await tx.insert(memberships).values({ workspaceId: workspace.id, userId: input.ownerId, role: "owner" });
  await tx.insert(subscriptions).values({
    workspaceId: workspace.id,
    plan: "pro",
    status: "trialing",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
  });
  await tx.insert(audiences).values({ workspaceId: workspace.id, name: "All users", rules: {} });
  return workspace;
}

export async function getWorkspaceRow(workspaceId: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)))
    .limit(1);
  if (!workspace) throw notFound("WORKSPACE_NOT_FOUND", "Workspace not found.");
  return workspace;
}

// ---------------------------------------------------------------------------
// Settings (Settings page) and branding (Branding page) — two views of the same row.
// ---------------------------------------------------------------------------

export function toSettings(workspace: typeof workspaces.$inferSelect) {
  return {
    name: workspace.name,
    slug: workspace.slug,
    brandVoice: workspace.brandVoice,
    timezone: workspace.timezone,
    notifications: workspace.notificationSettings,
  };
}

export function toBranding(workspace: typeof workspaces.$inferSelect) {
  return {
    logoUrl: workspace.logoUrl,
    accentColor: workspace.accentColor,
    faviconUrl: workspace.faviconUrl,
    domain: workspace.customDomain ?? "",
    domainStatus: workspace.domainStatus,
    publicTheme: workspace.publicTheme,
    widgetTheme: workspace.widgetTheme,
  };
}

export async function getSettings(actor: Actor) {
  return toSettings(await getWorkspaceRow(actor.workspaceId));
}

export async function updateSettings(
  actor: Actor,
  input: { name?: string; slug?: string; brandVoice?: string; timezone?: string; notifications?: Partial<WorkspaceNotificationSettings> },
) {
  const current = await getWorkspaceRow(actor.workspaceId);
  if (input.slug && input.slug !== current.slug) {
    assertValidSlug(input.slug);
    const [taken] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.slug, input.slug), ne(workspaces.id, current.id)))
      .limit(1);
    if (taken) throw conflict("SLUG_TAKEN", "That workspace address is already taken. Try another.");
  }
  try {
    const [updated] = await db
      .update(workspaces)
      .set({
        updatedAt: new Date(),
        name: input.name ?? undefined,
        slug: input.slug ?? undefined,
        brandVoice: input.brandVoice ?? undefined,
        timezone: input.timezone ?? undefined,
        notificationSettings: input.notifications ? { ...current.notificationSettings, ...input.notifications } : undefined,
      })
      .where(eq(workspaces.id, current.id))
      .returning();
    if (input.slug && input.slug !== current.slug) {
      await audit({ action: "workspace.slug_changed", workspaceId: current.id, userId: actor.userId, metadata: { from: current.slug, to: input.slug } });
    }
    return toSettings(updated!);
  } catch (error) {
    if (isUniqueViolation(error, "workspaces_slug_key")) throw conflict("SLUG_TAKEN", "That workspace address is already taken. Try another.");
    throw error;
  }
}

export async function getBranding(actor: Actor) {
  return toBranding(await getWorkspaceRow(actor.workspaceId));
}

export async function updateBranding(
  actor: Actor,
  input: {
    logoUrl?: string | null;
    faviconUrl?: string | null;
    accentColor?: string;
    domain?: string;
    publicTheme?: "light" | "dark" | "system";
    widgetTheme?: "inherit" | "light" | "dark";
  },
) {
  const current = await getWorkspaceRow(actor.workspaceId);
  let customDomain: string | null | undefined;
  let domainStatus: "connected" | "pending" | "none" | undefined;
  if (input.domain !== undefined) {
    customDomain = input.domain.trim().toLowerCase() || null;
    if (customDomain !== current.customDomain) {
      // A changed domain must be re-verified (DNS) before it is served; until then it is pending.
      domainStatus = customDomain ? "pending" : "none";
    }
  }
  try {
    const [updated] = await db
      .update(workspaces)
      .set({
        updatedAt: new Date(),
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        accentColor: input.accentColor,
        customDomain,
        domainStatus,
        publicTheme: input.publicTheme,
        widgetTheme: input.widgetTheme,
      })
      .where(eq(workspaces.id, current.id))
      .returning();
    return toBranding(updated!);
  } catch (error) {
    if (isUniqueViolation(error, "workspaces_custom_domain_key")) throw conflict("DOMAIN_TAKEN", "That domain is already used by another workspace.");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public changelog: where it lives and what it shows
// ---------------------------------------------------------------------------

/** Canonical public addresses of a workspace's changelog: the ShipBrief-hosted /c/[slug] route and its feed. */
export function publicChangelogUrls(workspace: Pick<typeof workspaces.$inferSelect, "slug">) {
  const url = `${config.APP_URL.replace(/\/$/, "")}/c/${workspace.slug}`;
  return { url, rssUrl: `${url}/rss.xml`, releaseUrl: (releaseSlug: string) => `${url}/${releaseSlug}` };
}

export function toChangelogSettings(workspace: typeof workspaces.$inferSelect) {
  const { url, rssUrl } = publicChangelogUrls(workspace);
  return {
    enabled: workspace.changelogEnabled,
    allowSubscriptions: workspace.changelogSubscribe,
    showAuthor: workspace.changelogShowAuthor,
    url,
    rssUrl,
  };
}

export async function getChangelogSettings(actor: Actor) {
  return toChangelogSettings(await getWorkspaceRow(actor.workspaceId));
}

export async function updateChangelogSettings(actor: Actor, input: { enabled?: boolean; allowSubscriptions?: boolean; showAuthor?: boolean }) {
  const [updated] = await db
    .update(workspaces)
    .set({
      updatedAt: new Date(),
      changelogEnabled: input.enabled,
      changelogSubscribe: input.allowSubscriptions,
      changelogShowAuthor: input.showAuthor,
    })
    .where(and(eq(workspaces.id, actor.workspaceId), isNull(workspaces.deletedAt)))
    .returning();
  if (!updated) throw notFound("WORKSPACE_NOT_FOUND", "Workspace not found.");
  if (input.enabled !== undefined) {
    await audit({ action: input.enabled ? "changelog.enabled" : "changelog.disabled", workspaceId: updated.id, userId: actor.userId });
  }
  return toChangelogSettings(updated);
}

// ---------------------------------------------------------------------------
// Widget install settings
// ---------------------------------------------------------------------------

export function toWidgetSettings(workspace: typeof workspaces.$inferSelect) {
  return {
    projectId: workspace.publicKey,
    launcherMode: workspace.widgetLauncherMode,
    placement: workspace.widgetPlacement,
    showUnreadBadge: workspace.widgetShowUnreadBadge,
    theme: workspace.widgetTheme,
    emailSubscribe: workspace.widgetEmailSubscribe,
    /** Whether an identity secret exists (the secret itself has its own endpoint). */
    identityVerification: Boolean(workspace.widgetIdentitySecret),
  };
}

export async function getWidgetSettings(actor: Actor) {
  return toWidgetSettings(await getWorkspaceRow(actor.workspaceId));
}

export async function updateWidgetSettings(
  actor: Actor,
  input: {
    launcherMode?: "default" | "manual";
    placement?: "bottom-right" | "bottom-left";
    showUnreadBadge?: boolean;
    theme?: "inherit" | "light" | "dark";
    emailSubscribe?: boolean;
  },
) {
  const [updated] = await db
    .update(workspaces)
    .set({
      updatedAt: new Date(),
      widgetLauncherMode: input.launcherMode,
      widgetPlacement: input.placement,
      widgetShowUnreadBadge: input.showUnreadBadge,
      widgetTheme: input.theme,
      widgetEmailSubscribe: input.emailSubscribe,
    })
    .where(and(eq(workspaces.id, actor.workspaceId), isNull(workspaces.deletedAt)))
    .returning();
  if (!updated) throw notFound("WORKSPACE_NOT_FOUND", "Workspace not found.");
  return toWidgetSettings(updated);
}

/** Soft-deletes the workspace. Requires the exact name as confirmation (the UI asks for it too). */
export async function deleteWorkspace(actor: Actor, confirmation: string) {
  const workspace = await getWorkspaceRow(actor.workspaceId);
  if (actor.role !== "owner") throw forbidden("Only the workspace owner can delete it.");
  if (confirmation.trim() !== workspace.name) throw badRequest("CONFIRMATION_MISMATCH", "Type the workspace name exactly to confirm.");
  await db
    .update(workspaces)
    .set({ deletedAt: new Date(), slug: `deleted-${workspace.id}`, customDomain: null })
    .where(eq(workspaces.id, workspace.id));
  await audit({ action: "workspace.deleted", workspaceId: workspace.id, userId: actor.userId, metadata: { name: workspace.name, slug: workspace.slug } });
  return { id: workspace.id };
}

export async function getPublicWorkspaceBySlug(slug: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug.trim().toLowerCase()), isNull(workspaces.deletedAt)))
    .limit(1);
  if (!workspace) throw notFound("WORKSPACE_NOT_FOUND", "Workspace not found.");
  return workspace;
}

/** Like getPublicWorkspaceBySlug, for the changelog itself: a workspace that turned its changelog off has none. */
export async function getPublicChangelogWorkspace(slug: string) {
  const workspace = await getPublicWorkspaceBySlug(slug);
  if (!workspace.changelogEnabled) throw notFound("CHANGELOG_NOT_FOUND", "This changelog isn't public.");
  return workspace;
}

export async function getPublicWorkspaceByKey(publicKey: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.publicKey, publicKey.trim()), isNull(workspaces.deletedAt)))
    .limit(1);
  if (!workspace) throw notFound("WORKSPACE_NOT_FOUND", "Workspace not found.");
  return workspace;
}

export async function listUserWorkspaces(userId: string) {
  return db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), isNull(workspaces.deletedAt)));
}

