import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../database/client.js";
import { analyticsEvents, feedback, feedbackVotes, publicComments, releasePublications, releaseReactions, releases, roadmapItems, users } from "../database/schema.js";
import type { ReleaseStatus } from "../types/domain.js";
import { badRequest, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { prefixTsQuery } from "./release.service.js";
import { emitEvent, track } from "./events.service.js";
import { getPublicChangelogWorkspace, getPublicWorkspaceBySlug, publicChangelogUrls, toBranding } from "./workspace.service.js";

type ReleaseRow = typeof releases.$inferSelect;

// ---------------------------------------------------------------------------
// Workspace changelog manager (/app/changelog)
// ---------------------------------------------------------------------------

export async function listChangelogEntries(
  actor: Actor,
  filters: { search?: string; category?: string; status?: ReleaseStatus; tag?: string; sort: "newest" | "oldest" | "most_engaged" | "most_discussed" },
) {
  const tsQuery = filters.search ? prefixTsQuery(filters.search) : null;
  const publishedAtExpr = sql`coalesce(${releases.publishedAt}, ${releases.scheduledAt}, ${releases.updatedAt})`;
  const order: SQL[] =
    filters.sort === "oldest" ? [sql`${publishedAtExpr} asc`]
    : filters.sort === "most_engaged" ? [sql`(${releases.reactions} + ${releases.comments}) desc`, sql`${publishedAtExpr} desc`]
    : filters.sort === "most_discussed" ? [desc(releases.comments), sql`${publishedAtExpr} desc`]
    : [sql`${publishedAtExpr} desc`];

  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      summary: releases.summary,
      category: releases.category,
      tags: releases.tags,
      publishedAt: sql<Date>`${publishedAtExpr}`,
      slug: releases.slug,
      featured: releases.featured,
      status: releases.status,
      reactions: releases.reactions,
      comments: releases.comments,
    })
    .from(releases)
    .where(
      and(
        eq(releases.workspaceId, actor.workspaceId),
        isNull(releases.deletedAt),
        ne(releases.status, "archived"),
        sql`${releases.channels} @> array['changelog']::channel[]`,
        filters.category ? eq(releases.category, filters.category) : undefined,
        filters.status ? eq(releases.status, filters.status) : undefined,
        filters.tag ? sql`${releases.tags} @> array[${filters.tag.toLowerCase()}]::text[]` : undefined,
        tsQuery ? sql`${releases.searchVector} @@ to_tsquery('simple', ${tsQuery})` : undefined,
      ),
    )
    .orderBy(...order)
    .limit(200);
  return rows.map((row) => ({ ...row, publishedAt: new Date(row.publishedAt).toISOString() }));
}

export async function changelogFilterOptions(actor: Actor) {
  const [row] = await db
    .select({
      categories: sql<string[]>`coalesce(array_agg(distinct ${releases.category}), '{}')`,
      tags: sql<string[]>`coalesce((select array_agg(distinct t order by t) from ${releases} r2, unnest(r2.tags) t where r2.workspace_id = ${actor.workspaceId} and r2.deleted_at is null and r2.status <> 'archived' and r2.channels @> array['changelog']::channel[]), '{}')`,
    })
    .from(releases)
    .where(and(eq(releases.workspaceId, actor.workspaceId), isNull(releases.deletedAt), ne(releases.status, "archived"), sql`${releases.channels} @> array['changelog']::channel[]`));
  return {
    categories: [...(row?.categories ?? [])].sort((a, b) => a.localeCompare(b)),
    tags: row?.tags ?? [],
  };
}

export async function hideComment(actor: Actor, releaseId: string, commentId: string) {
  const [comment] = await db
    .update(publicComments)
    .set({ hidden: true })
    .where(and(eq(publicComments.id, commentId), eq(publicComments.releaseId, releaseId), eq(publicComments.workspaceId, actor.workspaceId), eq(publicComments.hidden, false)))
    .returning({ id: publicComments.id });
  if (!comment) throw notFound("COMMENT_NOT_FOUND", "Comment not found.");
  await db.update(releases).set({ comments: sql`greatest(${releases.comments} - 1, 0)` }).where(eq(releases.id, releaseId));
  return { id: comment.id };
}

