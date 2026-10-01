"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { format } from "date-fns";
import { brandingService, changelogService, publicEngagementService } from "@/lib/services";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { useAsyncData } from "@/hooks/use-async-data";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { PublicHeader } from "./public-header";
import { PublicEngagement } from "./public-engagement";
import { ReleaseMediaGallery } from "./release-media-gallery";

export function PublicUpdatePage({ workspace, slug }: { workspace: string; slug: string }) {
  const fetchUpdate = useCallback(async () => {
    const [release, publicWorkspace] = await Promise.all([
      changelogService.getPublic(workspace, slug),
      brandingService.getPublic(workspace),
    ]);
    return { release, branding: publicWorkspace.branding };
  }, [slug, workspace]);
  const { state, reload } = useAsyncData(fetchUpdate, [slug, workspace]);

  useEffect(() => {
    publicEngagementService.recordView(workspace, slug).catch(() => undefined);
  }, [workspace, slug]);

  if (state.status === "idle" || state.status === "loading") return <div className="mx-auto max-w-2xl p-8"><LoadingState /></div>;
  if (state.status === "error") return <div className="mx-auto max-w-2xl p-8"><ErrorState message={state.error} title="Update not found" onRetry={() => void reload()} /></div>;
  if (state.status !== "success") return <div className="mx-auto max-w-2xl p-8"><ErrorState message="Not found" title="Update not found" onRetry={() => void reload()} /></div>;

  const { release, branding } = state.data;

  return (
    <div className="min-h-full bg-background">
      <PublicHeader workspace={workspace} branding={branding} />
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="text-sm text-muted-foreground">
          {release.publishedAt && format(new Date(release.publishedAt), "MMMM d, yyyy")}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{release.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{release.summary}</p>
        <RichTextPreview html={release.body} className="mt-8" />
        <ReleaseMediaGallery media={release.media} />
        {release.cta && <Link href={release.cta.url} onClick={() => publicEngagementService.recordClick(workspace, slug).catch(() => undefined)} className="mt-8 inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">{release.cta.label}</Link>}
        <div className="mt-10"><PublicEngagement workspace={workspace} slug={slug} /></div>
      </article>
    </div>
  );
}
