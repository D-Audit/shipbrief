"use client";

import Link from "next/link";
import {
  BellRing,
  Info,
  Megaphone,
  MousePointer2,
  Sparkles,
  X,
} from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { getInAppFormatLabel } from "@/components/channels/in-app-formats";
import { cn } from "@/lib/utils";
import type { InAppFormat, Release } from "@/types";

export type InAppAnnouncementContent = {
  title: string;
  summary: string;
  body: string;
  format: InAppFormat;
};

type InAppAnnouncementProps = {
  content: InAppAnnouncementContent;
  cta?: Release["cta"];
  onDismiss?: () => void;
  onRead?: () => void;
  className?: string;
};

function AnnouncementDismissButton({
  title,
  onDismiss,
  className,
}: {
  title: string;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!onDismiss) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={onDismiss}
      aria-label={`Dismiss ${title}`}
    >
      <X />
    </Button>
  );
}

function AnnouncementCta({
  cta,
  onRead,
  className,
}: {
  cta?: Release["cta"];
  onRead?: () => void;
  className?: string;
}) {
  if (!cta?.label || !cta.url) return null;

  return (
    <Link
      href={cta.url}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={onRead}
    >
      {cta.label}
    </Link>
  );
}

/**
 * The interactive customer-facing counterpart to the AI Studio's visual
 * previews. Delivery and placement are still a backend concern, but this
 * component makes each saved in-app format behave distinctly in the local
 * widget boundary.
 */
export function InAppAnnouncement({
  content,
  cta,
  onDismiss,
  onRead,
  className,
}: InAppAnnouncementProps) {
  const title = content.title || "Untitled release";
  const summary = content.summary || "A short update will appear here.";
  const formatLabel = getInAppFormatLabel(content.format);

  const dismiss = () => onDismiss?.();
  const markRead = () => onRead?.();

  if (content.format === "banner") {
    return (
      <article
        className={cn("relative flex flex-col gap-3 border-b border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-start", className)}
        data-in-app-format="banner"
        role="status"
        aria-label={`${formatLabel}: ${title}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Megaphone className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary">New update</p>
          <h2 className="mt-0.5 text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <AnnouncementCta cta={cta} onRead={markRead} className="mt-3" />
        </div>
        <AnnouncementDismissButton title={title} onDismiss={dismiss} className="absolute top-2 right-2 sm:static" />
      </article>
    );
  }

  if (content.format === "modal") {
    return (
      <div
        className={cn("relative overflow-hidden border-b border-border bg-foreground/5 p-4 sm:p-5", className)}
        data-in-app-format="modal"
      >
        <div className="absolute inset-x-7 top-4 h-2 rounded-full bg-foreground/10" aria-hidden="true" />
        <article
          className="relative mt-5 rounded-xl border border-border bg-background p-4 shadow-xl"
          role="dialog"
          aria-modal="false"
          aria-label={`${formatLabel}: ${title}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="size-4" aria-hidden="true" />
            </span>
            <AnnouncementDismissButton title={title} onDismiss={dismiss} />
          </div>
          <p className="mt-4 text-xs font-medium text-primary">New update</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <RichTextPreview html={content.body} className="mt-4 text-sm [&_p]:my-0" />
          <AnnouncementCta cta={cta} onRead={markRead} className="mt-5" />
        </article>
      </div>
    );
  }

  if (content.format === "toast") {
    return (
      <div
        className={cn("relative min-h-36 overflow-hidden border-b border-border bg-surface-subtle/70 p-3", className)}
        data-in-app-format="toast"
      >
        <div className="absolute inset-x-6 top-4 h-1.5 rounded-full bg-foreground/10" aria-hidden="true" />
        <article
          className="relative mt-6 rounded-xl border border-border bg-background p-3 shadow-lg"
          role="status"
          aria-label={`${formatLabel}: ${title}`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{title}</h2>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{summary}</p>
              <AnnouncementCta cta={cta} onRead={markRead} className="mt-3" />
            </div>
            <AnnouncementDismissButton title={title} onDismiss={dismiss} className="-mr-1 -mt-1 shrink-0" />
          </div>
        </article>
      </div>
    );
  }

  if (content.format === "contextual") {
    return (
      <div
        className={cn("relative overflow-hidden border-b border-border bg-surface-subtle/70 px-4 pb-3 pt-5", className)}
        data-in-app-format="contextual"
      >
        <div className="h-2 w-20 rounded-full bg-foreground/10" aria-hidden="true" />
        <div className="mt-2 h-6 w-2/3 rounded-md bg-muted" aria-hidden="true" />
        <article
          className="relative mt-4 rounded-xl border border-primary/25 bg-background p-3 shadow-lg"
          role="note"
          aria-label={`${formatLabel}: ${title}`}
        >
          <span className="absolute -top-2 left-7 size-4 rotate-45 border-t border-l border-primary/25 bg-background" aria-hidden="true" />
          <div className="relative flex items-start gap-2">
            <MousePointer2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">Tip</p>
              <h2 className="mt-0.5 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{summary}</p>
              <AnnouncementCta cta={cta} onRead={markRead} className="mt-3" />
            </div>
            <AnnouncementDismissButton title={title} onDismiss={dismiss} className="-mr-1 -mt-1 shrink-0" />
          </div>
        </article>
      </div>
    );
  }

  return (
    <article
      className={cn("border-b border-border bg-surface px-4 py-4", className)}
      data-in-app-format="feed"
      aria-label={`${formatLabel}: ${title}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary">New update</p>
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <RichTextPreview html={content.body} className="mt-3 text-sm [&_p]:my-0" />
          <AnnouncementCta cta={cta} onRead={markRead} className="mt-4" />
        </div>
        <AnnouncementDismissButton title={title} onDismiss={dismiss} />
      </div>
    </article>
  );
}
