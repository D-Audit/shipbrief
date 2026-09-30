import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { analyticsDaily, releases, systemState } from "../database/schema.js";
import type { Actor } from "../utils/http.js";

/**
 * Dashboards read `analytics_daily`, never raw events. The worker re-aggregates
 * every (workspace, day) that received new events since the last run, from the
 * raw events of that whole day — so counts and unique visitors are exact and
 * the job is idempotent. Figures lag raw events by at most one roll-up interval.
 */
export async function rollupAnalytics() {
  const [state] = await db.select().from(systemState).where(eq(systemState.key, "analytics_rollup")).limit(1);
  const watermark = Number(state?.value.lastEventId ?? 0);
  const [{ maxId } = { maxId: null }] = await db.execute<{ maxId: number | null }>(sql`select max(id)::bigint as "maxId" from analytics_events where id > ${watermark}`).then((r) => r.rows);
  if (!maxId) return 0;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      with touched as (
        select distinct workspace_id, (occurred_at at time zone 'UTC')::date as day
        from analytics_events where id > ${watermark} and id <= ${maxId}
      )
      insert into analytics_daily (workspace_id, day, type, channel, release_key, count, unique_visitors)
      select e.workspace_id, (e.occurred_at at time zone 'UTC')::date, e.type, coalesce(e.channel, ''), coalesce(e.release_id::text, ''),
             count(*)::int, count(distinct e.visitor_id)::int
      from analytics_events e
      join touched t on t.workspace_id = e.workspace_id and t.day = (e.occurred_at at time zone 'UTC')::date
      group by 1, 2, 3, 4, 5
      on conflict (workspace_id, day, type, channel, release_key)
      do update set count = excluded.count, unique_visitors = excluded.unique_visitors
    `);
    await tx
      .insert(systemState)
      .values({ key: "analytics_rollup", value: { lastEventId: Number(maxId) } })
      .onConflictDoUpdate({ target: systemState.key, set: { value: { lastEventId: Number(maxId) } } });
  });
  return Number(maxId) - watermark;
}

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function rangeStart(range: string, offsetRanges = 0) {
  const days = RANGE_DAYS[range] ?? 30;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days * (offsetRanges + 1) + 1);
  return start.toISOString().slice(0, 10);
}

const VIEW_TYPES = ["release.viewed", "in_app.viewed", "changelog.viewed"];
const CLICK_TYPES = ["cta.clicked", "in_app.clicked"];

async function totals(workspaceId: string, from: string, to?: string) {
  const rows = await db
    .select({ type: analyticsDaily.type, channel: analyticsDaily.channel, count: sql<number>`sum(${analyticsDaily.count})::int` })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, workspaceId), gte(analyticsDaily.day, from), to ? sql`${analyticsDaily.day} < ${to}` : undefined))
    .groupBy(analyticsDaily.type, analyticsDaily.channel);
  const sum = (types: string[]) => rows.filter((row) => types.includes(row.type)).reduce((total, row) => total + row.count, 0);
  const views = sum(["release.viewed", "in_app.viewed"]);
  const clicks = sum(CLICK_TYPES);
  const reactions = sum(["reaction.added"]);
  const comments = sum(["comment.created"]);
  return { rows, views, clicks, ctaClicks: sum(["cta.clicked"]), reactions, comments, engagement: views ? Math.round(((reactions + comments + clicks) / views) * 100) : 0 };
}

export async function engagementSummary(workspaceId: string, range = "30d") {
  const current = await totals(workspaceId, rangeStart(range));
  const previous = await totals(workspaceId, rangeStart(range, 1), rangeStart(range));
  return { engagement: current.engagement, trend: current.engagement - previous.engagement, views: current.views };
}

export async function getOverview(actor: Actor, range: string) {
  const from = rangeStart(range);
  const current = await totals(actor.workspaceId, from);

  const viewsByChannel = new Map<string, number>();
  for (const row of current.rows.filter((row) => VIEW_TYPES.includes(row.type) && row.type !== "changelog.viewed")) {
    const channel = row.channel || "changelog";
    viewsByChannel.set(channel, (viewsByChannel.get(channel) ?? 0) + row.count);
  }
  const emailSent = current.rows.filter((row) => row.type === "email.sent").reduce((total, row) => total + row.count, 0);
  const channelTotal = [...viewsByChannel.values()].reduce((a, b) => a + b, 0);
  const channelBreakdown = [...viewsByChannel.entries()]
    .map(([channel, count]) => ({ channel, percentage: channelTotal ? Math.round((count / channelTotal) * 100) : 0 }))
    .sort((a, b) => b.percentage - a.percentage);

  const perRelease = await db
    .select({
      releaseKey: analyticsDaily.releaseKey,
      views: sql<number>`sum(${analyticsDaily.count}) filter (where ${analyticsDaily.type} in ('release.viewed', 'in_app.viewed'))::int`,
      interactions: sql<number>`sum(${analyticsDaily.count}) filter (where ${analyticsDaily.type} in ('reaction.added', 'comment.created', 'cta.clicked', 'in_app.clicked'))::int`,
    })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, actor.workspaceId), gte(analyticsDaily.day, from), sql`${analyticsDaily.releaseKey} <> ''`))
    .groupBy(analyticsDaily.releaseKey)
    .orderBy(desc(sql`2`))
    .limit(10);

  const ids = perRelease.map((row) => row.releaseKey);
  const titles = ids.length
    ? new Map((await db.select({ id: releases.id, title: releases.title }).from(releases).where(and(eq(releases.workspaceId, actor.workspaceId), inArray(releases.id, ids)))).map((row) => [row.id, row.title]))
    : new Map<string, string>();
  const maxViews = Math.max(1, ...perRelease.map((row) => row.views ?? 0));
  const performance = perRelease
    .filter((row) => titles.has(row.releaseKey))
    .map((row) => {
      const views = row.views ?? 0;
      const engagement = views ? Math.round(((row.interactions ?? 0) / views) * 100) : 0;
      // Score blends engagement rate (60%) with relative reach within the range (40%).
      const score = Math.round(0.6 * Math.min(100, engagement) + 0.4 * ((views / maxViews) * 100));
      return { id: row.releaseKey, title: titles.get(row.releaseKey)!, views, engagement, score };
    });

  return {
    views: current.views,
    clicks: current.clicks,
    ctaClicks: current.ctaClicks,
    reactions: current.reactions,
    engagement: current.engagement,
    emailsSent: emailSent,
    channelBreakdown,
    topReleases: performance.slice(0, 5).map(({ id, title, views, engagement }) => ({ id, title, views, engagement })),
    releasePerformance: [...performance].sort((a, b) => b.score - a.score).slice(0, 5).map(({ id, title, score }) => ({ id, title, score })),
    range,
  };
}

/** CSV export of the daily roll-up for the range. */
export async function exportCsv(actor: Actor, range: string) {
  const rows = await db
    .select({ day: analyticsDaily.day, type: analyticsDaily.type, channel: analyticsDaily.channel, releaseKey: analyticsDaily.releaseKey, count: analyticsDaily.count, uniqueVisitors: analyticsDaily.uniqueVisitors })
    .from(analyticsDaily)
    .where(and(eq(analyticsDaily.workspaceId, actor.workspaceId), gte(analyticsDaily.day, rangeStart(range))))
    .orderBy(analyticsDaily.day, analyticsDaily.type);
  const ids = [...new Set(rows.map((row) => row.releaseKey).filter(Boolean))];
  const titles = ids.length ? new Map((await db.select({ id: releases.id, title: releases.title }).from(releases).where(inArray(releases.id, ids))).map((row) => [row.id, row.title])) : new Map();
  const escape = (value: string | number) => {
    const text = String(value);
    // Quote, and neutralise spreadsheet formulas (CSV injection).
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [["date", "event", "channel", "release", "count", "unique_visitors"].join(",")];
  for (const row of rows) lines.push([row.day, row.type, row.channel, titles.get(row.releaseKey) ?? "", row.count, row.uniqueVisitors].map(escape).join(","));
  return { filename: `shipbrief-analytics-${range}.csv`, csv: `${lines.join("\n")}\n` };
}
