import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { publishers } from "../channels/publishers.js";
import type { ReleaseRow } from "../channels/types.js";
import { db, type DbExecutor } from "../database/client.js";
import { audiences, releasePublications, releases, releaseVersions, users } from "../database/schema.js";
import type { Channel, ChannelVariantMap, ReleaseSnapshot, ReleaseStatus } from "../types/domain.js";
import { AppError, badRequest, conflict, forbidden, isUniqueViolation, notFound } from "../utils/errors.js";
import { sanitizeRichText } from "../utils/html.js";
import type { Actor } from "../utils/http.js";
import { uniqueSlug } from "../utils/slug.js";
import type { CreateReleaseInput, UpdateReleaseInput } from "../validators/releases.js";
import { recordActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";
import { emitEvent, track } from "./events.service.js";
import { markShippedForRelease } from "./feedback.service.js";
import { notifyWorkspace } from "./notification.service.js";
import { can } from "./permissions.js";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type Transition = "submit" | "approve" | "requestChanges" | "schedule" | "unschedule" | "publish" | "archive";

/**
 * Every allowed status change. Anything not listed is rejected — e.g. a
 * published release can never silently return to draft.
 */
const TRANSITIONS: Record<Transition, { from: ReleaseStatus[]; to: ReleaseStatus; message: string }> = {
  submit: { from: ["draft"], to: "in_review", message: "Only draft releases can be submitted for review." },
  approve: { from: ["in_review"], to: "approved", message: "A release must be in review before it can be approved." },
  requestChanges: { from: ["in_review"], to: "draft", message: "Only releases in review can be sent back." },
  schedule: { from: ["approved"], to: "scheduled", message: "A release must be approved before it can be scheduled." },
  unschedule: { from: ["scheduled"], to: "approved", message: "Only scheduled releases can be unscheduled." },
  publish: { from: ["approved", "scheduled"], to: "published", message: "A release must be approved before it can be published." },
  archive: { from: ["published"], to: "archived", message: "Only published releases can be archived." },
};

export function assertTransition(current: ReleaseStatus, transition: Transition) {
  const rule = TRANSITIONS[transition];
  if (!rule.from.includes(current)) throw conflict("INVALID_STATUS_TRANSITION", rule.message, { from: current, transition });
  return rule.to;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const creator = alias(users, "creator");
const reviewer = alias(users, "reviewer");
const publisher = alias(users, "publisher_user");

const releaseColumns = {
  release: releases,
  createdByName: creator.name,
  reviewedByName: reviewer.name,
  publishedByName: publisher.name,
};

type ReleaseWithNames = { release: ReleaseRow; createdByName: string | null; reviewedByName: string | null; publishedByName: string | null };

export function toReleaseDto(row: ReleaseWithNames, publications?: { channel: Channel; status: string; publishedAt: Date | null; error: string | null }[]) {
  const r = row.release;
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    body: r.body,
    status: r.status,
    channels: r.channels,
    category: r.category,
    tags: r.tags,
    audienceId: r.audienceId ?? undefined,
    scheduledAt: r.scheduledAt?.toISOString(),
    publishedAt: r.publishedAt?.toISOString(),
    sourceRefs: r.sourceRefs,
    views: r.views,
    reactions: r.reactions,
    comments: r.comments,
    featured: r.featured,
    cta: r.cta ?? undefined,
    media: r.media.length ? r.media : undefined,
    channelVariants: Object.keys(r.channelVariants).length ? r.channelVariants : undefined,
    seo: r.seo ?? undefined,
    reviewNote: r.reviewNote ?? undefined,
    createdBy: row.createdByName ?? undefined,
    reviewedBy: row.reviewedByName ?? undefined,
    publishedBy: row.publishedByName ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...(publications
      ? {
          publications: publications.map((p) => ({ channel: p.channel, status: p.status, publishedAt: p.publishedAt?.toISOString(), error: p.error ?? undefined })),
        }
      : {}),
  };
}

export type ReleaseDto = ReturnType<typeof toReleaseDto>;

function selectReleases(executor: DbExecutor = db) {
  return executor
    .select(releaseColumns)
    .from(releases)
    .leftJoin(creator, eq(creator.id, releases.createdBy))
    .leftJoin(reviewer, eq(reviewer.id, releases.reviewedBy))
    .leftJoin(publisher, eq(publisher.id, releases.publishedBy));
}

/** Builds a prefix tsquery ("dark mo" → "dark:* & mo:*") so search works as you type and uses the GIN index. */
export function prefixTsQuery(search: string) {
  const terms = search
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((term) => `${term}:*`).join(" & ") : null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listReleases(
  actor: Actor,
  filters: {
    status?: ReleaseStatus;
    search?: string;
    category?: string;
    tag?: string;
    channel?: Channel;
    sort: "updated" | "newest" | "oldest" | "published";
    page: number;
    pageSize: number;
  },
) {
  const tsQuery = filters.search ? prefixTsQuery(filters.search) : null;
  const conditions: (SQL | undefined)[] = [
    eq(releases.workspaceId, actor.workspaceId),
    isNull(releases.deletedAt),
    filters.status ? eq(releases.status, filters.status) : undefined,
    filters.category ? eq(releases.category, filters.category) : undefined,
    filters.tag ? sql`${releases.tags} @> array[${filters.tag.toLowerCase()}]::text[]` : undefined,
    filters.channel ? sql`${releases.channels} @> array[${filters.channel}]::channel[]` : undefined,
    tsQuery ? sql`${releases.searchVector} @@ to_tsquery('simple', ${tsQuery})` : undefined,
  ];
  const where = and(...conditions);
  const order =
    filters.sort === "newest" ? desc(releases.createdAt)
    : filters.sort === "oldest" ? asc(releases.createdAt)
    : filters.sort === "published" ? sql`${releases.publishedAt} desc nulls last`
    : desc(releases.updatedAt);

  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    selectReleases()
      .where(where)
      .orderBy(order, desc(releases.id))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(releases).where(where),
  ]);
  return { items: rows.map((row) => toReleaseDto(row)), total };
}

