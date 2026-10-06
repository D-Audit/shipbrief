"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { publicEngagementService, type PublicWorkspace } from "@/lib/services";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import type { PublicRelease } from "@/types";
import { changelogHome, formatPublicDate } from "./public-format";
import { PublicHeader } from "./public-header";
import { PublicEngagement } from "./public-engagement";
import { PublicSubscribe } from "./public-subscribe";
import { ReleaseMediaGallery } from "./release-media-gallery";

export function PublicUpdatePage({ workspace, release, basePath }: { workspace: PublicWorkspace; release: PublicRelease; basePath: string }) {
  useEffect(() => {
    publicEngagementService.recordView(workspace.slug, release.slug).catch(() => undefined);
  }, [workspace.slug, release.slug]);

  return (
    <div className="min-h-full bg-background">
      <PublicHeader workspace={workspace.slug} name={workspace.name} branding={workspace.branding} basePath={basePath} rssUrl={workspace.rssUrl} />
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href={changelogHome(basePath)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />All updates
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{release.category}</span>
          <span aria-hidden="true">/</span>
          <time dateTime={release.publishedAt}>{formatPublicDate(release.publishedAt)}</time>
          {release.author && <><span aria-hidden="true">/</span><span>{release.author.name}</span></>}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{release.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{release.summary}</p>
        <RichTextPreview html={release.body} className="mt-8" />
        <ReleaseMediaGallery media={release.media} />
        {release.cta && <a href={release.cta.url} onClick={() => publicEngagementService.recordClick(workspace.slug, release.slug).catch(() => undefined)} className="mt-8 inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">{release.cta.label}</a>}
        {release.tags.length > 0 && <p className="mt-8 flex flex-wrap gap-3 text-xs text-muted-foreground">{release.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p>}
        <div className="mt-10"><PublicEngagement workspace={workspace.slug} slug={release.slug} /></div>
        {workspace.settings.allowSubscriptions && <PublicSubscribe workspace={workspace.slug} workspaceName={workspace.name} className="mt-10" />}
      </article>
    </div>
  );
}
