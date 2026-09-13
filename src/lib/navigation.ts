import {
  Activity,
  BarChart3,
  Bell,
  Blocks,
  CreditCard,
  Globe,
  LayoutDashboard,
  Map,
  Megaphone,
  MessageSquare,
  Palette,
  Rocket,
  Settings,
  Sparkles,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export const workspaceNav: NavSection[] = [
  {
    items: [
      { title: "Overview", href: "/app/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Releases", href: "/app/releases", icon: Rocket },
      { title: "Changelog", href: "/app/changelog", icon: Globe },
      { title: "Widget", href: "/app/widget", icon: Bell },
      { title: "Campaigns", href: "/app/campaigns", icon: Megaphone },
      { title: "Feedback", href: "/app/feedback", icon: MessageSquare },
      { title: "Roadmap", href: "/app/roadmap", icon: Map },
      { title: "Analytics", href: "/app/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "AI",
    items: [
      { title: "AI Studio", href: "/app/ai-studio", icon: Sparkles, badge: "New" },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Integrations", href: "/app/integrations", icon: Blocks },
      { title: "Team", href: "/app/team", icon: Users },
      { title: "Branding", href: "/app/branding", icon: Palette },
      { title: "Billing", href: "/app/billing", icon: CreditCard },
      { title: "API", href: "/app/api", icon: Webhook },
      { title: "Activity", href: "/app/activity", icon: Activity },
      { title: "Settings", href: "/app/settings", icon: Settings },
    ],
  },
];

export const commandActions = [
  { label: "Create release", href: "/app/releases/new", keywords: ["new", "release"], shortcut: "Alt N" },
  { label: "Open AI Studio", href: "/app/ai-studio", keywords: ["ai", "studio", "assistant"], shortcut: "Alt A" },
  { label: "Search releases", href: "/app/releases", keywords: ["releases", "list"] },
  { label: "Search feedback", href: "/app/feedback", keywords: ["feedback", "requests"] },
  { label: "Open roadmap", href: "/app/roadmap", keywords: ["roadmap", "planning"] },
  { label: "View analytics", href: "/app/analytics", keywords: ["analytics", "metrics"] },
  { label: "Install What's New widget", href: "/app/widget", keywords: ["widget", "install", "embed", "launcher"] },
  { label: "Invite teammate", href: "/app/team", keywords: ["team", "invite"] },
  { label: "Open settings", href: "/app/settings", keywords: ["settings", "preferences"] },
];
