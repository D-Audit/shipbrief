import {
  Blocks,
  ChartNoAxesColumn,
  Contact,
  CreditCard,
  FileText,
  LayoutDashboard,
  Mail,
  Map,
  MessagesSquare,
  Palette,
  PanelTop,
  PenLine,
  ScrollText,
  Settings,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that should mark this item active. */
  match?: string[];
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export const workspaceNav: NavSection[] = [
  {
    items: [
      { title: "Overview", href: "/app/overview", icon: LayoutDashboard },
      { title: "Releases", href: "/app/releases", icon: FileText },
      { title: "AI Studio", href: "/app/ai-studio", icon: PenLine },
      { title: "Feedback", href: "/app/feedback", icon: MessagesSquare },
      { title: "Roadmap", href: "/app/roadmap", icon: Map },
      { title: "Analytics", href: "/app/analytics", icon: ChartNoAxesColumn },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Changelog", href: "/app/changelog", icon: ScrollText },
      { title: "Email", href: "/app/campaigns", icon: Mail },
      { title: "Contacts", href: "/app/contacts", icon: Contact },
      { title: "In-app", href: "/app/widget", icon: PanelTop },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Integrations", href: "/app/integrations", icon: Blocks },
      { title: "Team", href: "/app/team", icon: Users },
      { title: "Branding", href: "/app/branding", icon: Palette },
      { title: "API & Webhooks", href: "/app/api", icon: Webhook },
    ],
  },
];

/** Pinned to the bottom of the sidebar: account-level pages people visit rarely. */
export const accountNav: NavItem[] = [
  { title: "Settings", href: "/app/settings", icon: Settings },
  { title: "Billing", href: "/app/billing", icon: CreditCard },
];

/** Page titles for breadcrumbs, including routes that are not in the sidebar. */
export const routeTitles: Record<string, string> = {
  overview: "Overview",
  releases: "Releases",
  new: "New release",
  "ai-studio": "AI Studio",
  changelog: "Changelog",
  campaigns: "Email",
  widget: "In-app",
  feedback: "Feedback",
  roadmap: "Roadmap",
  analytics: "Analytics",
  integrations: "Integrations",
  team: "Team",
  branding: "Branding",
  billing: "Billing",
  api: "API & Webhooks",
  guide: "Connect your app",
  activity: "Activity",
  settings: "Settings",
};

export const commandActions = [
  { label: "Create release", href: "/app/releases/new", keywords: ["new", "release", "draft"], shortcut: "Alt N" },
  { label: "Open AI Studio", href: "/app/ai-studio", keywords: ["ai", "studio", "write", "rewrite"], shortcut: "Alt A" },
  { label: "Review releases in review", href: "/app/releases?status=in_review", keywords: ["approve", "review"] },
  { label: "Search feedback", href: "/app/feedback", keywords: ["feedback", "requests", "votes"] },
  { label: "Open roadmap", href: "/app/roadmap", keywords: ["roadmap", "planning"] },
  { label: "View analytics", href: "/app/analytics", keywords: ["analytics", "metrics", "engagement"] },
  { label: "Install the in-app widget", href: "/app/widget", keywords: ["widget", "install", "embed", "launcher"] },
  { label: "View activity", href: "/app/activity", keywords: ["activity", "notifications", "log"] },
  { label: "Invite teammate", href: "/app/team", keywords: ["team", "invite", "roles"] },
  // ":workspace" is replaced with the active workspace's slug.
  { label: "Open public changelog", href: "/c/:workspace", keywords: ["public", "changelog", "customers"] },
];