export async function releaseCounts(actor: Actor) {
  const rows = await db
    .select({ status: releases.status, count: sql<number>`count(*)::int` })
    .from(releases)
    .where(and(eq(releases.workspaceId, actor.workspaceId), isNull(releases.deletedAt)))
    .groupBy(releases.status);
  const counts: Record<ReleaseStatus | "all", number> = { all: 0, draft: 0, in_review: 0, approved: 0, scheduled: 0, published: 0, archived: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    if (row.status !== "archived") counts.all += row.count;
  }
  return counts;
}

/** Loads a release scoped to the actor's workspace. Other workspaces' ids are indistinguishable from missing ones. */
async function findRelease(executor: DbExecutor, workspaceId: string, id: string, lock = false) {
  const query = executor
    .select()
    .from(releases)
    .where(and(eq(releases.id, id), eq(releases.workspaceId, workspaceId), isNull(releases.deletedAt)))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw notFound("RELEASE_NOT_FOUND", "Release not found.");
  return row;
}

export async function getRelease(actor: Actor, id: string, executor: DbExecutor = db) {
  const [row] = await selectReleases(executor)
    .where(and(eq(releases.id, id), eq(releases.workspaceId, actor.workspaceId), isNull(releases.deletedAt)))
    .limit(1);
  if (!row) throw notFound("RELEASE_NOT_FOUND", "Release not found.");
  const publications = await executor
    .select({ channel: releasePublications.channel, status: releasePublications.status, publishedAt: releasePublications.publishedAt, error: releasePublications.error })
    .from(releasePublications)
    .where(eq(releasePublications.releaseId, id));
  return toReleaseDto(row, publications);
}

// ---------------------------------------------------------------------------
// Create / update / duplicate / delete
// ---------------------------------------------------------------------------

