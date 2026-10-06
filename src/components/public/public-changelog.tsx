"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { changelogService, publicEngagementService, type PublicWorkspace } from "@/lib/services";
import { EmptyState } from "@/components/shared/page-states";
import { Button } from "@/components/ui/button";
import type { PublicRelease } from "@/types";
import { PublicHeader } from "./public-header";
import { PublicSubscribe } from "./public-subscribe";
import { UpdateCard } from "./update-card";

/**
 * The public changelog. The first page arrives server-rendered; older updates
 * load on demand. `basePath` is "/c/[workspace]" on ShipBrief and "" on the
 * workspace's custom domain.
 */
export function PublicChangelogPage({
  workspace,
  basePath,
  initialReleases,
  initialHasMore,
}: {
  workspace: PublicWorkspace;
  basePath: string;
  initialReleases: PublicRelease[];
  initialHasMore: boolean;
}) {
  const [releases, setReleases] = useState(initialReleases);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Analytics only; a failed beacon must never affect the page.
    publicEngagementService.recordView(workspace.slug).catch(() => undefined);
  }, [workspace.slug]);

  const loadMore = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await changelogService.getPublicPage(workspace.slug, page + 1);
      setReleases((current) => [...current, ...next.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setPage(page + 1);
      setHasMore(next.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Older updates couldn't load.");
    } finally {
      setLoading(false);
    }
  };

  const featured = initialReleases.find((release) => release.featured);

  return (
    <div className="min-h-full bg-background">
      <PublicHeader workspace={workspace.slug} name={workspace.name} branding={workspace.branding} basePath={basePath} rssUrl={workspace.rssUrl} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <h1 className="sb-title-page">What&apos;s new</h1>
          <p className="mt-2 text-muted-foreground">New features, improvements and fixes in {workspace.name}.</p>
        </div>
        {workspace.settings.allowSubscriptions && <PublicSubscribe workspace={workspace.slug} workspaceName={workspace.name} className="mb-10" />}
        {featured && <div className="mb-8"><UpdateCard basePath={basePath} release={featured} featured /></div>}
        {releases.length === 0 ? (
          <EmptyState title="No updates yet" description="Published product updates will appear here." />
        ) : (
          <div className="space-y-6">
            {releases.filter((release) => release.id !== featured?.id).map((release) => (
              <UpdateCard key={release.id} basePath={basePath} release={release} />
            ))}
          </div>
        )}
        {hasMore && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}Load older updates
            </Button>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
