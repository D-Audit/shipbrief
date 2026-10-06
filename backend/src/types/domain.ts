/**
 * Domain value types shared by the schema, services and API responses.
 * They intentionally mirror `src/types/index.ts` in the web app, which is the
 * contract the frontend was built against.
 */

export const CHANNELS = ["changelog", "email", "in_app"] as const;
export type Channel = (typeof CHANNELS)[number];

export const RELEASE_STATUSES = ["draft", "in_review", "approved", "scheduled", "published", "archived"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const TEAM_ROLES = ["owner", "admin", "product_manager", "marketer", "developer", "viewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const FEEDBACK_STATUSES = ["new", "reviewing", "planned", "in_progress", "shipped", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ROADMAP_STATUSES = ["now", "next", "later", "shipped"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const IN_APP_FORMATS = ["feed", "banner", "modal", "toast", "contextual"] as const;
export type InAppFormat = (typeof IN_APP_FORMATS)[number];

export const INTEGRATION_PROVIDERS = ["github", "linear", "gitlab", "jira"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const PLANS = ["starter", "pro", "scale"] as const;
export type Plan = (typeof PLANS)[number];

export type SourceRef = {
  id: string;
  type: "github" | "linear" | "gitlab" | "jira" | "manual";
  label: string;
  url?: string;
};

export type ReleaseCta = { label: string; url: string };

export type ReleaseMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  alt?: string;
  caption?: string;
  posterUrl?: string;
};

type ChannelVariantContent = {
  title: string;
  summary: string;
  body: string;
  subject?: string;
  previewText?: string;
};

export type ChannelVariant =
  | (ChannelVariantContent & { channel: "changelog" })
  | (ChannelVariantContent & { channel: "email" })
  | (ChannelVariantContent & { channel: "in_app"; format: InAppFormat });

export type ChannelVariantMap = Partial<{
  changelog: Extract<ChannelVariant, { channel: "changelog" }>;
  email: Extract<ChannelVariant, { channel: "email" }>;
  in_app: Extract<ChannelVariant, { channel: "in_app" }>;
}>;

/** The versioned part of a release, as stored in `release_versions.snapshot`. */
export type ReleaseSnapshot = {
  title: string;
  summary: string;
  body: string;
  channels: Channel[];
  audienceId: string | null;
  cta: ReleaseCta | null;
  channelVariants: ChannelVariantMap;
};

export type AudienceRules = {
  plans?: string[];
  tags?: string[];
  accountAgeDays?: number;
};

/** How a contact first reached the workspace: added in the app, a CSV import, the public API, the changelog subscribe form or the in-app widget. */
export type ContactSource = "manual" | "import" | "api" | "changelog" | "widget";

export type WorkspaceNotificationSettings = {
  emailDigest: boolean;
  releaseApproved: boolean;
  feedbackCluster: boolean;
  integrationErrors: boolean;
};

export const WEBHOOK_EVENTS = [
  "release.created",
  "release.updated",
  "release.submitted",
  "release.approved",
  "release.scheduled",
  "release.published",
  "release.archived",
  "feedback.created",
  "feedback.updated",
  "roadmap.updated",
  "campaign.sent",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const API_KEY_SCOPES = [
  "releases:read",
  "feedback:read",
  "feedback:write",
  "contacts:write",
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
