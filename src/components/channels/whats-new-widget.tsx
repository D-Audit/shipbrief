"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { Bell, Check, ChevronLeft, Clock3, Loader2, Mail, ThumbsUp, X } from "lucide-react";
import { RichTextPreview } from "@/components/releases/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InAppAnnouncement, type InAppAnnouncementContent } from "@/components/channels/in-app-announcement";
import { useAsyncData } from "@/hooks/use-async-data";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { publicEngagementService } from "@/lib/services";
import {
  widgetService,
  widgetSettingsService,
  type WidgetConfig,
  type WidgetIdentity,
  type WidgetUpdate,
  type WidgetUser,
} from "@/lib/services/widget-settings-service";

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
  mode = "card",
}: {
  /** The workspace's public widget key. Inside the app it defaults to the current workspace's key. */
  projectKey?: string;
  /** Explicit embed overrides take precedence over saved workspace settings. */
  theme?: "inherit" | "light" | "dark";
  /** Useful for a local, unsaved branding preview without changing the service boundary. */
  accentColor?: string;
  floating?: boolean;
  /**
   * `card`: the self-contained preview used inside ShipBrief.
   * `panel`: rendered in the iframe opened by /widget.js; the host page owns the launcher and talks to it with postMessage.
   */
  mode?: "card" | "panel";
}) {
  const panel = mode === "panel";
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState(false);
  const [user, setUser] = useState<WidgetUser | null>(null);
  /** Updates refetched in the background (after sign-in or when the panel opens) without a loading state. */
  const [freshUpdates, setFreshUpdates] = useState<{ items: WidgetUpdate[] } | null>(null);
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
  const items = data ? (freshUpdates ?? data.updates).items.map(toWidgetItem) : [];
  // Read state comes from the server (so it survives reloads) plus anything opened this session.
  const readIds = new Set([...items.filter((item) => item.release.read).map((item) => item.release.id), ...locallyReadIds]);
  const selected = items.find((item) => item.release.id === selectedId);
  // The panel is a feed of everything; the card preview shows announcements the way they appear in-product.
  const feedItems = panel ? items : items.filter((item) => item.content.format === "feed");
  const activeAnnouncement = panel
    ? undefined
    : items.find((item) => item.content.format !== "feed" && !dismissedIds.has(item.release.id));
  // A non-feed announcement is considered seen while it is visible. Feed
  // items keep their explicit dot until a visitor opens them.
  const unreadCount = items.filter(
    (item) => !readIds.has(item.release.id) && item.release.id !== activeAnnouncement?.release.id
  ).length;
  const containerClass = cn(
    panel ? "flex h-dvh w-full flex-col overflow-hidden bg-surface" : "w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface",
    floating && !panel && "fixed bottom-4 right-4 z-40 max-[420px]:inset-x-3 max-[420px]:right-auto max-[420px]:w-auto max-[420px]:max-w-none"
  );

  usePanelBridge({
    enabled: panel,
    widgetKey: data?.key ?? null,
    config: data?.config ?? null,
    unreadCount: widgetReady ? unreadCount : null,
    onUser: (next) => {
      setUser(next);
      setLocallyReadIds(new Set());
      refreshUpdates();
    },
    onOpened: () => refreshUpdates(),
  });

  function refreshUpdates() {
    if (data) widgetService.updates(data.key).then(setFreshUpdates).catch(() => undefined);
  }

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    setLocallyReadIds((current) => new Set(current).add(id));
    if (data) widgetService.markRead(data.key, id).catch(() => undefined);
  };

  const markAllRead = () => {
    if (!data) return;
    setLocallyReadIds(new Set(items.map((item) => item.release.id)));
    widgetService.markAllRead(data.key).catch(() => undefined);
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

  const close = () => {
    if (panel) window.parent.postMessage({ sb: "close" }, "*");
    else setOpen(false);
  };

  if (!panel && (!open || snoozed)) {
    return <button type="button" onClick={() => { setSnoozed(false); setOpen(true); }} style={widgetStyle} className={cn("flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground", resolvedTheme === "dark" && "dark", floating && "fixed right-4 bottom-4 z-40")} aria-label="Open What's New"><Bell className="size-5" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">{unreadCount}</span>}</button>;
  }

  const changelogUrl = data?.config.changelogUrl === undefined ? `/c/${data?.config.workspace.slug ?? ""}` : data.config.changelogUrl;

  return (
    <section className={cn(containerClass, resolvedTheme === "dark" && "dark", "text-foreground")} style={widgetStyle} aria-label="What's New widget">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0"><p className="text-sm font-semibold text-primary-strong">What&apos;s new</p><p className="truncate text-xs text-muted-foreground">{data ? `Latest from ${data.config.workspace.name}` : "Product updates"}</p></div>
        <div className="flex items-center gap-1">
          {panel && unreadCount > 0 && <button type="button" onClick={markAllRead} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Mark all read</button>}
          {!panel && <button type="button" onClick={() => setSnoozed(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remind me later"><Clock3 className="size-4" /></button>}
          <button type="button" onClick={close} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close"><X className="size-4" /></button>
        </div>
      </div>

      <div className={cn(panel && "min-h-0 flex-1 overflow-y-auto")}>
        {loading && <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary-strong" />Loading updates...</div>}
        {loadError && <div className="space-y-3 p-5 text-sm" role="alert"><p className="text-muted-foreground">{loadError}</p><Button type="button" size="sm" variant="outline" onClick={() => void reloadWidget()}>Try again</Button></div>}
        {widgetReady && items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No updates yet. New releases will show up here.</p>}
        {widgetReady && selected && (
          <div className="p-4" data-in-app-format={selected.content.format}>
            <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary-strong hover:underline" onClick={() => setSelectedId(null)}><ChevronLeft className="size-3.5" />All updates</button>
            <p className="text-xs text-muted-foreground">{formatDate(selected.release.publishedAt)}</p><h3 className="mt-1 text-lg font-semibold">{selected.content.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.content.summary}</p>
            <RichTextPreview html={selected.content.body} className="mt-3 text-sm [&_p]:my-0" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selected.release.cta && (panel
                ? <a href={selected.release.cta.url} target="_top" onClick={() => recordClick(selected.release.id)} className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground">{selected.release.cta.label}</a>
                : <Link href={selected.release.cta.url} onClick={() => recordClick(selected.release.id)} className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground">{selected.release.cta.label}</Link>)}
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
        {widgetReady && !selected && feedItems.length > 0 && <ul className="divide-y divide-border">{(panel ? feedItems : feedItems.slice(0, 3)).map((item) => <li key={item.release.id} data-in-app-format="feed"><button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50" onClick={() => { setSelectedId(item.release.id); markRead(item.release.id); }}><span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !readIds.has(item.release.id) ? "bg-primary-strong" : "bg-transparent")} aria-hidden="true" /><span className="min-w-0"><span className="block text-sm font-medium">{item.content.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{item.content.summary}</span>{panel && <span className="mt-1.5 block text-[11px] text-muted-foreground">{formatDate(item.release.publishedAt)}</span>}</span></button></li>)}</ul>}
        {widgetReady && !selected && items.length > 0 && !activeAnnouncement && feedItems.length === 0 && <p className="p-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
      </div>

      {widgetReady && data?.config.emailSubscribe && !selected && <EmailUpdates widgetKey={data.key} config={data.config} user={user} onUser={setUser} />}
      {widgetReady && items.length > 0 && changelogUrl && <div className="shrink-0 border-t border-border px-4 py-3">{panel ? <a href={changelogUrl} target="_blank" rel="noopener" className="text-xs font-medium text-primary-strong hover:underline">View all updates</a> : <Link href={changelogUrl} className="text-xs font-medium text-primary-strong hover:underline">View all updates</Link>}</div>}
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Email updates footer. A signed-in (identified) user is already a contact, so
 * they get a simple on/off switch. Anonymous visitors subscribe with double
 * opt-in: nothing is stored until they click the link in the confirmation email.
 */
function EmailUpdates({ widgetKey, config, user, onUser }: { widgetKey: string; config: WidgetConfig; user: WidgetUser | null; onUser: (user: WidgetUser) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user?.email) {
    const toggle = async () => {
      setBusy(true);
      setError(null);
      try {
        onUser(await widgetService.setSubscribed(widgetKey, !user.subscribed));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "That didn't work. Please try again.");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-sm font-medium">Email me new updates</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
          <button type="button" role="switch" aria-checked={user.subscribed} aria-label="Email me new updates" disabled={busy} onClick={() => void toggle()} className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60", user.subscribed ? "bg-primary" : "bg-muted-foreground/30")}><span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform", user.subscribed && "translate-x-4")} /></button>
        </div>
        {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await widgetService.subscribe(config.workspace.slug, value);
      setSentTo(value);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "We couldn't send the confirmation email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return <div className="flex shrink-0 items-start gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground" role="status"><Check className="mt-0.5 size-3.5 shrink-0 text-success" /><span>Check <span className="font-medium text-foreground">{sentTo}</span> and click the link to confirm. Then you&apos;ll get new updates by email.</span></div>;
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="shrink-0 border-t border-border px-4 py-3">
      <label htmlFor="sb-widget-email" className="flex items-center gap-1.5 text-xs font-medium"><Mail className="size-3.5 text-muted-foreground" />Get updates by email</label>
      <div className="mt-2 flex gap-2">
        <Input id="sb-widget-email" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-8 text-sm" />
        <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Subscribe"}</Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
    </form>
  );
}

/**
 * The iframe side of /widget.js. Tells the host page when it is ready (with the
 * launcher settings) and how many updates are unread, and receives the signed-in
 * user and open/close events from it. Messages are only accepted from the parent window.
 */
function usePanelBridge({
  enabled,
  widgetKey,
  config,
  unreadCount,
  onUser,
  onOpened,
}: {
  enabled: boolean;
  widgetKey: string | null;
  config: WidgetConfig | null;
  unreadCount: number | null;
  onUser: (user: WidgetUser | null) => void;
  onOpened: () => void;
}) {
  const handlers = useRef({ onUser, onOpened });
  useEffect(() => {
    handlers.current = { onUser, onOpened };
  });
  const announced = useRef(false);
  const embedded = enabled && typeof window !== "undefined" && window.parent !== window;

  useEffect(() => {
    if (!embedded || !config || announced.current) return;
    announced.current = true;
    window.parent.postMessage(
      { sb: "ready", config: { placement: config.placement, launcherMode: config.launcherMode, showUnreadBadge: config.showUnreadBadge, accentColor: config.accentColor } },
      "*",
    );
  }, [embedded, config]);

  useEffect(() => {
    if (embedded && unreadCount !== null) window.parent.postMessage({ sb: "unread", count: unreadCount }, "*");
  }, [embedded, unreadCount]);

  useEffect(() => {
    if (!embedded || !widgetKey) return;
    let latest = 0;
    const onMessage = async (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = event.data as { sb?: string } & Partial<WidgetIdentity>;
      if (message?.sb === "identify" && message.user && message.userHash) {
        const attempt = ++latest;
        try {
          const user = await widgetService.identify(widgetKey, { user: message.user, userHash: message.userHash });
          if (attempt === latest) handlers.current.onUser(user);
        } catch (caught) {
          window.parent.postMessage({ sb: "identify-failed", message: caught instanceof ApiError ? caught.message : "The signed-in user couldn't be identified." }, "*");
        }
      } else if (message?.sb === "logout") {
        latest += 1;
        widgetService.forget();
        handlers.current.onUser(null);
      } else if (message?.sb === "opened") {
        handlers.current.onOpened();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.parent.postMessage({ sb: "close" }, "*");
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, [embedded, widgetKey]);
}
