import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { inAppReads, releasePublications, releases } from "../database/schema.js";
import { notFound } from "../utils/errors.js";
import { track } from "./events.service.js";
import { getPublicWorkspaceByKey } from "./workspace.service.js";

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