// ---------------------------------------------------------------------------
// Public changelog (/c/[workspace]) — exposes only published, changelog content.
// ---------------------------------------------------------------------------

type PublicWorkspaceRow = Awaited<ReturnType<typeof getPublicChangelogWorkspace>>;

/**
 * Public shape: no ids of internal users, counters beyond engagement, or drafts.
 * The author's display name is included only when the workspace opted in.
 */
export function toPublicRelease(row: ReleaseRow, author?: string | null) {
  const variant = row.channelVariants.changelog;
  return {
    id: row.id,
    slug: row.slug,
    title: variant?.title || row.title,
    summary: variant?.summary || row.summary,
    body: variant?.body || row.body,
    category: row.category,
    tags: row.tags,
    publishedAt: row.publishedAt!.toISOString(),
    featured: row.featured,
    cta: row.cta ?? undefined,
    media: row.media.length ? row.media : undefined,
    seo: row.seo ?? undefined,
    reactions: row.reactions,
    comments: row.comments,
    author: author ? { name: author } : undefined,
  };
}

/**
 * The one visibility rule for every public surface of the changelog (pages, RSS,
 * engagement): published, not deleted, and actually published to the Changelog
 * channel. Drafts, scheduled updates and in-app/email-only updates never match.
 */
export function publicReleaseWhere(workspaceId: string): SQL {
  return and(
    eq(releases.workspaceId, workspaceId),
    eq(releases.status, "published"),
    isNull(releases.deletedAt),
    sql`exists (select 1 from ${releasePublications} rp where rp.release_id = "releases"."id" and rp.channel = 'changelog' and rp.status = 'published')`,
  )!;
}

export async function getPublicWorkspace(slug: string) {
  const workspace = await getPublicChangelogWorkspace(slug);
  const { url, rssUrl } = publicChangelogUrls(workspace);
  return {
    name: workspace.name,
    slug: workspace.slug,
    branding: toBranding(workspace),
    url,
    rssUrl,
    settings: { allowSubscriptions: workspace.changelogSubscribe, showAuthor: workspace.changelogShowAuthor },
  };
}

/** Rows with their author's display name (who published, else who wrote it) when the workspace shows authors. */
async function selectPublicReleases(workspace: PublicWorkspaceRow, where: SQL | undefined, page: { limit: number; offset?: number }) {
  const rows = await db
    .select({ release: releases, author: users.name })
    .from(releases)
    .leftJoin(users, workspace.changelogShowAuthor ? sql`${users.id} = coalesce(${releases.publishedBy}, ${releases.createdBy})` : sql`false`)
    .where(where)
    .orderBy(desc(releases.publishedAt), desc(releases.id))
    .limit(page.limit)
    .offset(page.offset ?? 0);
  return rows.map((row) => ({ release: row.release, author: workspace.changelogShowAuthor ? row.author : null }));
}

/** Newest public releases of an enabled changelog, for feeds. */
export async function latestPublicReleases(workspace: PublicWorkspaceRow, limit: number) {
  return selectPublicReleases(workspace, publicReleaseWhere(workspace.id), { limit });
}

export async function listPublicReleases(slug: string, filters: { search?: string; tag?: string; category?: string; page: number; pageSize: number }) {
  const workspace = await getPublicChangelogWorkspace(slug);
  const tsQuery = filters.search ? prefixTsQuery(filters.search) : null;
  const where = and(
    publicReleaseWhere(workspace.id),
    filters.tag ? sql`${releases.tags} @> array[${filters.tag.toLowerCase()}]::text[]` : undefined,
    filters.category ? eq(releases.category, filters.category) : undefined,
    tsQuery ? sql`${releases.searchVector} @@ to_tsquery('simple', ${tsQuery})` : undefined,
  );
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    selectPublicReleases(workspace, where, { limit: filters.pageSize, offset: (filters.page - 1) * filters.pageSize }),
    db.select({ total: sql<number>`count(*)::int` }).from(releases).where(where),
  ]);
  return { items: rows.map((row) => toPublicRelease(row.release, row.author)), total, workspaceId: workspace.id };
}