function sanitizeVariants(variants: ChannelVariantMap | undefined): ChannelVariantMap | undefined {
  if (!variants) return undefined;
  const clean: ChannelVariantMap = {};
  for (const [key, variant] of Object.entries(variants) as [keyof ChannelVariantMap, NonNullable<ChannelVariantMap[keyof ChannelVariantMap]>][]) {
    if (variant) (clean as Record<string, unknown>)[key] = { ...variant, body: sanitizeRichText(variant.body) };
  }
  return clean;
}

async function assertAudienceInWorkspace(executor: DbExecutor, workspaceId: string, audienceId: string | null | undefined) {
  if (!audienceId) return;
  const [audience] = await executor
    .select({ id: audiences.id })
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.workspaceId, workspaceId), isNull(audiences.deletedAt)))
    .limit(1);
  if (!audience) throw badRequest("AUDIENCE_NOT_FOUND", "The selected audience no longer exists.");
}

function snapshotOf(release: ReleaseRow): ReleaseSnapshot {
  return {
    title: release.title,
    summary: release.summary,
    body: release.body,
    channels: release.channels,
    audienceId: release.audienceId,
    cta: release.cta ?? null,
    channelVariants: release.channelVariants,
  };
}

async function recordVersion(executor: DbExecutor, release: ReleaseRow, changeNote: string, userId: string | null) {
  const [latest] = await executor
    .select({ version: sql<number>`coalesce(max(${releaseVersions.version}), 0)::int` })
    .from(releaseVersions)
    .where(eq(releaseVersions.releaseId, release.id));
  await executor.insert(releaseVersions).values({
    releaseId: release.id,
    workspaceId: release.workspaceId,
    version: (latest?.version ?? 0) + 1,
    snapshot: snapshotOf(release),
    changeNote,
    changedBy: userId,
  });
}

async function slugTaken(executor: DbExecutor, workspaceId: string, candidate: string, exceptId?: string) {
  const [row] = await executor
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.workspaceId, workspaceId), eq(releases.slug, candidate), isNull(releases.deletedAt), exceptId ? ne(releases.id, exceptId) : undefined))
    .limit(1);
  return Boolean(row);
}

export async function createRelease(actor: Actor, input: CreateReleaseInput, options: { changeNote?: string; executor?: DbExecutor } = {}) {
  const run = async (tx: DbExecutor) => {
    await assertAudienceInWorkspace(tx, actor.workspaceId, input.audienceId);
    const title = input.title?.trim() || "Untitled release";
    const slug = await uniqueSlug(input.slug || title, (candidate) => slugTaken(tx, actor.workspaceId, candidate));
    const [release] = await tx
      .insert(releases)
      .values({
        workspaceId: actor.workspaceId,
        title,
        slug,
        summary: input.summary ?? "",
        body: sanitizeRichText(input.body ?? ""),
        channels: input.channels ?? ["changelog"],
        category: input.category ?? "Feature",
        tags: input.tags ?? [],
        audienceId: input.audienceId ?? null,
        sourceRefs: input.sourceRefs ?? [],
        cta: input.cta ?? null,
        media: input.media ?? [],
        channelVariants: sanitizeVariants(input.channelVariants) ?? {},
        seo: input.seo ?? null,
        featured: input.featured ?? false,
        createdBy: actor.userId,
      })
      .returning();
    await recordVersion(tx, release!, options.changeNote ?? "Release created", actor.userId);
    await track(tx, { workspaceId: actor.workspaceId, type: "release.created", releaseId: release!.id });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.created", data: { id: release!.id, title: release!.title, status: release!.status } });
    return release!.id;
  };
  const id = options.executor ? await run(options.executor) : await db.transaction(run);
  return getRelease(actor, id, options.executor);
}

const CONTENT_FIELDS = ["title", "summary", "body", "channels", "audienceId", "cta", "channelVariants", "media", "slug", "category", "tags", "sourceRefs", "seo"] as const;

