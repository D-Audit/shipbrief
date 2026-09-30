import { api } from "@/lib/api/client";

export type WidgetLauncherMode = "default" | "manual";
export type WidgetPlacement = "bottom-right" | "bottom-left";

export type WidgetInstallSettings = {
  /** The workspace's public widget key. */
  projectId: string;
  launcherMode: WidgetLauncherMode;
  placement: WidgetPlacement;
  showUnreadBadge: boolean;
  theme: "inherit" | "light" | "dark";
};

export type WidgetUpdate = {
  id: string;
  slug: string;
  publishedAt: string;
  category: string;
  format: "feed" | "banner" | "modal" | "toast" | "contextual";
  title: string;
  summary: string;
  body: string;
  cta?: { label: string; url: string };
  reactions: number;
  read: boolean;
};

export type WidgetConfig = {
  workspace: { name: string; slug: string };
  accentColor: string;
  theme: "inherit" | "light" | "dark";
  placement: WidgetPlacement;
  launcherMode: WidgetLauncherMode;
  showUnreadBadge: boolean;
};

export const widgetSettingsService = {
  get: () => api.get<WidgetInstallSettings>("/widget"),
  /** The project id is read-only; only placement and presentation are sent. */
  update: ({ launcherMode, placement, showUnreadBadge, theme }: Partial<WidgetInstallSettings>) =>
    api.patch<WidgetInstallSettings>("/widget", { launcherMode, placement, showUnreadBadge, theme }),
};

const VISITOR_KEY = "sb_widget_visitor";

/** Anonymous, per-browser id so read state survives reloads without cookies. */
function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function visitorHeaders(): Record<string, string> {
  const id = visitorId();
  return id ? { "X-Visitor-Id": id } : {};
}

const options = () => ({ allowUnauthenticated: true, headers: visitorHeaders() });

/** Public What's New widget API, addressed by the workspace's public key. */
export const widgetService = {
  config: (key: string) => api.get<WidgetConfig>(`/public/widget/${encodeURIComponent(key)}`, options()),
  updates: (key: string) => api.get<{ items: WidgetUpdate[]; unreadCount: number }>(`/public/widget/${encodeURIComponent(key)}/updates`, options()),
  markRead: (key: string, releaseId: string) => api.post<{ id: string; read: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/${releaseId}/read`, {}, options()),
  markAllRead: (key: string) => api.post<{ ok: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/read-all`, {}, options()),
  recordClick: (key: string, releaseId: string) => api.post<{ ok: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/${releaseId}/click`, {}, options()),
};