async function findPublicRelease(workspaceSlug: string, releaseSlug: string) {
  const workspace = await getPublicChangelogWorkspace(workspaceSlug);
  const [row] = await selectPublicReleases(workspace, and(publicReleaseWhere(workspace.id), eq(releases.slug, releaseSlug)), { limit: 1 });
  if (!row) throw notFound("UPDATE_NOT_FOUND", "Update not found.");
  return { workspace, release: row.release, author: row.author };
}

export async function getPublicRelease(workspaceSlug: string, releaseSlug: string) {
  const { release, author } = await findPublicRelease(workspaceSlug, releaseSlug);
  return toPublicRelease(release, author);
}

/** Counts a view once per visitor per 30 minutes, so refreshes don't inflate numbers. */
export async function recordPublicView(workspaceSlug: string, releaseSlug: string | null, visitorId: string, channel: "changelog" | "widget" = "changelog") {
  const workspace = await getPublicChangelogWorkspace(workspaceSlug);
  if (!releaseSlug) {
    await track(db, { workspaceId: workspace.id, type: "changelog.viewed", channel, visitorId });
    return;
  }
  const { release } = await findPublicRelease(workspaceSlug, releaseSlug);
  const [recent] = await db
    .select({ id: analyticsEvents.id })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.releaseId, release.id), eq(analyticsEvents.type, "release.viewed"), eq(analyticsEvents.visitorId, visitorId), sql`${analyticsEvents.occurredAt} > now() - interval '30 minutes'`))
    .limit(1);
  if (recent) return;
  await db.transaction(async (tx) => {
    await track(tx, { workspaceId: workspace.id, type: "release.viewed", releaseId: release.id, channel, visitorId });
    await tx.update(releases).set({ views: sql`${releases.views} + 1` }).where(eq(releases.id, release.id));
  });
}

export async function recordCtaClick(workspaceSlug: string, releaseSlug: string, visitorId: string, channel: "changelog" | "widget" = "changelog") {
  const { workspace, release } = await findPublicRelease(workspaceSlug, releaseSlug);
  await track(db, { workspaceId: workspace.id, type: "cta.clicked", releaseId: release.id, channel, visitorId });
}

export async function getEngagement(workspaceSlug: string, releaseSlug: string, visitorId: string | null) {
  const { release } = await findPublicRelease(workspaceSlug, releaseSlug);
  const [reacted] = visitorId
    ? await db.select({ id: releaseReactions.id }).from(releaseReactions).where(and(eq(releaseReactions.releaseId, release.id), eq(releaseReactions.visitorId, visitorId))).limit(1)
    : [];
  return { reactions: release.reactions, comments: release.comments, hasReacted: Boolean(reacted) };
}

export async function toggleReaction(workspaceSlug: string, releaseSlug: string, visitorId: string) {
  const { workspace, release } = await findPublicRelease(workspaceSlug, releaseSlug);
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(releaseReactions)
      .where(and(eq(releaseReactions.releaseId, release.id), eq(releaseReactions.visitorId, visitorId)))
      .returning({ id: releaseReactions.id });
    let hasReacted = false;
    if (removed.length === 0) {
      const inserted = await tx.insert(releaseReactions).values({ releaseId: release.id, workspaceId: workspace.id, visitorId }).onConflictDoNothing().returning({ id: releaseReactions.id });
      hasReacted = inserted.length > 0;
      if (hasReacted) await track(tx, { workspaceId: workspace.id, type: "reaction.added", releaseId: release.id, channel: "changelog", visitorId });
    }
    const delta = removed.length ? -1 : hasReacted ? 1 : 0;
    const [updated] = await tx
      .update(releases)
      .set({ reactions: sql`greatest(${releases.reactions} + ${delta}, 0)` })
      .where(eq(releases.id, release.id))
      .returning({ reactions: releases.reactions, comments: releases.comments });
    return { reactions: updated!.reactions, comments: updated!.comments, hasReacted };
  });
}

