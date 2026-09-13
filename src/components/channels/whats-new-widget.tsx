"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, Clock3, Loader2, ThumbsUp, X } from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { InAppAnnouncement, type InAppAnnouncementContent } from "@/components/channels/in-app-announcement";
import { useAsyncData } from "@/hooks/use-async-data";
import { cn } from "@/lib/utils";
import { brandingService, releaseService } from "@/lib/services";
import type { Release } from "@/types";

type WidgetItem = {
  release: Release;
  content: InAppAnnouncementContent;
};

type WidgetStyle = CSSProperties & Record<`--${string}`, string>;

const lightWidgetTokens: WidgetStyle = {
  "--sb-background": "#ecedef",
  "--sb-surface": "#f8f8f9",
  "--sb-surface-subtle": "#e4e5e8",
  "--sb-foreground": "#171717",
  "--sb-muted": "#68696e",
  "--sb-border": "#d4d5d9",
  "--sb-primary-muted": "#fee5f1",
  "--sb-success": "#16a34a",
  "--sb-success-muted": "#ecfdf3",
  "--sb-warning": "#d97706",
  "--sb-warning-muted": "#fffbeb",
  "--sb-danger": "#dc2626",
  "--sb-danger-muted": "#fef2f2",
  "--background": "#ecedef",
  "--foreground": "#171717",
  "--surface": "#f8f8f9",
  "--surface-subtle": "#e4e5e8",
  "--card": "#f8f8f9",
  "--card-foreground": "#171717",
  "--popover": "#f8f8f9",
  "--popover-foreground": "#171717",
  "--primary-foreground": "#ffffff",
  "--secondary": "#e4e5e8",
  "--secondary-foreground": "#171717",
  "--muted": "#e4e5e8",
  "--muted-foreground": "#68696e",
  "--accent": "#fee5f1",
  "--destructive": "#dc2626",
  "--success": "#16a34a",
  "--success-muted": "#ecfdf3",
  "--warning": "#d97706",
  "--warning-muted": "#fffbeb",
  "--danger": "#dc2626",
  "--danger-muted": "#fef2f2",
  "--border": "#d4d5d9",
  "--input": "#d4d5d9",
};

function getWidgetStyle(accentColor: string, theme: "inherit" | "light" | "dark"): WidgetStyle {
  const accent = accentColor.trim() || "#e40178";
  const style: WidgetStyle = {
    "--sb-primary": accent,
    "--primary": accent,
    "--accent-foreground": accent,
    "--sidebar-primary": accent,
    "--ring": `color-mix(in oklab, ${accent} 35%, transparent)`,
  };

  return theme === "light" ? { ...lightWidgetTokens, ...style } : style;
}

function toWidgetItem(release: Release): WidgetItem {
  const variant = release.channelVariants?.in_app;
  return {
    release,
    // A widget feed deliberately reads the saved in-app version instead of
    // master release copy. It falls back only for legacy releases that have
    // not been given a channel-specific draft yet.
    content: {
      title: variant?.title ?? release.title,
      summary: variant?.summary ?? release.summary,
      body: variant?.body ?? release.body,
      format: variant?.format ?? "feed",
    },
  };
}

