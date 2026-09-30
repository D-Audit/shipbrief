"use client";

import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, Clock3, Loader2, ThumbsUp, X } from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { InAppAnnouncement, type InAppAnnouncementContent } from "@/components/channels/in-app-announcement";
import { useAsyncData } from "@/hooks/use-async-data";
import { cn } from "@/lib/utils";
import { publicEngagementService } from "@/lib/services";
import { widgetService, widgetSettingsService, type WidgetUpdate } from "@/lib/services/widget-settings-service";

type WidgetItem = {
  release: WidgetUpdate;
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
  "--sb-primary-muted": "#eef8cf",
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
  "--accent": "#eef8cf",
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

/** Ink or white, whichever reads better on the workspace's accent colour. */
function textOnAccent(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(clean.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#171717" : "#ffffff";
}

function getWidgetStyle(accentColor: string, theme: "inherit" | "light" | "dark"): WidgetStyle {
  const accent = accentColor.trim() || "#c7f238";
  const style: WidgetStyle = {
    "--sb-primary": accent,
    "--primary": accent,
    "--primary-strong": accent,
    "--primary-foreground": textOnAccent(accent),
    "--accent": `color-mix(in oklab, ${accent} 14%, transparent)`,
    "--accent-foreground": accent,
    "--sidebar-primary": accent,
    "--ring": `color-mix(in oklab, ${accent} 35%, transparent)`,
  };

  return theme === "light" ? { ...lightWidgetTokens, ...style } : style;
}

function toWidgetItem(update: WidgetUpdate): WidgetItem {
  // The API already resolves the saved in-app variant (falling back to the
  // master release copy only when no channel-specific draft exists).
  return { release: update, content: { title: update.title, summary: update.summary, body: update.body, format: update.format } };
}

export function WhatsNewWidget({
  projectKey,
  theme,
  accentColor,
  floating = false,
}: {
  /** The workspace's public widget key. Inside the app it defaults to the current workspace's key. */
  projectKey?: string;
  /** Explicit embed overrides take precedence over saved workspace settings. */
  theme?: "inherit" | "light" | "dark";
  /** Useful for a local, unsaved branding preview without changing the service boundary. */
  accentColor?: string;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState(false);
  const loadWidget = useCallback(async () => {
    const key = projectKey ?? (await widgetSettingsService.get()).projectId;
    const [config, updates] = await Promise.all([widgetService.config(key), widgetService.updates(key)]);
    return { key, config, updates };
  }, [projectKey]);
  const { state: widgetState, reload: reloadWidget } = useAsyncData(loadWidget, [loadWidget]);
  const widgetReady = widgetState.status === "success";
  const loading = widgetState.status === "idle" || widgetState.status === "loading";
  const loadError = widgetState.status === "error" ? widgetState.error : null;
  const data = widgetReady ? widgetState.data : null;
  const resolvedTheme = theme ?? data?.config.theme ?? "inherit";
  const resolvedAccentColor = accentColor ?? data?.config.accentColor ?? "#c7f238";
  const widgetStyle = getWidgetStyle(resolvedAccentColor, resolvedTheme);
  const items = data ? data.updates.items.map(toWidgetItem) : [];
  // Read state comes from the server (so it survives reloads) plus anything opened this session.
  const readIds = new Set([...items.filter((item) => item.release.read).map((item) => item.release.id), ...locallyReadIds]);
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
    "w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface",
    floating && "fixed bottom-4 right-4 z-40 max-[420px]:inset-x-3 max-[420px]:right-auto max-[420px]:w-auto max-[420px]:max-w-none"
  );

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    setLocallyReadIds((current) => new Set(current).add(id));
    if (data) widgetService.markRead(data.key, id).catch(() => undefined);
  };

  const toggleReaction = async (item: WidgetUpdate) => {
    if (!data) return;
    try {
      const result = await publicEngagementService.toggleReaction(data.config.workspace.slug, item.slug);
      setReactions((current) => ({ ...current, [item.id]: { count: result.reactions, reacted: result.hasReacted } }));
    } catch {
      // Reactions are optional; the widget keeps working without them.
    }
  };

  const recordClick = (id: string) => {
    if (data) widgetService.recordClick(data.key, id).catch(() => undefined);
  };

  const dismissAnnouncement = (id: string) => {
    markRead(id);
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  if (!open || snoozed) {
    return <button type="button" onClick={() => { setSnoozed(false); setOpen(true); }} style={widgetStyle} className={cn("flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground", resolvedTheme === "dark" && "dark", floating && "fixed right-4 bottom-4 z-40")} aria-label="Open What's New"><Bell className="size-5" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">{unreadCount}</span>}</button>;
  }

  return (
    <section className={cn(containerClass, resolvedTheme === "dark" && "dark")} style={widgetStyle} aria-label="What's New widget">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div><p className="text-sm font-semibold text-primary-strong">What&apos;s new</p><p className="text-xs text-muted-foreground">Product updates for your workspace</p></div>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setSnoozed(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remind me later"><Clock3 className="size-4" /></button><button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Dismiss"><X className="size-4" /></button></div>
      </div>

      {loading && <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary-strong" />Loading updates and workspace style...</div>}
      {loadError && <div className="space-y-3 p-5 text-sm" role="alert"><p className="text-muted-foreground">{loadError}</p><Button type="button" size="sm" variant="outline" onClick={() => void reloadWidget()}>Try again</Button></div>}
      {widgetReady && items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No new updates right now.</p>}
      {widgetReady && selected && (
        <div className="p-4" data-in-app-format={selected.content.format}>
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary-strong hover:underline" onClick={() => setSelectedId(null)}><ChevronLeft className="size-3.5" />All updates</button>
          <p className="text-xs font-medium text-primary-strong">New update</p><h3 className="mt-1 text-lg font-semibold">{selected.content.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.content.summary}</p>
          <RichTextPreview html={selected.content.body} className="mt-3 text-sm [&_p]:my-0" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selected.release.cta && <Link href={selected.release.cta.url} onClick={() => recordClick(selected.release.id)} className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground">{selected.release.cta.label}</Link>}
            <Button type="button" size="sm" variant="ghost" onClick={() => void toggleReaction(selected.release)}><ThumbsUp className={cn(reactions[selected.release.id]?.reacted && "fill-current")} />{reactions[selected.release.id]?.count ?? selected.release.reactions}</Button>
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
      {widgetReady && !selected && feedItems.length > 0 && <ul className="divide-y divide-border">{feedItems.slice(0, 3).map((item) => <li key={item.release.id} data-in-app-format="feed"><button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50" onClick={() => { setSelectedId(item.release.id); markRead(item.release.id); }}><span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !readIds.has(item.release.id) ? "bg-primary-strong" : "bg-transparent")} aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-medium">{item.content.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{item.content.summary}</span></span></button></li>)}</ul>}
      {widgetReady && !selected && items.length > 0 && !activeAnnouncement && feedItems.length === 0 && <p className="p-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
      {widgetReady && !selected && items.length > 0 && <div className="border-t border-border px-4 py-3"><Link href={`/c/${data?.config.workspace.slug ?? ""}`} className="text-xs font-medium text-primary-strong hover:underline">View all updates</Link></div>}
    </section>
  );
}