export async function listPublicComments(workspaceSlug: string, releaseSlug: string) {
  const { release } = await findPublicRelease(workspaceSlug, releaseSlug);
  const rows = await db
    .select({ id: publicComments.id, releaseId: publicComments.releaseId, author: publicComments.authorName, body: publicComments.body, createdAt: publicComments.createdAt })
    .from(publicComments)
    .where(and(eq(publicComments.releaseId, release.id), eq(publicComments.hidden, false)))
    .orderBy(asc(publicComments.createdAt))
    .limit(200);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function createPublicComment(workspaceSlug: string, releaseSlug: string, input: { author?: string; body: string }, visitorId: string) {
  const { workspace, release } = await findPublicRelease(workspaceSlug, releaseSlug);
  const body = input.body.trim();
  if (!body) throw badRequest("EMPTY_COMMENT", "Write a comment before posting it.");
  if ((body.match(/https?:\/\//gi) ?? []).length > 2) throw badRequest("COMMENT_REJECTED", "Comments can include at most two links.");
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(publicComments)
      .values({ releaseId: release.id, workspaceId: workspace.id, authorName: input.author?.trim().slice(0, 80) || "Guest", body, visitorId })
      .returning();
    await tx.update(releases).set({ comments: sql`${releases.comments} + 1` }).where(eq(releases.id, release.id));
    await track(tx, { workspaceId: workspace.id, type: "comment.created", releaseId: release.id, channel: "changelog", visitorId });
    return { id: comment!.id, releaseId: comment!.releaseId, author: comment!.authorName, body: comment!.body, createdAt: comment!.createdAt.toISOString() };
  });
}

/** Public feedback form. Submissions land in the workspace's feedback inbox as customer requests. */
export async function submitPublicFeedback(workspaceSlug: string, input: { title: string; description: string; email?: string; name?: string; tags?: string[] }, visitorId: string) {
  const workspace = await getPublicWorkspaceBySlug(workspaceSlug);
  return db.transaction(async (tx) => {
    const [item] = await tx
      .insert(feedback)
      .values({
        workspaceId: workspace.id,
        title: input.title.trim(),
        description: input.description.trim(),
        tags: input.tags ?? [],
        source: "customer",
        votes: 1,
        submitterEmail: input.email ?? null,
        submitterName: input.name ?? null,
      })
      .returning({ id: feedback.id, title: feedback.title });
    await tx.insert(feedbackVotes).values({ feedbackId: item!.id, workspaceId: workspace.id, voterKey: `visitor:${visitorId}` });
    await track(tx, { workspaceId: workspace.id, type: "feedback.submitted", channel: "changelog", visitorId });
    await emitEvent(tx, { workspaceId: workspace.id, event: "feedback.created", data: { id: item!.id, title: item!.title, source: "customer" } });
    return { id: item!.id, status: "new" as const };
  });
}

export async function listPublicRoadmap(workspaceSlug: string) {
  const workspace = await getPublicWorkspaceBySlug(workspaceSlug);
  const rows = await db
    .select({ id: roadmapItems.id, title: roadmapItems.title, description: roadmapItems.description, status: roadmapItems.status, targetDate: roadmapItems.targetDate })
    .from(roadmapItems)
    .where(and(eq(roadmapItems.workspaceId, workspace.id), eq(roadmapItems.isPublic, true), isNull(roadmapItems.deletedAt)))
    .orderBy(asc(roadmapItems.position), asc(roadmapItems.createdAt));
  return rows.map((row) => ({ ...row, targetDate: row.targetDate ?? undefined }));
}

