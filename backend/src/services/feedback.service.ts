import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { feedback, feedbackClusters, feedbackComments, feedbackVotes, releases, roadmapItems } from "../database/schema.js";
import type { FeedbackStatus, Priority } from "../types/domain.js";
import { badRequest, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { emitEvent, track } from "./events.service.js";
import { can } from "./permissions.js";

type FeedbackRow = typeof feedback.$inferSelect;

export function toFeedbackDto(row: FeedbackRow, options: { hasVoted?: boolean; includeSubmitter?: boolean } = {}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    votes: row.votes,
    comments: row.comments,
    status: row.status,
    tags: row.tags,
    priority: row.priority,
    source: row.source,
    aiClusterId: row.clusterId ?? undefined,
    roadmapItemId: row.roadmapItemId ?? undefined,
    linkedReleaseId: row.linkedReleaseId ?? undefined,
    internalNotes: row.internalNotes ?? undefined,
    mergedIntoId: row.mergedIntoId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasVoted: options.hasVoted ?? false,
    ...(options.includeSubmitter && (row.submitterEmail || row.submitterName)
      ? { submitter: { name: row.submitterName ?? undefined, email: row.submitterEmail ?? undefined } }
      : {}),
  };
}

const votedBy = (userId: string) =>
  sql<boolean>`exists (select 1 from ${feedbackVotes} fv where fv.feedback_id = "feedback"."id" and fv.voter_key = ${`user:${userId}`})`;

async function findFeedback(executor: DbExecutor, workspaceId: string, id: string, lock = false) {
  const query = executor
    .select()
    .from(feedback)
    .where(and(eq(feedback.id, id), eq(feedback.workspaceId, workspaceId), isNull(feedback.deletedAt)))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw notFound("FEEDBACK_NOT_FOUND", "Feedback not found.");
  return row;
}

export async function listFeedback(
  actor: Actor,
  filters: { search?: string; status?: FeedbackStatus; priority?: Priority; tag?: string; page: number; pageSize: number; sort: "votes" | "newest" },
) {
  const terms = filters.search
    ?.split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" & ");
  const where = and(
    eq(feedback.workspaceId, actor.workspaceId),
    isNull(feedback.deletedAt),
    isNull(feedback.mergedIntoId),
    filters.status ? eq(feedback.status, filters.status) : undefined,
    filters.priority ? eq(feedback.priority, filters.priority) : undefined,
    filters.tag ? sql`${feedback.tags} @> array[${filters.tag.toLowerCase()}]::text[]` : undefined,
    terms ? sql`(${feedback.searchVector} @@ to_tsquery('simple', ${terms}) or ${feedback.tags} && ${sql`string_to_array(${filters.search!.toLowerCase()}, ' ')`})` : undefined,
  );
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({ row: feedback, hasVoted: votedBy(actor.userId) })
      .from(feedback)
      .where(where)
      .orderBy(...(filters.sort === "newest" ? [desc(feedback.createdAt)] : [desc(feedback.votes), desc(feedback.createdAt)]))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(feedback).where(where),
  ]);
  const includeSubmitter = can(actor.role, "feedback:manage");
  return { items: rows.map(({ row, hasVoted }) => toFeedbackDto(row, { hasVoted, includeSubmitter })), total };
}

export async function getFeedback(actor: Actor, id: string) {
  const [row] = await db
    .select({ row: feedback, hasVoted: votedBy(actor.userId) })
    .from(feedback)
    .where(and(eq(feedback.id, id), eq(feedback.workspaceId, actor.workspaceId), isNull(feedback.deletedAt)))
    .limit(1);
  if (!row) throw notFound("FEEDBACK_NOT_FOUND", "Feedback not found.");
  return toFeedbackDto(row.row, { hasVoted: row.hasVoted, includeSubmitter: can(actor.role, "feedback:manage") });
}

export async function createFeedback(
  actor: Actor,
  input: { title: string; description: string; tags?: string[]; priority?: Priority; source?: "customer" | "internal" },
) {
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(feedback)
      .values({
        workspaceId: actor.workspaceId,
        title: input.title.trim(),
        description: input.description.trim(),
        tags: input.tags ?? [],
        priority: input.priority ?? "medium",
        source: input.source ?? "internal",
        votes: 1,
        createdBy: actor.userId,
      })
      .returning();
    await tx.insert(feedbackVotes).values({ feedbackId: row!.id, workspaceId: actor.workspaceId, voterKey: `user:${actor.userId}` });
    await track(tx, { workspaceId: actor.workspaceId, type: "feedback.submitted", channel: "dashboard" });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "feedback.created", data: { id: row!.id, title: row!.title, source: row!.source } });
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "feedback", message: `New request: “${row!.title}”`, link: `/app/feedback/${row!.id}`, actorUserId: actor.userId, actorName: actor.name });
    return row!.id;
  });
  return getFeedback(actor, id);
}

