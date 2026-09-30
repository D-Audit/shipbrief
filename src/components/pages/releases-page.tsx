"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useState } from "react";
import { FileText, GitBranch, Plus, Search } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared/page-states";
import { ChannelIcons } from "@/components/shared/channel-meta";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import type { Release, ReleaseStatus } from "@/types";
import { cn } from "@/lib/utils";

type Filter = ReleaseStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const statusDot: Record<Exclude<Filter, "all">, string> = {
  draft: "bg-border-strong",
  in_review: "bg-warning",
  approved: "bg-foreground",
  scheduled: "bg-primary-strong",
  published: "bg-success",
  archived: "bg-muted-foreground/40",
};

function isFilter(value: string | null): value is Filter {
  return FILTERS.some((filter) => filter.value === value);
}

function timingLabel(release: Release) {
  if (release.status === "scheduled" && release.scheduledAt) return `Goes out ${format(new Date(release.scheduledAt), "MMM d, h:mm a")}`;
  if (release.status === "published" && release.publishedAt) return `Published ${format(new Date(release.publishedAt), "MMM d")}`;
  return `Edited ${formatDistanceToNow(new Date(release.updatedAt), { addSuffix: true })}`;
}

function ReleasesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const statusFilter: Filter = isFilter(statusParam) ? statusParam : "all";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { state, reload } = useAsyncData(
    () =>
      releaseService.list({ search: deferredSearch || undefined, status: statusFilter === "all" ? undefined : statusFilter }).then((items) =>
        statusFilter === "all" ? items.filter((item) => item.status !== "archived") : items
      ),
    [deferredSearch, statusFilter]
  );
  const { state: countsState } = useAsyncData(() => releaseService.counts(), []);
  const counts = countsState.status === "success" ? countsState.data : null;

  const setFilter = (value: Filter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("status");
    else params.set("status", value);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Releases"
        description="Every customer-facing update, from first draft to published."
        actions={<ButtonLink href="/app/releases/new"><Plus />New release</ButtonLink>}
      />

      <div className="flex flex-col gap-3 border-b border-border lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Filter by status" className="sb-scrollbar-none -mb-px flex gap-5 overflow-x-auto">
          {FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setFilter(filter.value)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-sm transition-colors",
                  active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.value !== "all" && <span aria-hidden="true" className={cn("size-1.5 rounded-full", statusDot[filter.value])} />}
                {filter.label}
                {counts && <span className={cn("sb-numeric rounded-full px-1.5 text-xs", active ? "bg-ink text-ink-foreground" : "bg-surface-subtle text-muted-foreground")}>{counts[filter.value]}</span>}
              </button>
            );
          })}
        </nav>
        <div className="relative pb-3 lg:w-72">
          <Search className="pointer-events-none absolute top-[9px] left-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search releases"
            placeholder="Search releases"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 bg-surface pl-8"
          />
        </div>
      </div>

      {(state.status === "loading" || state.status === "idle") && <LoadingState rows={5} />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}
      {state.status === "empty" && (
        search ? (
          <EmptyState icon={Search} title="No releases match your search" description={`Nothing found for “${search}”. Try a different word or clear the filter.`} />
        ) : statusFilter === "all" ? (
          <EmptyState
            icon={FileText}
            title="No releases yet."
            description="Create your first release, or connect GitHub and ShipBrief will draft one when work is merged."
            action={<div className="flex gap-2"><ButtonLink href="/app/releases/new">Create your first release →</ButtonLink><ButtonLink href="/app/integrations" variant="outline">Connect GitHub</ButtonLink></div>}
          />
        ) : (
          <EmptyState icon={FileText} title={`No ${FILTERS.find((filter) => filter.value === statusFilter)?.label.toLowerCase()} releases`} description="Releases will appear here as they move through the workflow." compact />
        )
      )}
      {state.status === "success" && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-border text-left text-xs text-muted-foreground md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Release</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Channels</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Source</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Timing</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((release) => (
                <tr key={release.id} className="relative block border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-surface-subtle/60 md:table-row md:p-0">
                  <td className="block md:table-cell md:max-w-0 md:w-[46%] md:px-5 md:py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0">
                        <Link href={`/app/releases/${release.id}`} className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none">
                          {release.title || "Untitled release"}
                        </Link>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          <span className={release.category.toLowerCase() === "feature" ? "text-primary-strong" : undefined}>{release.category}</span>
                          {release.summary ? ` · ${release.summary}` : " · No summary yet"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="mt-2 inline-block md:mt-0 md:table-cell md:px-3 md:py-3.5"><StatusBadge status={release.status} /></td>
                  <td className="ml-3 inline-block align-middle md:ml-0 md:hidden lg:table-cell lg:px-3 lg:py-3.5"><ChannelIcons channels={release.channels} /></td>
                  <td className="hidden max-w-40 px-3 py-3.5 xl:table-cell">
                    {release.sourceRefs[0] ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="size-3.5 shrink-0" />
                        <span className="truncate">{release.sourceRefs[0].label}</span>
                        {release.sourceRefs.length > 1 && <span>+{release.sourceRefs.length - 1}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </td>
                  <td className="sb-numeric mt-1 block text-xs whitespace-nowrap text-muted-foreground md:mt-0 md:table-cell md:px-5 md:py-3.5 md:text-right">
                    {timingLabel(release)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReleasesPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <ReleasesPageContent />
    </Suspense>
  );
}
