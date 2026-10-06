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
  /** Show "Get updates by email" in the widget. */
  emailSubscribe: boolean;
  /** Whether an identity secret exists, so signed-in users can be identified. */
  identityVerification: boolean;
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
  emailSubscribe: boolean;
  /** The public changelog ("View all updates"); null when the workspace turned it off. Absent from older APIs. */
  changelogUrl?: string | null;
};

/** A signed-in user of the customer's product, as passed to the widget. */
export type WidgetIdentity = {
  user: { id: string; email?: string; name?: string; plan?: string; tags?: string[]; signedUpAt?: string };
  userHash: string;
};

export type WidgetUser = { email: string | null; name: string | null; subscribed: boolean };

export const widgetSettingsService = {
  get: () => api.get<WidgetInstallSettings>("/widget"),
  /** The project id is read-only; only placement and presentation are sent. */
  update: ({ launcherMode, placement, showUnreadBadge, theme, emailSubscribe }: Partial<WidgetInstallSettings>) =>
    api.patch<WidgetInstallSettings>("/widget", { launcherMode, placement, showUnreadBadge, theme, emailSubscribe }),
  /** The secret the customer's server signs user ids with. Developers and admins only. */
  identitySecret: () => api.get<{ secret: string }>("/widget/identity-secret"),
  rotateIdentitySecret: () => api.post<{ secret: string }>("/widget/identity-secret/rotate", {}),
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

/** Set once the host page identifies its signed-in user; kept in memory only, so it never outlives the page. */
let widgetSession: string | null = null;

function visitorHeaders(): Record<string, string> {
  const id = visitorId();
  return { ...(id ? { "X-Visitor-Id": id } : {}), ...(widgetSession ? { "X-Widget-Session": widgetSession } : {}) };
}

const options = () => ({ allowUnauthenticated: true, headers: visitorHeaders() });

/** Public What's New widget API, addressed by the workspace's public key. */
export const widgetService = {
  config: (key: string) => api.get<WidgetConfig>(`/public/widget/${encodeURIComponent(key)}`, options()),
  updates: (key: string) => api.get<{ items: WidgetUpdate[]; unreadCount: number }>(`/public/widget/${encodeURIComponent(key)}/updates`, options()),
  markRead: (key: string, releaseId: string) => api.post<{ id: string; read: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/${releaseId}/read`, {}, options()),
  markAllRead: (key: string) => api.post<{ ok: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/read-all`, {}, options()),
  recordClick: (key: string, releaseId: string) => api.post<{ ok: boolean }>(`/public/widget/${encodeURIComponent(key)}/updates/${releaseId}/click`, {}, options()),
  /** Verifies the signed-in user with the server; later requests carry their session. */
  identify: async (key: string, identity: WidgetIdentity) => {
    const result = await api.post<{ session: string; user: WidgetUser }>(`/public/widget/${encodeURIComponent(key)}/identify`, identity, options());
    widgetSession = result.session;
    return result.user;
  },
  forget: () => {
    widgetSession = null;
  },
  setSubscribed: (key: string, subscribed: boolean) =>
    api.post<WidgetUser>(`/public/widget/${encodeURIComponent(key)}/subscription`, { subscribed }, options()),
  /** Anonymous visitors: emails a confirmation link; they become a contact once they click it. */
  subscribe: (workspaceSlug: string, email: string) =>
    api.post<{ sent: boolean }>(`/public/workspaces/${encodeURIComponent(workspaceSlug)}/subscribe`, { email, source: "widget" }, options()),
};
