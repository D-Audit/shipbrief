"use client";

import { useSession } from "@/components/session/session-provider";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileText,
  PenLine,
  Plus,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { activityService, overviewService, releaseService, type OverviewAttentionItem } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorState, InlineLink, SectionHeader, StatusBadge } from "@/components/shared/page-states";
import { ChannelIcons } from "@/components/shared/channel-meta";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { IconTile } from "@/components/shared/icon-tile";
import type { Tone } from "@/lib/tones";

const attentionIcons: Record<OverviewAttentionItem["kind"], LucideIcon> = {
  review: CircleDashed,
  approved: CheckCircle2,
  draft: FileText,
  cluster: Users,
  delivery: Webhook,
  scheduled: CalendarClock,
};

const attentionTones: Record<OverviewAttentionItem["kind"], Tone> = {
  review: "neutral",
  approved: "neutral",
  draft: "neutral",
  cluster: "neutral",
  delivery: "red",
  scheduled: "rose",
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function scheduleLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "h:mm a")}`;
  return format(date, "EEE, MMM d · h:mm a");
}

export function OverviewPage() {
  const { session } = useSession();
  const { state: overviewState, reload } = useAsyncData(() => overviewService.get(), []);
  const { state: releasesState } = useAsyncData(() => releaseService.list(), []);
  const { state: activityState } = useAsyncData(() => activityService.list(), []);

  if (overviewState.status === "error") {
    return <ErrorState message={overviewState.error} onRetry={reload} />;
  }

  const overview = overviewState.status === "success" ? overviewState.data : null;
  const releases = releasesState.status === "success" ? releasesState.data.slice(0, 5) : null;
  const activity = activityState.status === "success" ? activityState.data.slice(0, 6) : null;
  const decisions = overview?.attention.length ?? 0;

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="sb-eyebrow">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="sb-title-page mt-2 text-[2.125rem]">
            {greeting()}, {overview?.userName ?? session.user.name.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {overview
              ? decisions > 0
                ? `${decisions} thing${decisions === 1 ? "" : "s"} need${decisions === 1 ? "s" : ""} your attention.`
                : "Everything is moving. Nothing needs you right now."
              : "Gathering what changed since you were last here…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app/ai-studio" variant="outline"><PenLine />AI Studio</ButtonLink>
          <ButtonLink href="/app/releases/new"><Plus />Create release</ButtonLink>
        </div>
      </header>

      <section aria-label="Last 90 days" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {overview ? (
          <>
            <Stat label="Published" value={overview.metrics.published} trend={overview.metrics.publishedTrend} href="/app/releases?status=published" />
            <Stat label="Feedback" value={overview.metrics.feedback.toLocaleString()} hint={`+${overview.metrics.feedbackNew} this week`} href="/app/feedback" />
            <Stat label="Engagement" value={`${overview.metrics.engagement}%`} trend={overview.metrics.engagementTrend} href="/app/analytics" />
            <Stat
              label="Scheduled"
              value={overview.metrics.scheduled}
              hint={overview.metrics.nextScheduledAt ? scheduleLabel(overview.metrics.nextScheduledAt) : "Nothing queued"}
              href="/app/releases?status=scheduled"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="sb-panel p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-6 w-14" />
            </div>
          ))
        )}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="attention-heading">
            <SectionHeader id="attention-heading" title="Needs attention" />
            <ul className="sb-panel mt-3 divide-y divide-border px-4">
              {!overview && <ListSkeleton rows={3} />}
              {overview && overview.attention.length === 0 && (
                <li className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-success" />
                  You&apos;re clear. New reviews and customer signals will show up here.
                </li>
              )}
              {overview?.attention.map((item) => {
                const Icon = attentionIcons[item.kind];
                return (
                  <li key={item.id}>
                    <Link href={item.href} className="group -mx-2 flex items-center gap-3.5 rounded-md px-2 py-3 transition-colors hover:bg-foreground/[0.03]">
                      <IconTile icon={Icon} tone={attentionTones[item.kind]} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors group-hover:text-foreground sm:inline-flex">
                        {item.action}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="recent-releases-heading">
            <SectionHeader id="recent-releases-heading" title="Recent releases" action={<InlineLink href="/app/releases">All releases</InlineLink>} />
            <ul className="sb-panel mt-3 divide-y divide-border px-4">
              {!releases && <ListSkeleton rows={4} />}
              {releases?.map((release) => (
                <li key={release.id}>
                  <Link href={`/app/releases/${release.id}`} className="-mx-2 flex items-center gap-3.5 rounded-md px-2 py-3 transition-colors hover:bg-foreground/[0.03]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{release.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {release.category} · {formatDistanceToNow(new Date(release.updatedAt), { addSuffix: true })}
                      </span>
                    </span>
                    <span className="hidden md:block"><ChannelIcons channels={release.channels} /></span>
                    <StatusBadge status={release.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section aria-labelledby="up-next-heading" className="rounded-[var(--radius-xl)] sb-feature p-5">
            <div className="flex items-center justify-between">
              <h2 id="up-next-heading" className="sb-title-section text-ink-foreground">Up next</h2>
              <CalendarClock className="size-4 text-ink-foreground/50" aria-hidden="true" />
            </div>
            <ul className="mt-4 space-y-3">
              {!overview && <Skeleton className="h-16 rounded-[var(--radius-lg)] bg-ink-foreground/10" />}
              {overview && overview.upcoming.length === 0 && (
                <li className="text-sm text-ink-foreground/60">Nothing queued. Approved releases appear here until they go out.</li>
              )}
              {overview?.upcoming.map((release) => (
                <li key={release.id}>
                  <Link href={`/app/releases/${release.id}`} className="group flex items-center gap-3 rounded-lg bg-ink-foreground/[0.07] px-3 py-2.5 transition-colors hover:bg-ink-foreground/[0.12]">
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", release.status === "scheduled" ? "bg-primary-strong" : "bg-ink-foreground/50")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{release.title}</span>
                      <span className="block text-xs text-ink-foreground/60">
                        {release.status === "scheduled" ? scheduleLabel(release.scheduledAt) : "Approved · ready to publish"}
                      </span>
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-ink-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="signals-heading" className="sb-panel p-4">
            <SectionHeader id="signals-heading" title="Customer signals" action={<InlineLink href="/app/feedback">Feedback</InlineLink>} />
            <ul className="mt-3 space-y-4">
              {!overview && <Skeleton className="h-28 rounded-[var(--radius-lg)]" />}
              {overview?.signals.map((signal) => {
                const max = overview.signals[0]?.votes || 1;
                return (
                  <li key={signal.id}>
                    <Link href={`/app/feedback/${signal.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium group-hover:underline group-hover:underline-offset-4">{signal.title}</span>
                        <span className="sb-numeric shrink-0 text-xs text-muted-foreground">{signal.votes}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground/40" style={{ width: `${Math.max(8, (signal.votes / max) * 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {signal.roadmapStatus ? `Roadmap · ${signal.roadmapStatus === "now" ? "Now" : signal.roadmapStatus === "next" ? "Next" : "Later"}` : "Not on the roadmap"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="activity-heading" className="sb-panel p-4">
            <SectionHeader id="activity-heading" title="Recent activity" action={<InlineLink href="/app/activity">All</InlineLink>} />
            <ol className="mt-3 space-y-3.5">
              {!activity && <Skeleton className="h-32 rounded-[var(--radius-lg)]" />}
              {activity?.map((event) => (
                <li key={event.id} className="relative pl-4">
                  <span aria-hidden="true" className={cn("absolute top-[6px] left-0 size-2 rounded-full", event.read ? "bg-border-strong" : "bg-primary-strong")} />
                  <Link href={event.link ?? "/app/activity"} className="block text-[13px] leading-snug hover:underline hover:underline-offset-4">
                    {event.message}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, trend, href }: { label: string; value: string | number; hint?: string; trend?: number; href: string }) {
  return (
    <Link href={href} className="group sb-panel block p-4 transition-colors hover:border-border-strong">
      <p className="text-[13px] text-muted-foreground group-hover:text-foreground">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="sb-stat">{value}</span>
        {typeof trend === "number" && (
          <span className={cn("sb-numeric text-xs", trend >= 0 ? "text-success" : "text-danger")}>
            {trend >= 0 ? "+" : "−"}
            {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </p>
    </Link>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} role="status" aria-label="Loading" className="space-y-2 py-3.5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-1/4" />
        </li>
      ))}
    </>
  );
}
