/**
 * Shared TypeScript contracts — mirrored from product specification.
 */

export type ReleaseStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

export type Channel = "changelog" | "email" | "in_app";

/**
 * The presentation selected for an in-app announcement. This is deliberately
 * content-only: delivery placement, frequency, and targeting stay behind the
 * future backend/widget boundary.
 */
export type InAppFormat = "feed" | "banner" | "modal" | "toast" | "contextual";

export type SourceRef = {
  id: string;
  type: "github" | "linear" | "manual";
  label: string;
  url?: string;
};

export type Release = {
  id: string;
  title: string;
  summary: string;
  body: string;
  status: ReleaseStatus;
  channels: Channel[];
  category: string;
  tags: string[];
  audienceId?: string;
  scheduledAt?: string;
  publishedAt?: string;
  sourceRefs: SourceRef[];
  views: number;
  reactions: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
  slug?: string;
  featured?: boolean;
  cta?: { label: string; url: string };
  media?: ReleaseMedia[];
  channelVariants?: ChannelVariantMap;
  createdBy?: string;
  reviewedBy?: string;
  publishedBy?: string;
  /** Search and social metadata for the public changelog page. */
  seo?: { title?: string; description?: string };
  /** Reviewer note left when changes were requested. */
  reviewNote?: string;
  /** Per-channel delivery state, returned when a single release is fetched. */
  publications?: ReleasePublication[];
};

export type ReleasePublication = {
  channel: Channel;
  status: "pending" | "published" | "failed" | "skipped";
  publishedAt?: string;
  error?: string;
};

/**
 * The public changelog shape: only published, customer-facing fields. Internal
 * data (authors, status, counters beyond engagement) never leaves the API.
 */
export type PublicRelease = Pick<Release, "id" | "title" | "summary" | "body" | "category" | "tags" | "reactions" | "comments" | "cta" | "media" | "seo"> & {
  slug: string;
  publishedAt: string;
  featured: boolean;
  /** Present only when the workspace shows authors on its changelog. */
  author?: { name: string };
};

/**
 * A comment left on a published changelog update. These are intentionally
 * separate from internal feedback comments so the public surface can be
 * connected to its own API later.
 */
export type PublicReleaseComment = {
  id: string;
  releaseId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type PublicReleaseEngagement = {
  reactions: number;
  comments: number;
  hasReacted: boolean;
};

export type CreatePublicReleaseCommentInput = {
  workspace: string;
  slug: string;
  author?: string;
  body: string;
};

export type ReleaseMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  alt?: string;
  /** A visible, optional description shown underneath the public media. */
  caption?: string;
  /** Optional preview image for video media. */
  posterUrl?: string;
};

export type ReleaseVersion = {
  id: string;
  releaseId: string;
  version: number;
  title: string;
  summary: string;
  body: string;
  /**
   * A saved Studio version retains the independently edited delivery drafts
   * alongside the master release. These fields are optional so the original
   * seeded history remains compatible with the richer mock snapshots.
   */
  channels?: Channel[];
  audienceId?: string;
  cta?: Release["cta"];
  channelVariants?: ChannelVariantMap;
  changedBy: string;
  changedAt: string;
  changeNote?: string;
};

export type ApprovalStep = {
  status: ReleaseStatus;
  label: string;
  actor?: string;
  timestamp?: string;
};

export type FeedbackStatus =
  | "new"
  | "reviewing"
  | "planned"
  | "in_progress"
  | "shipped"
  | "declined";

export type FeedbackRequest = {
  id: string;
  title: string;
  description: string;
  votes: number;
  comments: number;
  status: FeedbackStatus;
  tags: string[];
  aiClusterId?: string;
  roadmapItemId?: string;
  linkedReleaseId?: string;
  source?: "customer" | "internal";
  createdAt?: string;
  updatedAt?: string;
  priority?: "low" | "medium" | "high";
  internalNotes?: string;
  mergedIntoId?: string;
  /** Whether the signed-in teammate has voted for this request. */
  hasVoted?: boolean;
  /** Customer contact details; only returned to roles that manage feedback. */
  submitter?: { name?: string; email?: string };
};