export async function updateFeedback(
  actor: Actor,
  id: string,
  input: {
    title?: string;
    description?: string;
    status?: FeedbackStatus;
    priority?: Priority;
    tags?: string[];
    internalNotes?: string | null;
    linkedReleaseId?: string | null;
  },
) {
  await db.transaction(async (tx) => {
    const current = await findFeedback(tx, actor.workspaceId, id, true);
    if (input.linkedReleaseId) {
      const [release] = await tx
        .select({ id: releases.id })
        .from(releases)
        .where(and(eq(releases.id, input.linkedReleaseId), eq(releases.workspaceId, actor.workspaceId), isNull(releases.deletedAt)))
        .limit(1);
      if (!release) throw badRequest("RELEASE_NOT_FOUND", "The selected release no longer exists.");
    }
    await tx
      .update(feedback)
      .set({
        updatedAt: new Date(),
        title: input.title?.trim() || undefined,
        description: input.description?.trim(),
        status: input.status,
        priority: input.priority,
        tags: input.tags,
        internalNotes: input.internalNotes,
        linkedReleaseId: input.linkedReleaseId,
      })
      .where(eq(feedback.id, id));
    if (input.status && input.status !== current.status) {
      await emitEvent(tx, { workspaceId: actor.workspaceId, event: "feedback.updated", data: { id, title: current.title, status: input.status, previousStatus: current.status } });
    }
  });
  return getFeedback(actor, id);
}

/** One vote per team member; voting again is a no-op that returns the current state. */
export async function voteFeedback(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    await findFeedback(tx, actor.workspaceId, id, true);
    const inserted = await tx
      .insert(feedbackVotes)
      .values({ feedbackId: id, workspaceId: actor.workspaceId, voterKey: `user:${actor.userId}` })
      .onConflictDoNothing()
      .returning({ id: feedbackVotes.id });
    if (inserted.length) {
      await tx.update(feedback).set({ votes: sql`${feedback.votes} + 1` }).where(eq(feedback.id, id));
      await track(tx, { workspaceId: actor.workspaceId, type: "feedback.voted", channel: "dashboard" });
    }
  });
  return getFeedback(actor, id);
}

export async function listComments(actor: Actor, feedbackId: string) {
  await findFeedback(db, actor.workspaceId, feedbackId);
  const rows = await db
    .select()
    .from(feedbackComments)
    .where(and(eq(feedbackComments.feedbackId, feedbackId), eq(feedbackComments.workspaceId, actor.workspaceId)))
    .orderBy(asc(feedbackComments.createdAt));
  return rows.map((row) => ({ id: row.id, feedbackId: row.feedbackId, author: row.authorName, body: row.body, createdAt: row.createdAt.toISOString(), isInternal: row.isInternal }));
}

export async function addComment(actor: Actor, feedbackId: string, input: { body: string; isInternal?: boolean }) {
  return db.transaction(async (tx) => {
    await findFeedback(tx, actor.workspaceId, feedbackId, true);
    const [row] = await tx
      .insert(feedbackComments)
      .values({ feedbackId, workspaceId: actor.workspaceId, authorUserId: actor.userId, authorName: actor.name, body: input.body.trim(), isInternal: input.isInternal ?? false })
      .returning();
    await tx.update(feedback).set({ comments: sql`${feedback.comments} + 1` }).where(eq(feedback.id, feedbackId));
    return { id: row!.id, feedbackId, author: row!.authorName, body: row!.body, createdAt: row!.createdAt.toISOString(), isInternal: row!.isInternal };
  });
}

/**
 * Merges a duplicate into a target: votes move across (deduplicated by voter),
 * comments move, tags are unioned, and the duplicate is hidden from lists.
 */
export async function mergeFeedback(actor: Actor, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw badRequest("MERGE_SELF", "Choose a different request to merge into.");
  await db.transaction(async (tx) => {
    const source = await findFeedback(tx, actor.workspaceId, sourceId, true);
    const target = await findFeedback(tx, actor.workspaceId, targetId, true);
    if (source.mergedIntoId) throw badRequest("ALREADY_MERGED", "That request was already merged.");
    if (target.mergedIntoId) throw badRequest("TARGET_MERGED", "Choose a request that hasn't been merged itself.");

    const [{ sourceRows } = { sourceRows: 0 }] = await tx
      .select({ sourceRows: sql<number>`count(*)::int` })
      .from(feedbackVotes)
      .where(eq(feedbackVotes.feedbackId, sourceId));
    const moved = await tx
      .update(feedbackVotes)
      .set({ feedbackId: targetId })
      .where(
        and(
          eq(feedbackVotes.feedbackId, sourceId),
          sql`${feedbackVotes.voterKey} not in (select voter_key from ${feedbackVotes} where feedback_id = ${targetId})`,
        ),
      )
      .returning({ id: feedbackVotes.id });
    await tx.delete(feedbackVotes).where(eq(feedbackVotes.feedbackId, sourceId));
    await tx.update(feedbackComments).set({ feedbackId: targetId }).where(eq(feedbackComments.feedbackId, sourceId));

    // Imported/legacy vote totals may exceed per-voter rows; those votes carry over as-is.
    const legacySourceVotes = Math.max(0, source.votes - sourceRows);
    await tx
      .update(feedback)
      .set({
        votes: target.votes + moved.length + legacySourceVotes,
        comments: target.comments + source.comments,
        tags: [...new Set([...target.tags, ...source.tags])],
      })
      .where(eq(feedback.id, targetId));
    await tx.update(feedback).set({ mergedIntoId: targetId, votes: 0, comments: 0 }).where(eq(feedback.id, sourceId));
  });
  return getFeedback(actor, targetId);
}

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

