import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { activityEvents, activityReads, memberships } from "../database/schema.js";
import { notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";

export type ActivityType = (typeof activityEvents.$inferInsert)["type"];

/** Workspace activity feed (also the in-app notification centre). */
export async function recordActivity(
  executor: DbExecutor,
  input: { workspaceId: string; type: ActivityType; message: string; link?: string; actorUserId?: string | null; actorName?: string | null },
) {
  const [event] = await executor
    .insert(activityEvents)
    .values({
      workspaceId: input.workspaceId,
      type: input.type,
      message: input.message,
      link: input.link ?? null,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
    })
    .returning({ id: activityEvents.id });
  return event!.id;
}

function readAllAt(actor: Actor) {
  return db
    .select({ at: memberships.activityReadAllAt })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, actor.workspaceId), eq(memberships.userId, actor.userId)))
    .limit(1)
    .then((rows) => rows[0]?.at ?? null);
}

export async function listActivity(actor: Actor, filters: { unreadOnly?: boolean; type?: ActivityType; limit: number }) {
  const watermark = await readAllAt(actor);
  const readExpression = sql<boolean>`(${activityReads.eventId} is not null ${watermark ? sql`or ${activityEvents.createdAt} <= ${watermark.toISOString()}` : sql``})`;

  const rows = await db
    .select({
      id: activityEvents.id,
      type: activityEvents.type,
      message: activityEvents.message,
      link: activityEvents.link,
      actor: activityEvents.actorName,
      timestamp: activityEvents.createdAt,
      read: readExpression,
    })
    .from(activityEvents)
    .leftJoin(activityReads, and(eq(activityReads.eventId, activityEvents.id), eq(activityReads.userId, actor.userId)))
    .where(
      and(
        eq(activityEvents.workspaceId, actor.workspaceId),
        filters.type ? eq(activityEvents.type, filters.type) : undefined,
        filters.unreadOnly
          ? and(isNull(activityReads.eventId), watermark ? gt(activityEvents.createdAt, watermark) : undefined)
          : undefined,
      ),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(filters.limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    link: row.link ?? undefined,
    actor: row.actor ?? undefined,
    timestamp: row.timestamp.toISOString(),
    read: Boolean(row.read),
  }));
}

export async function markActivityRead(actor: Actor, eventId: string) {
  const [event] = await db
    .select({ id: activityEvents.id, type: activityEvents.type, message: activityEvents.message, link: activityEvents.link, actor: activityEvents.actorName, timestamp: activityEvents.createdAt })
    .from(activityEvents)
    .where(and(eq(activityEvents.id, eventId), eq(activityEvents.workspaceId, actor.workspaceId)))
    .limit(1);
  if (!event) throw notFound("ACTIVITY_NOT_FOUND", "Activity event not found.");
  await db.insert(activityReads).values({ userId: actor.userId, eventId }).onConflictDoNothing();
  return { id: event.id, type: event.type, message: event.message, link: event.link ?? undefined, actor: event.actor ?? undefined, timestamp: event.timestamp.toISOString(), read: true };
}

export async function markAllActivityRead(actor: Actor) {
  await db
    .update(memberships)
    .set({ activityReadAllAt: new Date() })
    .where(and(eq(memberships.workspaceId, actor.workspaceId), eq(memberships.userId, actor.userId)));
  // Per-event rows are now redundant for this workspace; the watermark covers them.
  await db.delete(activityReads).where(
    and(
      eq(activityReads.userId, actor.userId),
      inArray(activityReads.eventId, db.select({ id: activityEvents.id }).from(activityEvents).where(eq(activityEvents.workspaceId, actor.workspaceId))),
    ),
  );
  return listActivity(actor, { limit: 100 });
}