export function WhatsNewWidget({
  workspace = "acme",
  theme,
  accentColor,
  floating = false,
}: {
  workspace?: string;
  /** Explicit embed overrides take precedence over saved workspace settings. */
  theme?: "inherit" | "light" | "dark";
  /** Useful for a local, unsaved branding preview without changing the service boundary. */
  accentColor?: string;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState(false);
  const { state: releasesState, reload: reloadReleases } = useAsyncData(
    () => releaseService.list({ status: "published" }),
    []
  );
  const { state: brandingState, reload: reloadBranding } = useAsyncData(
    () => brandingService.get(),
    []
  );
  const hasReleaseData = releasesState.status === "success" || releasesState.status === "empty";
  const widgetReady = hasReleaseData && brandingState.status === "success";
  const loading = releasesState.status === "idle" || releasesState.status === "loading" || brandingState.status === "idle" || brandingState.status === "loading";
  const loadError = releasesState.status === "error"
    ? releasesState.error
    : brandingState.status === "error"
      ? `Brand settings could not load: ${brandingState.error}`
      : null;
  const savedBranding = brandingState.status === "success" ? brandingState.data : null;
  const resolvedTheme = theme ?? savedBranding?.widgetTheme ?? "inherit";
  const resolvedAccentColor = accentColor ?? savedBranding?.accentColor ?? "#e40178";
  const widgetStyle = getWidgetStyle(resolvedAccentColor, resolvedTheme);
  const items = releasesState.status === "success"
    ? releasesState.data.filter((release) => release.channels.includes("in_app")).map(toWidgetItem)
    : [];
  const selected = items.find((item) => item.release.id === selectedId);
  const feedItems = items.filter((item) => item.content.format === "feed");
  const activeAnnouncement = items.find(
    (item) => item.content.format !== "feed" && !dismissedIds.has(item.release.id)
  );
  // A non-feed announcement is considered seen while it is visible. Feed
  // items keep their explicit dot until a visitor opens them.
  const unreadCount = items.filter(
    (item) => !readIds.has(item.release.id) && item.release.id !== activeAnnouncement?.release.id
  ).length;
  const containerClass = cn(
    "w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
    floating && "fixed bottom-4 right-4 z-40 max-[420px]:inset-x-3 max-[420px]:right-auto max-[420px]:w-auto max-[420px]:max-w-none"
  );

  const markRead = (id: string) => {
    setReadIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const dismissAnnouncement = (id: string) => {
    markRead(id);
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const reloadWidget = async () => {
    await Promise.all([reloadReleases(), reloadBranding()]);
  };

  if (!open || snoozed) {
    return <button type="button" onClick={() => { setSnoozed(false); setOpen(true); }} style={widgetStyle} className={cn("flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg", resolvedTheme === "dark" && "dark", floating && "fixed right-4 bottom-4 z-40")} aria-label="Open What's New"><Bell className="size-5" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">{unreadCount}</span>}</button>;
  }

  return (
    <section className={cn(containerClass, resolvedTheme === "dark" && "dark")} style={widgetStyle} aria-label="What's New widget">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div><p className="text-sm font-semibold text-primary">What&apos;s new</p><p className="text-xs text-muted-foreground">Product updates for your workspace</p></div>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setSnoozed(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remind me later"><Clock3 className="size-4" /></button><button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Dismiss"><X className="size-4" /></button></div>
      </div>

      {loading && <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />Loading updates and workspace style...</div>}
      {loadError && <div className="space-y-3 p-5 text-sm" role="alert"><p className="text-muted-foreground">{loadError}</p><Button type="button" size="sm" variant="outline" onClick={() => void reloadWidget()}>Try again</Button></div>}
      {widgetReady && items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No new updates right now.</p>}
      {widgetReady && selected && (
        <div className="p-4" data-in-app-format={selected.content.format}>
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setSelectedId(null)}><ChevronLeft className="size-3.5" />All updates</button>
          <p className="text-xs font-medium text-primary">New update</p><h3 className="mt-1 text-lg font-semibold">{selected.content.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.content.summary}</p>
          <RichTextPreview html={selected.content.body} className="mt-3 text-sm [&_p]:my-0" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selected.release.cta && <Link href={selected.release.cta.url} className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground">{selected.release.cta.label}</Link>}
            <Button type="button" size="sm" variant="ghost" onClick={() => setReactedIds((current) => { const next = new Set(current); if (next.has(selected.release.id)) next.delete(selected.release.id); else next.add(selected.release.id); return next; })}><ThumbsUp className={cn(reactedIds.has(selected.release.id) && "fill-current")} />{selected.release.reactions + (reactedIds.has(selected.release.id) ? 1 : 0)}</Button>
          </div>
        </div>
      )}
      {widgetReady && !selected && activeAnnouncement && (
        <InAppAnnouncement
          content={activeAnnouncement.content}
          cta={activeAnnouncement.release.cta}
          onRead={() => markRead(activeAnnouncement.release.id)}
          onDismiss={() => dismissAnnouncement(activeAnnouncement.release.id)}
        />
      )}
      {widgetReady && !selected && feedItems.length > 0 && <ul className="divide-y divide-border">{feedItems.slice(0, 3).map((item) => <li key={item.release.id} data-in-app-format="feed"><button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50" onClick={() => { setSelectedId(item.release.id); markRead(item.release.id); }}><span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !readIds.has(item.release.id) ? "bg-primary" : "bg-transparent")} aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-medium">{item.content.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{item.content.summary}</span></span></button></li>)}</ul>}
      {widgetReady && !selected && items.length > 0 && !activeAnnouncement && feedItems.length === 0 && <p className="p-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
      {widgetReady && !selected && items.length > 0 && <div className="border-t border-border px-4 py-3"><Link href={`/c/${workspace}`} className="text-xs font-medium text-primary hover:underline">View all updates</Link></div>}
    </section>
  );
}
