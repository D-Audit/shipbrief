"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { overviewService, releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  StatusBadge,
} from "@/components/shared/page-states";
import { Typography } from "@/components/ui/typography";

export function OverviewPage() {
  const { state: overviewState, reload } = useAsyncData(() => overviewService.get(), []);
  const { state: releasesState } = useAsyncData(() => releaseService.list(), []);

  if (overviewState.status === "loading" || overviewState.status === "idle" || releasesState.status === "loading" || releasesState.status === "idle") {
    return <LoadingState rows={5} />;
  }

  if (overviewState.status === "error") {
    return <ErrorState message={overviewState.error} onRetry={reload} />;
  }

  if (overviewState.status !== "success") {
    return <EmptyState title="No overview data" description="Your dashboard will populate as you publish releases." />;
  }

  const overview = overviewState.data;
  const releases = releasesState.status === "success" ? releasesState.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${overview.greeting}, ${overview.userName}`}
        description="What is happening with your product communication?"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Releases" value={overview.metrics.releases} href="/app/releases" />
        <MetricCard label="Drafts" value={overview.metrics.drafts} href="/app/releases?status=draft" />
        <MetricCard label="Views" value={`${(overview.metrics.views / 1000).toFixed(1)}k`} href="/app/analytics" />
        <MetricCard label="Engagement" value={overview.metrics.engagement} suffix="%" href="/app/analytics" />
      </div>

      <section className="space-y-3">
        <Typography variant="section-title">Attention</Typography>
        <div className="space-y-2">
          {overview.attention.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-subtle"
            >
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span className="flex-1 text-sm">{item.message}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Typography variant="section-title">Recent releases</Typography>
            <Link href="/app/releases" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {releases.slice(0, 4).map((release) => (
              <Link
                key={release.id}
                href={`/app/releases/${release.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-subtle"
              >
                <div>
                  <p className="text-sm font-medium">{release.title}</p>
                  <p className="text-xs text-muted-foreground">{release.category}</p>
                </div>
                <StatusBadge status={release.status} />
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Typography variant="section-title">Customer signals</Typography>
          <div className="space-y-2">
            {overview.customerSignals.map((signal) => (
              <Link
                key={signal.id}
                href={signal.href}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-subtle"
              >
                <span className="text-sm font-medium">{signal.title}</span>
                <span className="text-xs text-muted-foreground">{signal.votes} votes</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
