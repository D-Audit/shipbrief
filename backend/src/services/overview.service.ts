import { and, desc, eq, gte, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { campaigns, feedback, feedbackClusters, releases, roadmapItems, webhookDeliveries } from "../database/schema.js";
import type { Actor } from "../utils/http.js";
import { engagementSummary } from "./analytics.service.js";
import { listReleases } from "./release.service.js";

type AttentionItem = { id: string; kind: "review" | "approved" | "draft" | "cluster" | "delivery" | "scheduled"; title: string; detail: string; href: string; action: string };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** One aggregate for the Overview page, computed with a handful of indexed queries. */
export async function getOverview(actor: Actor) {
  const ws = actor.workspaceId;
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const [inReview, approved, drafts, scheduled] = await Promise.all(
    (["in_review", "approved", "draft", "scheduled"] as const).map((status) =>
      listReleases(actor, { status, sort: status === "scheduled" ? "oldest" : "updated", page: 1, pageSize: status === "draft" ? 2 : 20 }),
    ),
  );
  scheduled!.items.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());

  const [publishedStats] = await db
    .select({
      total: sql<number>`count(*) filter (where ${releases.status} = 'published')::int`,
      recent: sql<number>`count(*) filter (where ${releases.publishedAt} >= ${new Date(now - 30 * day).toISOString()})::int`,
      previous: sql<number>`count(*) filter (where ${releases.publishedAt} >= ${new Date(now - 60 * day).toISOString()} and ${releases.publishedAt} < ${new Date(now - 30 * day).toISOString()})::int`,
    })
    .from(releases)
    .where(and(eq(releases.workspaceId, ws), isNull(releases.deletedAt)));

  const [feedbackStats] = await db
    .select({ votes: sql<number>`coalesce(sum(${feedback.votes}), 0)::int`, recent: sql<number>`count(*) filter (where ${feedback.createdAt} >= ${new Date(now - 7 * day).toISOString()})::int` })
    .from(feedback)
    .where(and(eq(feedback.workspaceId, ws), isNull(feedback.mergedIntoId), isNull(feedback.deletedAt)));

  const undecidedClusters = await db
    .select({
      id: feedbackClusters.id,
      title: feedbackClusters.title,
      requests: sql<number>`(select count(*)::int from ${feedback} f where f.cluster_id = "feedback_clusters"."id" and f.merged_into_id is null)`,
      votes: sql<number>`(select coalesce(sum(f.votes), 0)::int from ${feedback} f where f.cluster_id = "feedback_clusters"."id" and f.merged_into_id is null)`,
    })
    .from(feedbackClusters)
    .where(and(eq(feedbackClusters.workspaceId, ws), sql`not exists (select 1 from ${feedback} f where f.cluster_id = "feedback_clusters"."id" and f.roadmap_item_id is not null)`))
    .orderBy(desc(sql`4`))
    .limit(2);

  const [failures] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.workspaceId, ws), eq(webhookDeliveries.status, "failed"), gte(webhookDeliveries.createdAt, new Date(now - 7 * day))));
  const failedCampaigns = await db.select({ id: campaigns.id, subject: campaigns.subject }).from(campaigns).where(and(eq(campaigns.workspaceId, ws), eq(campaigns.status, "failed"))).limit(2);

  const signals = await db
    .select({ row: feedback, roadmapStatus: roadmapItems.status })
    .from(feedback)
    .leftJoin(roadmapItems, eq(roadmapItems.id, feedback.roadmapItemId))
    .where(and(eq(feedback.workspaceId, ws), isNull(feedback.mergedIntoId), isNull(feedback.deletedAt), notInArray(feedback.status, ["shipped", "declined"])))
    .orderBy(desc(feedback.votes))
    .limit(4);

  const engagement = await engagementSummary(ws, "30d");

  const attention: AttentionItem[] = [
    ...inReview!.items.map((release) => ({ id: `review_${release.id}`, kind: "review" as const, title: `“${release.title}” is waiting for approval`, detail: `${plural(release.channels.length, "channel")} · submitted for review`, href: `/app/releases/${release.id}`, action: "Review" })),
    ...approved!.items.map((release) => ({ id: `approved_${release.id}`, kind: "approved" as const, title: `“${release.title}” is approved and ready to go out`, detail: "Schedule it or publish now", href: `/app/releases/${release.id}`, action: "Publish" })),
    ...drafts!.items.map((release) => ({ id: `draft_${release.id}`, kind: "draft" as const, title: `Draft “${release.title}” hasn’t been submitted`, detail: release.sourceRefs[0] ? `Detected from ${release.sourceRefs[0].label}` : "Started manually", href: `/app/releases/${release.id}`, action: "Continue" })),
    ...undecidedClusters.map((cluster) => ({ id: `cluster_${cluster.id}`, kind: "cluster" as const, title: `${cluster.votes} customers are asking for ${cluster.title}`, detail: `${plural(cluster.requests, "related request")} · not on the roadmap yet`, href: "/app/feedback", action: "Decide" })),
    ...(failures && failures.count > 0 ? [{ id: "delivery_failed", kind: "delivery" as const, title: `${failures.count} webhook deliver${failures.count === 1 ? "y" : "ies"} failed`, detail: "An endpoint returned an error", href: "/app/api", action: "Inspect" }] : []),
    ...failedCampaigns.map((campaign) => ({ id: `campaign_${campaign.id}`, kind: "delivery" as const, title: `Email “${campaign.subject}” failed to send`, detail: "Check the email provider configuration", href: "/app/campaigns", action: "Inspect" })),
  ];

  const previous = publishedStats?.previous ?? 0;
  return {
    userName: actor.name.split(" ")[0] ?? actor.name,
    metrics: {
      published: publishedStats?.total ?? 0,
      publishedTrend: previous ? Math.round((((publishedStats?.recent ?? 0) - previous) / previous) * 100) : (publishedStats?.recent ?? 0) > 0 ? 100 : 0,
      feedback: feedbackStats?.votes ?? 0,
      feedbackNew: feedbackStats?.recent ?? 0,
      engagement: engagement.engagement,
      engagementTrend: engagement.trend,
      scheduled: scheduled!.total,
      nextScheduledAt: scheduled!.items[0]?.scheduledAt,
    },
    attention,
    upcoming: [...approved!.items, ...scheduled!.items].slice(0, 3),
    signals: signals.map(({ row, roadmapStatus }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      votes: row.votes,
      comments: row.comments,
      status: row.status,
      tags: row.tags,
      priority: row.priority,
      source: row.source,
      roadmapItemId: row.roadmapItemId ?? undefined,
      createdAt: row.createdAt.toISOString(),
      roadmapStatus: roadmapStatus ?? undefined,
    })),
  };
}

