"use client";

import { useCallback } from "react";
import { brandingService, changelogService } from "@/lib/services";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { cn } from "@/lib/utils";
import { PublicHeader } from "./public-header";
import { UpdateCard } from "./update-card";

export function PublicChangelogPage({ workspace }: { workspace: string }) {
  const fetchChangelog = useCallback(async () => {
    const [releases, branding] = await Promise.all([
      changelogService.getPublicList(workspace),
      brandingService.get(),
    ]);
    return { releases, branding };
  }, [workspace]);
  const { state, reload } = useAsyncData(fetchChangelog, [workspace]);

  if (state.status === "idle" || state.status === "loading") return <div className="mx-auto max-w-2xl p-8"><LoadingState /></div>;
  if (state.status === "error") return <div className="mx-auto max-w-2xl p-8"><ErrorState message={state.error} onRetry={() => void reload()} /></div>;
  if (state.status !== "success") return <div className="mx-auto max-w-2xl p-8"><ErrorState message="Unable to load this changelog." onRetry={() => void reload()} /></div>;

  const { releases, branding } = state.data;

  const featured = releases.find((release) => release.featured);

  return (
    <div className={cn("min-h-full bg-background", branding.publicTheme === "dark" && "dark")}>
      <PublicHeader workspace={workspace} branding={branding} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {featured && <div className="mb-8"><UpdateCard workspace={workspace} release={featured} featured /></div>}
        {releases.length === 0 ? (
          <EmptyState title="No updates yet" description="Published product updates will appear here." />
        ) : (
          <div className="space-y-6">
            {releases.filter((release) => release.id !== featured?.id).map((release) => (
              <UpdateCard key={release.id} workspace={workspace} release={release} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