export type FeedbackComment = {
  id: string;
  feedbackId: string;
  author: string;
  body: string;
  createdAt: string;
  isInternal?: boolean;
};

export type FeedbackCluster = {
  id: string;
  title: string;
  votes: number;
  comments: number;
  demand: "high" | "medium" | "low";
  topNeed: string;
  representativeQuotes: string[];
  feedbackIds: string[];
};

export type RoadmapStatus = "now" | "next" | "later" | "shipped";

export type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  votes: number;
  linkedFeedbackIds: string[];
  linkedReleaseId?: string;
  targetDate?: string;
  priority?: "low" | "medium" | "high";
  isPublic?: boolean;
};

export type TeamRole =
  | "owner"
  | "admin"
  | "product_manager"
  | "marketer"
  | "developer"
  | "viewer";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "invited";
};

export type IntegrationProvider = "github" | "linear" | "gitlab" | "jira";

export type Integration = {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: "connected" | "available" | "disconnected";
  detail: string;
  lastSync: string | null;
  /** Connected account label (e.g. GitHub username). */
  account?: string;
  lastError?: string;
  /** False when this installation has no OAuth app credentials for the provider. */
  configured?: boolean;
  /** What the detail field should contain (repository, project or team key). */
  targetHint?: string;
  /** GitHub/GitLab: read every commit on the default branch, or only merged pull/merge requests. */
  track?: "commits" | "pull_requests";
};

/** A repository, project or team a connected source can watch. */
export type IntegrationTarget = {
  value: string;
  label: string;
  description?: string;
  private?: boolean;
  updatedAt?: string;
};

export type MigrationSource = "headway" | "featurebase" | "csv" | "json" | "other";

export type MigrationPreview = {
  source: MigrationSource;
  fileName?: string;
  posts: number;
  images: number;
  tags: number;
  conflicts: number;
};

export type MigrationResult = MigrationPreview & {
  imported: number;
  preservedDates: boolean;
  preservedFormatting: boolean;
};

export type Contact = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  tags: string[];
  externalId: string | null;
  subscribed: boolean;
  unsubscribedAt: string | null;
  /** How they first arrived; null for contacts added before sources were recorded. */
  source: "manual" | "import" | "api" | "changelog" | "widget" | null;
  /** Last time the widget saw them signed in to your product. */
  lastSeenAt: string | null;
  createdAt: string;
};

export type ContactStatusFilter = "all" | "subscribed" | "unsubscribed";

export type ContactList = {
  items: Contact[];
  total: number;
  counts: { total: number; subscribed: number; unsubscribed: number };
};

export type ContactImportResult = {
  added: number;
  updated: number;
  skipped: { row: number; reason: string }[];
  skippedCount: number;
};

export type Audience = {
  id: string;
  name: string;
  size: number;
  rules: {
    plans?: string[];
    tags?: string[];
    accountAgeDays?: number;
  };
};

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export type Campaign = {
  id: string;
  releaseId: string;
  subject: string;
  previewText: string;
  from: string;
  replyTo?: string;
  audienceId: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  body?: string;
  cta?: { label: string; url: string };
  stats?: { recipients: number; delivered: number; failed: number };
  lastError?: string;
};

export type ChangelogEntry = {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  publishedAt: string;
  slug: string;
  featured: boolean;
  status: ReleaseStatus;
  reactions: number;
  comments: number;
};

/**
 * The manager keeps these query options at the service boundary so a future
 * API can own filtering and ordering without changing the workspace UI.
 */
export type ChangelogSort = "newest" | "oldest" | "most_engaged" | "most_discussed";

export type ChangelogListFilters = {
  search?: string;
  category?: string;
  status?: ReleaseStatus;
  tag?: string;
  sort?: ChangelogSort;
};

export type ChangelogFilterOptions = {
  categories: string[];
  tags: string[];
};

export type AnalyticsOverview = {
  views: number;
  clicks?: number;
  ctaClicks?: number;
  reactions: number;
  engagement: number;
  channelBreakdown: { channel: string; percentage: number }[];
  topReleases: { id: string; title: string; views: number; engagement: number }[];
  releasePerformance: { id: string; title: string; score: number }[];
  audiencePerformance?: { audience: string; engagement: number; recipients: number }[];
  emailsSent?: number;
};

