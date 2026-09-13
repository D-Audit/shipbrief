"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { releaseService } from "@/lib/services";
import { useAsyncData } from "@/hooks/use-async-data";
import { ReleaseCard } from "@/components/releases/release-card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReleaseStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: ReleaseStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

function ReleasesPageContent() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as ReleaseStatus | null) ?? "all";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | "all">(initialStatus);

  const { state, reload } = useAsyncData(
    () =>
      releaseService.list({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    [search, statusFilter]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Releases"
        description="Manage product updates from draft to publish."
        actions={
          <Link href="/app/releases/new">
            <Button>
              <Plus />
              New release
            </Button>
          </Link>
        }
      />

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as ReleaseStatus | "all")}
      >
        <TabsList className="flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Input
        placeholder="Search releases…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {state.status === "loading" || state.status === "idle" ? (
        <LoadingState />
      ) : state.status === "error" ? (
        <ErrorState message={state.error} onRetry={reload} />
      ) : state.status === "empty" ? (
        <EmptyState
          title="No releases yet"
          description="Create your first release or connect GitHub to detect work automatically."
          action={
            <Link href="/app/releases/new">
              <Button>Create release</Button>
            </Link>
          }
        />
      ) : (
        <div className={cn("space-y-2")}>
          {state.data.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReleasesPage() {
  return (
    <Suspense fallback={<LoadingState rows={4} />}>
      <ReleasesPageContent />
    </Suspense>
  );
}
