import { and, asc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { feedback, feedbackClusters, releases, roadmapItems } from "../database/schema.js";
import type { Priority, RoadmapStatus } from "../types/domain.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { emitEvent, track } from "./events.service.js";

type RoadmapInput = {
  title?: string;
  description?: string;
  status?: RoadmapStatus;
  priority?: Priority;
  isPublic?: boolean;
  targetDate?: string | null;
  linkedReleaseId?: string | null;
  linkedFeedbackIds?: string[];
};

/**
 * Votes are derived from linked feedback, so the roadmap always reflects real demand.
 * Outer columns are written fully qualified: Drizzle renders select-list columns
 * unqualified, which would bind to the subquery's own table.
 */
const selection = {
  item: roadmapItems,
  linkedFeedbackIds: sql<string[]>`coalesce((select array_agg(f.id order by f.votes desc) from ${feedback} f where f.roadmap_item_id = "roadmap_items"."id" and f.deleted_at is null and f.merged_into_id is null), '{}')`,
  votes: sql<number>`coalesce((select sum(f.votes)::int from ${feedback} f where f.roadmap_item_id = "roadmap_items"."id" and f.deleted_at is null and f.merged_into_id is null), 0)`,
};

function toRoadmapDto(row: { item: typeof roadmapItems.$inferSelect; linkedFeedbackIds: string[]; votes: number }) {
  return {
    id: row.item.id,
    title: row.item.title,
    description: row.item.description,
    status: row.item.status,
    priority: row.item.priority,
    isPublic: row.item.isPublic,
    position: row.item.position,
    votes: row.votes,
    linkedFeedbackIds: row.linkedFeedbackIds,
    linkedReleaseId: row.item.linkedReleaseId ?? undefined,
    targetDate: row.item.targetDate ?? undefined,
    createdAt: row.item.createdAt.toISOString(),
    updatedAt: row.item.updatedAt.toISOString(),
  };
}

export async function listRoadmap(actor: Actor) {
  const rows = await db
    .select(selection)
    .from(roadmapItems)
    .where(and(eq(roadmapItems.workspaceId, actor.workspaceId), isNull(roadmapItems.deletedAt)))
    .orderBy(asc(roadmapItems.position), asc(roadmapItems.createdAt));
  return rows.map(toRoadmapDto);
}

export async function getRoadmapItem(actor: Actor, id: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select(selection)
    .from(roadmapItems)
    .where(and(eq(roadmapItems.id, id), eq(roadmapItems.workspaceId, actor.workspaceId), isNull(roadmapItems.deletedAt)))
    .limit(1);
  if (!row) throw notFound("ROADMAP_ITEM_NOT_FOUND", "Roadmap item not found.");
  return toRoadmapDto(row);
}

async function assertReleaseLinkable(tx: DbExecutor, workspaceId: string, releaseId: string) {
  const [release] = await tx
    .select({ status: releases.status })
    .from(releases)
    .where(and(eq(releases.id, releaseId), eq(releases.workspaceId, workspaceId), isNull(releases.deletedAt)))
    .limit(1);
  if (!release) throw badRequest("RELEASE_NOT_FOUND", "The selected release no longer exists.");
  if (release.status !== "published") throw badRequest("RELEASE_NOT_PUBLISHED", "Only published releases can be linked to a roadmap item.");
}

/**
 * Feedback → roadmap is many-to-one. Links are set transactionally: requests
 * already on another item are rejected, and ones removed from this item are unlinked.
 */
async function syncFeedbackLinks(tx: DbExecutor, workspaceId: string, roadmapId: string, requestedIds: string[]) {
  const ids = [...new Set(requestedIds)];
  if (ids.length) {
    const rows = await tx
      .select({ id: feedback.id, title: feedback.title, roadmapItemId: feedback.roadmapItemId })
      .from(feedback)
      .where(and(eq(feedback.workspaceId, workspaceId), inArray(feedback.id, ids), isNull(feedback.deletedAt)));
    if (rows.length !== ids.length) throw badRequest("FEEDBACK_NOT_FOUND", "One of the selected feedback requests no longer exists.");
    const elsewhere = rows.find((row) => row.roadmapItemId && row.roadmapItemId !== roadmapId);
    if (elsewhere) throw conflict("FEEDBACK_ALREADY_LINKED", `“${elsewhere.title}” is already linked to another roadmap item.`);
    await tx.update(feedback).set({ roadmapItemId: roadmapId }).where(and(eq(feedback.workspaceId, workspaceId), inArray(feedback.id, ids)));
  }
  await tx
    .update(feedback)
    .set({ roadmapItemId: null })
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.roadmapItemId, roadmapId), ids.length ? notInArray(feedback.id, ids) : undefined));
}

