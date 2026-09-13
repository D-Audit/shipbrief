"use client";

import { Bell, BellRing, Info, Megaphone, MousePointer2, Sparkles, X } from "lucide-react";
import { getInAppFormatLabel } from "@/components/channels/in-app-formats";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudioDraft } from "@/components/ai";
import type { InAppFormat, Release } from "@/types";

type InAppPreviewProps = {
  content: StudioDraft;
  cta?: Release["cta"];
};

function PreviewCta({ cta, className }: { cta?: Release["cta"]; className?: string }) {
  if (!cta?.label) return null;

  return (
    <Button type="button" size="sm" className={className}>
      {cta.label}
    </Button>
  );
}

function FeedPreview({ content, cta }: InAppPreviewProps) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-2 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
          What&apos;s new
        </div>
        <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <article className="p-3">
        <p className="text-xs font-medium text-primary">New update</p>
        <h2 className="mt-1 text-base font-semibold">{content.title || "Untitled release"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.summary || "A short update will appear here."}</p>
        <RichTextPreview html={content.body} className="mt-3 text-sm [&_p]:my-0" />
        <PreviewCta cta={cta} className="mt-4" />
      </article>
    </div>
  );
}

function BannerPreview({ content, cta }: InAppPreviewProps) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm sm:flex-row sm:items-start" role="status">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Megaphone className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary">New update</p>
        <h2 className="mt-0.5 text-sm font-semibold">{content.title || "Untitled release"}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{content.summary || "A short update will appear here."}</p>
        <PreviewCta cta={cta} className="mt-3" />
      </div>
      <X className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
    </article>
  );
}

function ModalPreview({ content, cta }: InAppPreviewProps) {
  return (
    <div className="relative mx-auto flex min-h-72 w-full max-w-xl items-center justify-center overflow-hidden rounded-2xl border border-border bg-foreground/5 p-4 sm:p-7">
      <div className="absolute inset-x-7 top-6 h-3 rounded-full bg-foreground/10" aria-hidden="true" />
      <article className="relative w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl" role="dialog" aria-modal="false" aria-label="Modal announcement preview">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><BellRing className="size-4" /></span>
          <X className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs font-medium text-primary">New update</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{content.title || "Untitled release"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.summary || "A short update will appear here."}</p>
        <RichTextPreview html={content.body} className="mt-4 text-sm [&_p]:my-0" />
        <PreviewCta cta={cta} className="mt-5" />
      </article>
    </div>
  );
}

function ToastPreview({ content, cta }: InAppPreviewProps) {
  return (
    <div className="relative mx-auto min-h-56 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-subtle/70 p-4">
      <div className="absolute inset-x-6 top-5 h-2 rounded-full bg-foreground/10" aria-hidden="true" />
      <article className="absolute right-4 bottom-4 left-4 rounded-xl border border-border bg-background p-3 shadow-lg" role="status">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="size-3.5" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{content.title || "Untitled release"}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{content.summary || "A short update will appear here."}</p>
            <PreviewCta cta={cta} className="mt-3 h-7 px-2.5 text-xs" />
          </div>
          <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </article>
    </div>
  );
}

function ContextualPreview({ content, cta }: InAppPreviewProps) {
  return (
    <div className="relative mx-auto min-h-72 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-subtle/70 p-5 sm:p-7">
      <div className="w-2/3 rounded-lg border border-border bg-background p-4 shadow-sm" aria-hidden="true">
        <div className="h-2 w-16 rounded-full bg-foreground/15" />
        <div className="mt-3 h-7 rounded-md bg-muted" />
        <div className="mt-2 h-2 w-4/5 rounded-full bg-foreground/10" />
      </div>
      <article className="absolute top-20 right-4 left-14 rounded-xl border border-primary/25 bg-background p-4 shadow-lg sm:left-28" role="note" aria-label="Contextual announcement preview">
        <span className="absolute -top-2 left-7 size-4 rotate-45 border-t border-l border-primary/25 bg-background" aria-hidden="true" />
        <div className="relative flex items-start gap-2">
          <MousePointer2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">Tip</p>
            <h2 className="mt-0.5 text-sm font-semibold">{content.title || "Untitled release"}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{content.summary || "A short update will appear here."}</p>
            <RichTextPreview html={content.body} className="mt-3 text-xs [&_p]:my-0" />
            <PreviewCta cta={cta} className="mt-3 h-7 px-2.5 text-xs" />
          </div>
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </article>
    </div>
  );
}

export function InAppPreview({ content, cta }: InAppPreviewProps) {
  const format: InAppFormat = content.format ?? "feed";
  const preview = format === "banner"
    ? <BannerPreview content={content} cta={cta} />
    : format === "modal"
      ? <ModalPreview content={content} cta={cta} />
      : format === "toast"
        ? <ToastPreview content={content} cta={cta} />
        : format === "contextual"
          ? <ContextualPreview content={content} cta={cta} />
          : <FeedPreview content={content} cta={cta} />;

  return (
    <div className={cn("w-full", format === "banner" && "py-1")} data-in-app-format={format} role="region" aria-label={`${getInAppFormatLabel(format)} announcement preview`}>
      {preview}
    </div>
  );
}