export async function listClusters(actor: Actor) {
  const clusters = await db.select().from(feedbackClusters).where(eq(feedbackClusters.workspaceId, actor.workspaceId)).orderBy(asc(feedbackClusters.createdAt));
  if (clusters.length === 0) return [];
  const members = await db
    .select({ id: feedback.id, clusterId: feedback.clusterId, votes: feedback.votes, comments: feedback.comments })
    .from(feedback)
    .where(and(eq(feedback.workspaceId, actor.workspaceId), inArray(feedback.clusterId, clusters.map((cluster) => cluster.id)), isNull(feedback.mergedIntoId), isNull(feedback.deletedAt)));
  return clusters
    .map((cluster) => {
      const items = members.filter((member) => member.clusterId === cluster.id);
      return {
        id: cluster.id,
        title: cluster.title,
        topNeed: cluster.topNeed,
        demand: cluster.demand,
        representativeQuotes: cluster.representativeQuotes,
        feedbackIds: items.map((item) => item.id),
        votes: items.reduce((total, item) => total + item.votes, 0),
        comments: items.reduce((total, item) => total + item.comments, 0),
      };
    })
    .filter((cluster) => cluster.feedbackIds.length > 0)
    .sort((a, b) => b.votes - a.votes);
}

/** Replaces the workspace's clusters with a fresh grouping (from the AI service). */
export async function replaceClusters(
  actor: Actor,
  groups: { title: string; topNeed: string; demand: Priority; representativeQuotes: string[]; feedbackIds: string[] }[],
  aiGenerationId: string | null,
) {
  await db.transaction(async (tx) => {
    await tx.update(feedback).set({ clusterId: null }).where(eq(feedback.workspaceId, actor.workspaceId));
    await tx.delete(feedbackClusters).where(eq(feedbackClusters.workspaceId, actor.workspaceId));
    for (const group of groups) {
      if (group.feedbackIds.length === 0) continue;
      const [cluster] = await tx
        .insert(feedbackClusters)
        .values({ workspaceId: actor.workspaceId, title: group.title, topNeed: group.topNeed, demand: group.demand, representativeQuotes: group.representativeQuotes, aiGenerationId })
        .returning({ id: feedbackClusters.id });
      await tx
        .update(feedback)
        .set({ clusterId: cluster!.id })
        .where(and(eq(feedback.workspaceId, actor.workspaceId), inArray(feedback.id, group.feedbackIds)));
    }
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "feedback", message: `Feedback regrouped into ${groups.length} theme${groups.length === 1 ? "" : "s"}`, link: "/app/feedback", actorUserId: actor.userId, actorName: actor.name });
  });
  return listClusters(actor);
}

export async function clusterableFeedback(actor: Actor) {
  return db
    .select({ id: feedback.id, title: feedback.title, description: feedback.description, tags: feedback.tags, votes: feedback.votes })
    .from(feedback)
    .where(and(eq(feedback.workspaceId, actor.workspaceId), isNull(feedback.mergedIntoId), isNull(feedback.deletedAt), ne(feedback.status, "declined")))
    .orderBy(desc(feedback.votes))
    .limit(300);
}

/** When a release ships, requests linked to it (directly or through the roadmap) close the loop as "shipped". */
export async function markShippedForRelease(tx: DbExecutor, workspaceId: string, releaseId: string) {
  await tx
    .update(roadmapItems)
    .set({ status: "shipped" })
    .where(and(eq(roadmapItems.workspaceId, workspaceId), eq(roadmapItems.linkedReleaseId, releaseId), isNull(roadmapItems.deletedAt)));
  const shippedCondition: SQL = sql`(${feedback.linkedReleaseId} = ${releaseId} or ${feedback.roadmapItemId} in (select id from ${roadmapItems} where linked_release_id = ${releaseId}))`;
  await tx
    .update(feedback)
    .set({ status: "shipped" })
    .where(and(eq(feedback.workspaceId, workspaceId), shippedCondition, sql`${feedback.status} not in ('shipped', 'declined')`));
}