export async function updateRelease(actor: Actor, id: string, input: UpdateReleaseInput) {
  await db.transaction(async (tx) => {
    const current = await findRelease(tx, actor.workspaceId, id, true);
    if (current.status === "archived") throw conflict("RELEASE_ARCHIVED", "Archived releases can't be edited.");

    const changesContent = CONTENT_FIELDS.some((field) => input[field] !== undefined);
    // Approval means approval of specific content: once approved, only approvers may change it.
    if (changesContent && ["approved", "scheduled", "published"].includes(current.status) && !can(actor.role, "release:approve")) {
      throw forbidden("This release has been approved. Ask an approver to edit it, or have it sent back to draft.", "RELEASE_LOCKED");
    }
    await assertAudienceInWorkspace(tx, actor.workspaceId, input.audienceId);
    if (input.slug && input.slug !== current.slug && (await slugTaken(tx, actor.workspaceId, input.slug, id))) {
      throw conflict("SLUG_TAKEN", "Another release already uses that URL slug.");
    }

    let updated: ReleaseRow;
    try {
      [updated] = (await tx
        .update(releases)
        .set({
          updatedAt: new Date(),
          title: input.title?.trim() || undefined,
          summary: input.summary,
          body: input.body !== undefined ? sanitizeRichText(input.body) : undefined,
          channels: input.channels,
          category: input.category,
          tags: input.tags,
          audienceId: input.audienceId,
          sourceRefs: input.sourceRefs,
          cta: input.cta,
          media: input.media,
          channelVariants: input.channelVariants !== undefined ? sanitizeVariants(input.channelVariants) : undefined,
          seo: input.seo,
          featured: input.featured,
          slug: input.slug,
        })
        .where(eq(releases.id, id))
        .returning()) as [ReleaseRow];
    } catch (error) {
      if (isUniqueViolation(error, "releases_workspace_slug_key")) throw conflict("SLUG_TAKEN", "Another release already uses that URL slug.");
      throw error;
    }

    if (JSON.stringify(snapshotOf(current)) !== JSON.stringify(snapshotOf(updated))) {
      await recordVersion(tx, updated, input.changeNote ?? "Saved release changes", actor.userId);
      await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.updated", data: { id, title: updated.title, status: updated.status } });
    }
  });
  return getRelease(actor, id);
}

export async function duplicateRelease(actor: Actor, id: string) {
  const source = await findRelease(db, actor.workspaceId, id);
  return createRelease(
    actor,
    {
      title: `${source.title} (copy)`,
      summary: source.summary,
      body: source.body,
      channels: source.channels,
      category: source.category,
      tags: source.tags,
      audienceId: source.audienceId,
      sourceRefs: source.sourceRefs,
      cta: source.cta,
      media: source.media,
      channelVariants: source.channelVariants,
      seo: source.seo,
    },
    { changeNote: `Duplicated from “${source.title}”` },
  );
}

/** Soft delete. Published history is archived, never deleted, so public links and analytics stay intact. */
export async function deleteRelease(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const current = await findRelease(tx, actor.workspaceId, id, true);
    if (current.status === "published" || current.status === "archived") {
      throw conflict("RELEASE_PUBLISHED", "Published releases can't be deleted. Archive it instead.");
    }
    await tx.update(releases).set({ deletedAt: new Date() }).where(eq(releases.id, id));
    await audit({ action: "release.deleted", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "release", targetId: id, metadata: { title: current.title } }, tx);
  });
  return { id };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

function requireChannels(release: ReleaseRow) {
  if (release.channels.length === 0) throw badRequest("NO_CHANNELS", "Select at least one publishing channel before continuing.");
}

export async function submitForReview(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "submit");
    await tx.update(releases).set({ status: to, reviewNote: null }).where(eq(releases.id, id));
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "comment", message: `“${release.title}” submitted for review`, link: `/app/releases/${id}`, actorUserId: actor.userId, actorName: actor.name });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.submitted", data: { id, title: release.title } });
  });
  return getRelease(actor, id);
}

export async function approveRelease(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "approve");
    await tx.update(releases).set({ status: to, reviewedBy: actor.userId, reviewNote: null }).where(eq(releases.id, id));
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "approved", message: `${actor.name.split(" ")[0]} approved “${release.title}”`, link: `/app/releases/${id}`, actorUserId: actor.userId, actorName: actor.name });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.approved", data: { id, title: release.title } });
  });
  const approved = await getRelease(actor, id);
  await notifyWorkspace({ workspaceId: actor.workspaceId, setting: "releaseApproved", message: `“${approved.title}” was approved`, link: `/app/releases/${id}`, exceptUserId: actor.userId });
  return approved;
}

