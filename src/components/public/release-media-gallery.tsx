"use client";

/* eslint-disable @next/next/no-img-element -- release media URLs are runtime-provided by the future delivery API. */

import { useId, useState } from "react";
import { ImageIcon, Pause, Play, Video } from "lucide-react";
import type { ReleaseMedia } from "@/types";
import { cn } from "@/lib/utils";

function isSafeAssetUrl(value: string | undefined) {
  if (!value) return false;
  return (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value);
}

function isMockVideo(media: ReleaseMedia) {
  return media.type === "video" && media.url.startsWith("mock://");
}

function isRenderableMedia(media: ReleaseMedia) {
  return isMockVideo(media) || isSafeAssetUrl(media.url);
}

function mediaDescription(media: ReleaseMedia) {
  return media.caption?.trim() || media.alt?.trim();
}

function mediaLabel(media: ReleaseMedia, index: number) {
  const type = media.type === "video" ? "Video" : "Image";
  return `${type} ${index + 1}${mediaDescription(media) ? `: ${mediaDescription(media)}` : ""}`;
}

function MediaFallback({ type }: { type: ReleaseMedia["type"] }) {
  const noun = type === "video" ? "video" : "image";

  return (
    <div
      role="status"
      className="flex h-full min-h-56 flex-col items-center justify-center gap-2 bg-surface-subtle px-6 text-center text-muted-foreground"
    >
      {type === "video" ? <Video className="size-6" aria-hidden="true" /> : <ImageIcon className="size-6" aria-hidden="true" />}
      <p className="text-sm font-medium text-foreground">This {noun} preview is unavailable.</p>
      <p className="max-w-sm text-xs leading-relaxed">The update is still available to read. Media delivery will reconnect when the source is available.</p>
    </div>
  );
}

function ReleaseImage({ media, describedBy }: { media: ReleaseMedia; describedBy?: string }) {
  const [failed, setFailed] = useState(false);

  if (!isSafeAssetUrl(media.url) || failed) return <MediaFallback type="image" />;

  return (
    <img
      src={media.url}
      alt={media.alt?.trim() || "Release image"}
      aria-describedby={describedBy}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function MockVideoPreview({ media, describedBy }: { media: ReleaseMedia; describedBy?: string }) {
  const [playing, setPlaying] = useState(false);
  const posterAvailable = isSafeAssetUrl(media.posterUrl);
  const label = media.alt?.trim() || "Release walkthrough";

  return (
    <div
      className="relative h-full min-h-56 overflow-hidden bg-[#151528]"
      role="group"
      aria-label={`${label}, mock video preview`}
      aria-describedby={describedBy}
    >
      {posterAvailable ? (
        <img src={media.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(150,152,255,0.45),transparent_35%),linear-gradient(135deg,#17172d,#302d66)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-pressed={playing}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#25235a] shadow-lg transition-transform hover:scale-105"
        >
          {playing ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5 translate-x-0.5" aria-hidden="true" />}
          <span className="sr-only">{playing ? "Pause" : "Play"} mock video preview</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/30" aria-hidden="true">
            <div className={cn("h-full rounded-full bg-white transition-[width] duration-500", playing ? "w-3/5" : "w-0")} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-white/90">
            <span>Appearance walkthrough</span>
            <span className="shrink-0">0:24</span>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{playing ? "Mock video preview playing." : "Mock video preview paused."}</p>
    </div>
  );
}

function ReleaseVideo({ media, describedBy }: { media: ReleaseMedia; describedBy?: string }) {
  const [failed, setFailed] = useState(false);

  if (isMockVideo(media)) return <MockVideoPreview media={media} describedBy={describedBy} />;
  if (!isSafeAssetUrl(media.url) || failed) return <MediaFallback type="video" />;

  return (
    <video
      key={media.id}
      controls
      playsInline
      preload="metadata"
      src={media.url}
      poster={isSafeAssetUrl(media.posterUrl) ? media.posterUrl : undefined}
      aria-label={media.alt?.trim() || "Release video"}
      aria-describedby={describedBy}
      className="h-full w-full bg-black object-contain"
      onError={() => setFailed(true)}
    >
      Your browser does not support this video preview.
    </video>
  );
}

/**
 * Public-only media treatment for a published release. The component accepts
 * the same typed `ReleaseMedia` data the editor already stores, so a future
 * upload/CDN service can supply normal URLs without changing the public UI.
 */
export function ReleaseMediaGallery({ media }: { media?: ReleaseMedia[] }) {
  const usableMedia = media?.filter(isRenderableMedia) ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const headingId = useId();
  const captionId = useId();

  if (usableMedia.length === 0) return null;

  const currentIndex = Math.min(activeIndex, usableMedia.length - 1);
  const activeMedia = usableMedia[currentIndex];
  const caption = mediaDescription(activeMedia);

  return (
    <section className="mt-8" aria-labelledby={headingId}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-base font-semibold">See it in action</h2>
        {usableMedia.length > 1 && <span className="text-xs text-muted-foreground">{currentIndex + 1} of {usableMedia.length}</span>}
      </div>

      <figure className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="aspect-video bg-surface-subtle">
          {activeMedia.type === "image" ? (
            <ReleaseImage key={`${activeMedia.id}:${activeMedia.url}`} media={activeMedia} describedBy={caption ? captionId : undefined} />
          ) : (
            <ReleaseVideo key={`${activeMedia.id}:${activeMedia.url}`} media={activeMedia} describedBy={caption ? captionId : undefined} />
          )}
        </div>
        {caption && <figcaption id={captionId} className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">{caption}</figcaption>}
      </figure>

      {usableMedia.length > 1 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Choose release media">
          {usableMedia.map((item, index) => {
            const selected = index === currentIndex;
            const Icon = item.type === "video" ? Video : ImageIcon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-pressed={selected}
                aria-label={`Show ${mediaLabel(item, index)}`}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "border-primary/45 bg-primary/5 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{item.type === "video" ? "Video walkthrough" : "Product image"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{mediaDescription(item) || "Release media"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