export type ActivityEvent = {
  id: string;
  type: "ai_generated" | "approved" | "published" | "integration" | "feedback" | "scheduled" | "comment";
  message: string;
  timestamp: string;
  link?: string;
  actor?: string;
  read?: boolean;
};

export type BillingInfo = {
  plan: string;
  price: number;
  usagePercent: number;
  features: string[];
  invoices: { id: string; date: string; amount: number; status: string }[];
  paymentMethod?: { brand: string; last4: string; expires: string } | null;
  status?: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  effectivePlan?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  usage?: { aiGenerations: { used: number; limit: number }; emails: { used: number; limit: number } };
  /** False when Stripe isn't configured for this installation. */
  billingConfigured?: boolean;
};

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  scopes?: string[];
  expiresAt?: string;
};

/** Returned once, at creation. The secret is never retrievable again. */
export type CreatedApiKey = ApiKey & { secret: string };

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastDelivery?: string;
};

/** Returned once, at creation. Use the secret to verify the ShipBrief-Signature header. */
export type CreatedWebhook = Webhook & { secret: string };

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  event: string;
  status: "pending" | "success" | "failed";
  deliveredAt: string;
  responseCode: number;
  attempts?: number;
  error?: string;
};

export type WorkspaceBranding = {
  logoUrl: string | null;
  accentColor: string;
  faviconUrl: string | null;
  domain: string;
  domainStatus: "connected" | "pending" | "none";
  publicTheme: "light" | "dark" | "system";
  widgetTheme: "inherit" | "light" | "dark";
};

/** Public changelog settings (Changelog page). */
export type ChangelogSettings = {
  enabled: boolean;
  allowSubscriptions: boolean;
  showAuthor: boolean;
  /** Public changelog URL and its RSS feed. */
  url: string;
  rssUrl: string;
};

export type WorkspaceSettings = {
  name: string;
  slug: string;
  brandVoice: string;
  timezone: string;
  notifications: {
    emailDigest: boolean;
    releaseApproved: boolean;
    feedbackCluster: boolean;
    integrationErrors: boolean;
  };
};

type ChannelVariantContent = {
  title: string;
  summary: string;
  body: string;
  subject?: string;
  previewText?: string;
};

export type ChangelogChannelVariant = ChannelVariantContent & {
  channel: "changelog";
};

export type EmailChannelVariant = ChannelVariantContent & {
  channel: "email";
};

/**
 * In-app presentation is stored only on the in-app channel variant so it
 * cannot alter the canonical release, changelog, or email content.
 */
export type InAppChannelVariant = ChannelVariantContent & {
  channel: "in_app";
  format: InAppFormat;
};

export type ChannelVariant =
  | ChangelogChannelVariant
  | EmailChannelVariant
  | InAppChannelVariant;

export type ChannelVariantMap = Partial<{
  changelog: ChangelogChannelVariant;
  email: EmailChannelVariant;
  in_app: InAppChannelVariant;
}>;

export type AIAction = {
  id: string;
  label: string;
  instruction: string;
  kind?: "rewrite" | "channel_variant";
  targetChannel?: Channel;
};

export type AIGenerationResult = {
  id: string;
  content: string;
  summary?: string;
  /** A concise, display-safe record of the context supplied to the proposal. */
  contextSummary?: string;
  channel?: Channel;
  title?: string;
  subject?: string;
  previewText?: string;
};

/**
 * Context passed across the frontend AI boundary. Keeping this explicit means
 * a future API can receive workspace guidance without the Studio needing to
 * change its UI or generation flow.
 */
export type AIGenerationContext = {
  brandVoice?: string;
  audience?: Pick<Audience, "id" | "name" | "rules">;
  sourceRefs?: SourceRef[];
};

export type AIChannelVariantResult = {
  variant: ChannelVariant;
  contextSummary: string;
};

export type AIQualityIssue = {
  id: string;
  severity: "info" | "warning";
  title: string;
  detail: string;
  suggestion: string;
};

export type AIQualityReport = {
  score: number;
  issues: AIQualityIssue[];
  strengths: string[];
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string }
  | { status: "empty" };