export async function requestChanges(actor: Actor, id: string, note?: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "requestChanges");
    await tx.update(releases).set({ status: to, reviewNote: note?.trim() || null }).where(eq(releases.id, id));
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "comment", message: `Changes requested on “${release.title}”`, link: `/app/releases/${id}`, actorUserId: actor.userId, actorName: actor.name });
  });
  return getRelease(actor, id);
}

export async function scheduleRelease(actor: Actor, id: string, scheduledAtIso: string) {
  const scheduledAt = new Date(scheduledAtIso);
  if (scheduledAt.getTime() < Date.now() - 60_000) throw badRequest("SCHEDULE_IN_PAST", "Choose a time in the future.");
  if (scheduledAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw badRequest("SCHEDULE_TOO_FAR", "Schedule within the next year.");
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "schedule");
    requireChannels(release);
    await tx.update(releases).set({ status: to, scheduledAt, scheduledBy: actor.userId }).where(eq(releases.id, id));
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "scheduled", message: `“${release.title}” scheduled`, link: `/app/releases/${id}`, actorUserId: actor.userId, actorName: actor.name });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.scheduled", data: { id, title: release.title, scheduledAt: scheduledAt.toISOString() } });
  });
  return getRelease(actor, id);
}

export async function unscheduleRelease(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "unschedule");
    await tx.update(releases).set({ status: to, scheduledAt: null, scheduledBy: null }).where(eq(releases.id, id));
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "scheduled", message: `“${release.title}” moved back to approved`, link: `/app/releases/${id}`, actorUserId: actor.userId, actorName: actor.name });
  });
  return getRelease(actor, id);
}

const CHANNEL_LABELS: Record<Channel, string> = { changelog: "Changelog", email: "Email", in_app: "In-app" };

