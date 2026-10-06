"use client";

import { useCallback, useEffect } from "react";
import { brandingService, changelogService, publicEngagementService } from "@/lib/services";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { PublicHeader } from "./public-header";
import { PublicSubscribe } from "./public-subscribe";
import { UpdateCard } from "./update-card";

export function PublicChangelogPage({ workspace }: { workspace: string }) {
  const fetchChangelog = useCallback(async () => {
    const [releases, publicWorkspace] = await Promise.all([
      changelogService.getPublicList(workspace),
      brandingService.getPublic(workspace),
    ]);
    return { releases, branding: publicWorkspace.branding, name: publicWorkspace.name };
  }, [workspace]);
  const { state, reload } = useAsyncData(fetchChangelog, [workspace]);

  useEffect(() => {
    // Analytics only; a failed beacon must never affect the page.
    publicEngagementService.recordView(workspace).catch(() => undefined);
  }, [workspace]);

  if (state.status === "idle" || state.status === "loading") return <div className="mx-auto max-w-2xl p-8"><LoadingState /></div>;
  if (state.status === "error") return <div className="mx-auto max-w-2xl p-8"><ErrorState message={state.error} onRetry={() => void reload()} /></div>;
  if (state.status !== "success") return <div className="mx-auto max-w-2xl p-8"><ErrorState message="Unable to load this changelog." onRetry={() => void reload()} /></div>;

  const { releases, branding, name } = state.data;

  const featured = releases.find((release) => release.featured);

  return (
    <div className="min-h-full bg-background">
      <PublicHeader workspace={workspace} branding={branding} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <PublicSubscribe workspace={workspace} workspaceName={name} className="mb-8" />
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