export async function createRoadmapItem(actor: Actor, input: RoadmapInput) {
  const id = await db.transaction(async (tx) => {
    if (input.linkedReleaseId) await assertReleaseLinkable(tx, actor.workspaceId, input.linkedReleaseId);
    const status = input.status ?? "later";
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${roadmapItems.position}) + 1, 0)::int` })
      .from(roadmapItems)
      .where(and(eq(roadmapItems.workspaceId, actor.workspaceId), eq(roadmapItems.status, status)));
    const [item] = await tx
      .insert(roadmapItems)
      .values({
        workspaceId: actor.workspaceId,
        title: input.title?.trim() || "New item",
        description: input.description ?? "",
        status,
        priority: input.priority ?? "medium",
        isPublic: input.isPublic ?? true,
        position: next,
        targetDate: input.targetDate ?? null,
        linkedReleaseId: input.linkedReleaseId ?? null,
        createdBy: actor.userId,
      })
      .returning({ id: roadmapItems.id });
    if (input.linkedFeedbackIds?.length) {
      await syncFeedbackLinks(tx, actor.workspaceId, item!.id, input.linkedFeedbackIds);
      // Linking requests to a planned item moves them out of triage.
      await tx
        .update(feedback)
        .set({ status: "planned" })
        .where(and(eq(feedback.roadmapItemId, item!.id), inArray(feedback.status, ["new", "reviewing"])));
    }
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "roadmap.updated", data: { id: item!.id, action: "created" } });
    return item!.id;
  });
  return getRoadmapItem(actor, id);
}

export async function updateRoadmapItem(actor: Actor, id: string, input: RoadmapInput) {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(roadmapItems)
      .where(and(eq(roadmapItems.id, id), eq(roadmapItems.workspaceId, actor.workspaceId), isNull(roadmapItems.deletedAt)))
      .for("update")
      .limit(1);
    if (!current) throw notFound("ROADMAP_ITEM_NOT_FOUND", "Roadmap item not found.");
    if (input.linkedReleaseId && input.linkedReleaseId !== current.linkedReleaseId) {
      await assertReleaseLinkable(tx, actor.workspaceId, input.linkedReleaseId);
    }
    await tx
      .update(roadmapItems)
      .set({
        updatedAt: new Date(),
        title: input.title?.trim() || undefined,
        description: input.description,
        status: input.status,
        priority: input.priority,
        isPublic: input.isPublic,
        targetDate: input.targetDate,
        linkedReleaseId: input.linkedReleaseId,
      })
      .where(eq(roadmapItems.id, id));
    if (input.linkedFeedbackIds !== undefined) await syncFeedbackLinks(tx, actor.workspaceId, id, input.linkedFeedbackIds);
    if (input.status && input.status !== current.status) {
      await track(tx, { workspaceId: actor.workspaceId, type: "roadmap.updated", properties: { from: current.status, to: input.status } });
    }
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "roadmap.updated", data: { id, action: "updated", status: input.status ?? current.status } });
  });
  return getRoadmapItem(actor, id);
}

export async function deleteRoadmapItem(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .update(roadmapItems)
      .set({ deletedAt: new Date(), linkedReleaseId: null })
      .where(and(eq(roadmapItems.id, id), eq(roadmapItems.workspaceId, actor.workspaceId), isNull(roadmapItems.deletedAt)))
      .returning({ id: roadmapItems.id });
    if (!item) throw notFound("ROADMAP_ITEM_NOT_FOUND", "Roadmap item not found.");
    await tx.update(feedback).set({ roadmapItemId: null }).where(eq(feedback.roadmapItemId, id));
  });
  return { id };
}

/** Persists the order of items within one board column. */
export async function reorderRoadmap(actor: Actor, status: RoadmapStatus, ids: string[]) {
  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: roadmapItems.id })
      .from(roadmapItems)
      .where(and(eq(roadmapItems.workspaceId, actor.workspaceId), inArray(roadmapItems.id, ids), isNull(roadmapItems.deletedAt)));
    if (owned.length !== new Set(ids).size) throw badRequest("ROADMAP_ITEM_NOT_FOUND", "One of the roadmap items no longer exists.");
    for (const [position, id] of ids.entries()) {
      await tx.update(roadmapItems).set({ position, status }).where(eq(roadmapItems.id, id));
    }
  });
  return listRoadmap(actor);
}

export async function createFromCluster(actor: Actor, clusterId: string) {
  const [cluster] = await db
    .select()
    .from(feedbackClusters)
    .where(and(eq(feedbackClusters.id, clusterId), eq(feedbackClusters.workspaceId, actor.workspaceId)))
    .limit(1);
  if (!cluster) throw notFound("CLUSTER_NOT_FOUND", "That feedback theme no longer exists. Regroup feedback and try again.");
  const members = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.clusterId, clusterId), isNull(feedback.mergedIntoId), isNull(feedback.deletedAt), isNull(feedback.roadmapItemId), ne(feedback.status, "declined")));
  return createRoadmapItem(actor, { title: cluster.title, description: cluster.topNeed, status: "later", linkedFeedbackIds: members.map((member) => member.id) });
}