function joinLabels(labels: string[]) {
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Publishes inside one transaction: status change, one publication row per
 * selected channel (each channel's publisher decides what "publish" means),
 * activity, analytics and webhooks. Background delivery (email) is enqueued
 * in the same transaction, so it runs only if the publish commits.
 */
export async function publishReleaseTx(tx: DbExecutor, release: ReleaseRow, actorUserId: string | null, actorName: string | null) {
  const to = assertTransition(release.status, "publish");
  requireChannels(release);
  const now = new Date();
  const [published] = await tx
    .update(releases)
    .set({ status: to, publishedAt: now, publishedBy: actorUserId, scheduledAt: release.status === "scheduled" ? release.scheduledAt : null })
    .where(eq(releases.id, release.id))
    .returning();

  for (const channel of published!.channels) {
    let outcome;
    try {
      outcome = await publishers[channel].publish({ tx, release: published!, actorUserId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      outcome = { status: "failed" as const, error: error instanceof Error ? error.message : "Channel publish failed" };
    }
    await tx
      .insert(releasePublications)
      .values({
        releaseId: release.id,
        workspaceId: release.workspaceId,
        channel,
        status: outcome.status,
        publishedAt: outcome.status === "published" ? now : null,
        error: outcome.error ?? null,
        meta: outcome.meta ?? {},
      })
      .onConflictDoUpdate({
        target: [releasePublications.releaseId, releasePublications.channel],
        set: { status: outcome.status, publishedAt: outcome.status === "published" ? now : null, error: outcome.error ?? null, meta: outcome.meta ?? {} },
      });
  }

  await markShippedForRelease(tx, release.workspaceId, release.id);

  const labels = joinLabels(published!.channels.map((channel) => CHANNEL_LABELS[channel]));
  await recordActivity(tx, { workspaceId: release.workspaceId, type: "published", message: `“${release.title}” published to ${labels}`, link: `/app/releases/${release.id}`, actorUserId, actorName: actorName ?? "ShipBrief scheduler" });
  await track(tx, { workspaceId: release.workspaceId, type: "release.published", releaseId: release.id });
  await emitEvent(tx, { workspaceId: release.workspaceId, event: "release.published", data: { id: release.id, title: release.title, slug: release.slug, channels: published!.channels, publishedAt: now.toISOString() } });
  await audit({ action: "release.published", workspaceId: release.workspaceId, userId: actorUserId, targetType: "release", targetId: release.id }, tx);
  return published!;
}

export async function publishRelease(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    await publishReleaseTx(tx, release, actor.userId, actor.name);
  });
  return getRelease(actor, id);
}

export async function archiveRelease(actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const release = await findRelease(tx, actor.workspaceId, id, true);
    const to = assertTransition(release.status, "archive");
    await tx.update(releases).set({ status: to, archivedAt: new Date() }).where(eq(releases.id, id));
    for (const channel of release.channels) await publishers[channel].withdraw?.({ tx, release, actorUserId: actor.userId });
    await emitEvent(tx, { workspaceId: actor.workspaceId, event: "release.archived", data: { id, title: release.title } });
    await audit({ action: "release.archived", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "release", targetId: id }, tx);
  });
  return getRelease(actor, id);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function listVersions(actor: Actor, id: string) {
  await findRelease(db, actor.workspaceId, id);
  const rows = await db
    .select({ version: releaseVersions, changedByName: users.name })
    .from(releaseVersions)
    .leftJoin(users, eq(users.id, releaseVersions.changedBy))
    .where(and(eq(releaseVersions.releaseId, id), eq(releaseVersions.workspaceId, actor.workspaceId)))
    .orderBy(desc(releaseVersions.version));
  return rows.map(({ version: v, changedByName }) => ({
    id: v.id,
    releaseId: v.releaseId,
    version: v.version,
    title: v.snapshot.title,
    summary: v.snapshot.summary,
    body: v.snapshot.body,
    channels: v.snapshot.channels,
    audienceId: v.snapshot.audienceId ?? undefined,
    cta: v.snapshot.cta ?? undefined,
    channelVariants: v.snapshot.channelVariants,
    changedBy: changedByName ?? "Former member",
    changedAt: v.createdAt.toISOString(),
    changeNote: v.changeNote ?? undefined,
  }));
}

export async function restoreVersion(actor: Actor, id: string, versionId: string) {
  const [version] = await db
    .select()
    .from(releaseVersions)
    .where(and(eq(releaseVersions.id, versionId), eq(releaseVersions.releaseId, id), eq(releaseVersions.workspaceId, actor.workspaceId)))
    .limit(1);
  if (!version) throw notFound("VERSION_NOT_FOUND", "Release version not found.");
  const snapshot = version.snapshot;
  return updateRelease(actor, id, {
    title: snapshot.title,
    summary: snapshot.summary,
    body: snapshot.body,
    channels: snapshot.channels,
    audienceId: snapshot.audienceId,
    cta: snapshot.cta,
    channelVariants: snapshot.channelVariants,
    changeNote: `Restored version ${version.version}`,
  });
}

// ---------------------------------------------------------------------------
// Scheduled publishing (worker)
// ---------------------------------------------------------------------------

/** Publishes every scheduled release whose time has come. Safe to run concurrently (SKIP LOCKED). */
export async function publishDueReleases(limit = 20) {
  let published = 0;
  for (let i = 0; i < limit; i += 1) {
    const done = await db.transaction(async (tx) => {
      const [due] = await tx
        .select()
        .from(releases)
        .where(and(eq(releases.status, "scheduled"), sql`${releases.scheduledAt} <= now()`, isNull(releases.deletedAt)))
        .orderBy(asc(releases.scheduledAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!due) return false;
      const [scheduler] = due.scheduledBy ? await tx.select({ name: users.name }).from(users).where(eq(users.id, due.scheduledBy)).limit(1) : [];
      await publishReleaseTx(tx, due, due.scheduledBy, scheduler?.name ?? null);
      return true;
    });
    if (!done) break;
    published += 1;
  }
  return published;
}
