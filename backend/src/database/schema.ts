import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AudienceRules,
  ChannelVariantMap,
  ReleaseCta,
  ReleaseMedia,
  ReleaseSnapshot,
  SourceRef,
  WorkspaceNotificationSettings,
} from "../types/domain.js";

/**
 * Data ownership: every tenant-owned row carries `workspace_id`, and every
 * service query filters by it. Column names are snake_case in Postgres via
 * the `casing` option in the Drizzle client and drizzle-kit config.
 */

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const deletedAt = () => timestamp({ withTimezone: true });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const teamRole = pgEnum("team_role", ["owner", "admin", "product_manager", "marketer", "developer", "viewer"]);
export const releaseStatus = pgEnum("release_status", ["draft", "in_review", "approved", "scheduled", "published", "archived"]);
export const channel = pgEnum("channel", ["changelog", "email", "in_app"]);
export const publicationStatus = pgEnum("publication_status", ["pending", "published", "failed", "skipped"]);
export const feedbackStatus = pgEnum("feedback_status", ["new", "reviewing", "planned", "in_progress", "shipped", "declined"]);
export const priority = pgEnum("priority", ["low", "medium", "high"]);
export const roadmapStatus = pgEnum("roadmap_status", ["now", "next", "later", "shipped"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "scheduled", "sending", "sent", "failed", "cancelled"]);
export const emailDeliveryStatus = pgEnum("email_delivery_status", ["queued", "sent", "logged", "failed", "skipped"]);
export const integrationProvider = pgEnum("integration_provider", ["github", "gitlab", "linear", "jira"]);
export const integrationStatus = pgEnum("integration_status", ["connected", "error", "disconnected"]);
export const webhookDeliveryStatus = pgEnum("webhook_delivery_status", ["pending", "success", "failed"]);
export const subscriptionStatus = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled", "incomplete"]);
export const plan = pgEnum("plan", ["starter", "pro", "scale"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "dead"]);
export const authTokenType = pgEnum("auth_token_type", ["verify_email", "reset_password"]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    avatarUrl: text(),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("oauth_accounts_provider_key").on(t.provider, t.providerAccountId), index().on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "set null" }),
    userAgent: text(),
    ipAddress: text(),
    createdAt: createdAt(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("sessions_token_hash_key").on(t.tokenHash), index().on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: authTokenType().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_token_hash_key").on(t.tokenHash), index().on(t.userId, t.type)],
);

/** Short-lived state for OAuth redirects (sign-in and integrations). */
export const oauthStates = pgTable("oauth_states", {
  id: uuid().primaryKey().defaultRandom(),
  stateHash: text().notNull().unique(),
  purpose: text().notNull(),
  provider: text().notNull(),
  userId: uuid().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid().references(() => workspaces.id, { onDelete: "cascade" }),
  codeVerifier: text(),
  data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Workspaces & team
// ---------------------------------------------------------------------------

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    /** Public identifier for the in-app widget ("project ID" in the UI). */
    publicKey: text().notNull(),
    brandVoice: text().notNull().default(""),
    timezone: text().notNull().default("UTC"),
    onboarding: jsonb().$type<{ role?: string; goal?: string; channels?: string[] }>().notNull().default({}),
    notificationSettings: jsonb()
      .$type<WorkspaceNotificationSettings>()
      .notNull()
      .default({ emailDigest: true, releaseApproved: true, feedbackCluster: true, integrationErrors: true }),
    logoUrl: text(),
    faviconUrl: text(),
    accentColor: text().notNull().default("#C85069"),
    customDomain: text(),
    domainStatus: text().$type<"connected" | "pending" | "none">().notNull().default("none"),
    publicTheme: text().$type<"light" | "dark" | "system">().notNull().default("light"),
    widgetTheme: text().$type<"inherit" | "light" | "dark">().notNull().default("inherit"),
    widgetLauncherMode: text().$type<"default" | "manual">().notNull().default("default"),
    widgetPlacement: text().$type<"bottom-right" | "bottom-left">().notNull().default("bottom-right"),
    widgetShowUnreadBadge: boolean().notNull().default(true),
    /** Marks rows created by the development seed so they are never mistaken for customer data. */
    isDevSeed: boolean().notNull().default(false),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("workspaces_slug_key").on(t.slug),
    uniqueIndex("workspaces_public_key_key").on(t.publicKey),
    uniqueIndex("workspaces_custom_domain_key").on(t.customDomain),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRole().notNull(),
    /** Everything in the activity feed before this moment counts as read. */
    activityReadAllAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("memberships_workspace_user_key").on(t.workspaceId, t.userId), index().on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text().notNull(),
    name: text().notNull(),
    role: teamRole().notNull(),
    invitedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("invitations_pending_email_key")
      .on(t.workspaceId, sql`lower(${t.email})`)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    index("invitations_email_idx").on(sql`lower(${t.email})`),
  ],
);

// ---------------------------------------------------------------------------
// Audiences & contacts (the customer's own end users)
// ---------------------------------------------------------------------------

export const contacts = pgTable(
  "contacts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    externalId: text(),
    email: text(),
    name: text(),
    plan: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    signedUpAt: timestamp({ withTimezone: true }),
    unsubscribedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("contacts_external_id_key").on(t.workspaceId, t.externalId),
    uniqueIndex("contacts_email_key").on(t.workspaceId, sql`lower(${t.email})`),
    index("contacts_tags_idx").using("gin", t.tags),
    index().on(t.workspaceId, t.plan),
  ],
);

export const audiences = pgTable(
  "audiences",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    rules: jsonb().$type<AudienceRules>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("audiences_workspace_name_key").on(t.workspaceId, sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`)],
);

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

export const releases = pgTable(
  "releases",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull(),
    slug: text().notNull(),
    summary: text().notNull().default(""),
    body: text().notNull().default(""),
    status: releaseStatus().notNull().default("draft"),
    channels: channel().array().notNull().default(sql`'{changelog}'::channel[]`),
    category: text().notNull().default("Feature"),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    audienceId: uuid().references(() => audiences.id, { onDelete: "set null" }),
    sourceRefs: jsonb().$type<SourceRef[]>().notNull().default([]),
    cta: jsonb().$type<ReleaseCta | null>(),
    media: jsonb().$type<ReleaseMedia[]>().notNull().default([]),
    channelVariants: jsonb().$type<ChannelVariantMap>().notNull().default({}),
    seo: jsonb().$type<{ title?: string; description?: string } | null>(),
    featured: boolean().notNull().default(false),
    reviewNote: text(),
    scheduledAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    scheduledBy: uuid().references(() => users.id, { onDelete: "set null" }),
    publishedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Denormalised counters, maintained transactionally by the engagement services. */
    views: integer().notNull().default(0),
    reactions: integer().notNull().default(0),
    comments: integer().notNull().default(0),
    searchVector: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("releases_workspace_slug_key").on(t.workspaceId, t.slug).where(sql`${t.deletedAt} is null`),
    index("releases_workspace_status_updated_idx").on(t.workspaceId, t.status, t.updatedAt.desc()),
    index("releases_workspace_published_idx").on(t.workspaceId, t.publishedAt.desc()).where(sql`${t.status} = 'published'`),
    index("releases_due_schedule_idx").on(t.scheduledAt).where(sql`${t.status} = 'scheduled'`),
    index("releases_search_idx").using("gin", t.searchVector),
    index("releases_tags_idx").using("gin", t.tags),
  ],
);

export const releaseVersions = pgTable(
  "release_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    snapshot: jsonb().$type<ReleaseSnapshot>().notNull(),
    changeNote: text(),
    changedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("release_versions_release_version_key").on(t.releaseId, t.version)],
);

/** One row per channel a release was published to. New channels add rows, not columns. */
export const releasePublications = pgTable(
  "release_publications",
  {
    id: uuid().primaryKey().defaultRandom(),
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channel: channel().notNull(),
    status: publicationStatus().notNull().default("pending"),
    publishedAt: timestamp({ withTimezone: true }),
    error: text(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("release_publications_release_channel_key").on(t.releaseId, t.channel),
    index().on(t.workspaceId, t.channel, t.status),
  ],
);

export const releaseReactions = pgTable(
  "release_reactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    visitorId: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("release_reactions_release_visitor_key").on(t.releaseId, t.visitorId)],
);

export const publicComments = pgTable(
  "public_comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorName: text().notNull(),
    body: text().notNull(),
    visitorId: text(),
    hidden: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.releaseId, t.createdAt)],
);

/** Read / dismiss state for in-app announcements, per end-user (identified or anonymous). */
export const inAppReads = pgTable(
  "in_app_reads",
  {
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    visitorId: text().notNull(),
    readAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.releaseId, t.visitorId] }), index().on(t.workspaceId, t.visitorId)],
);

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    releaseId: uuid()
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    subject: text().notNull(),
    previewText: text().notNull().default(""),
    fromName: text().notNull(),
    replyTo: text(),
    audienceId: uuid().references(() => audiences.id, { onDelete: "set null" }),
    status: campaignStatus().notNull().default("draft"),
    body: text(),
    cta: jsonb().$type<ReleaseCta | null>(),
    scheduledAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    recipientCount: integer().notNull().default(0),
    deliveredCount: integer().notNull().default(0),
    failedCount: integer().notNull().default(0),
    lastError: text(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaigns_release_idx").on(t.releaseId, t.createdAt.desc()), index().on(t.workspaceId, t.status)],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: uuid().references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    toEmail: text().notNull(),
    template: text().notNull(),
    subject: text().notNull(),
    status: emailDeliveryStatus().notNull().default("queued"),
    provider: text(),
    providerMessageId: text(),
    error: text(),
    attempts: integer().notNull().default(0),
    sentAt: timestamp({ withTimezone: true }),
    openedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("email_deliveries_campaign_contact_key").on(t.campaignId, t.contactId), index().on(t.workspaceId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Feedback & roadmap
// ---------------------------------------------------------------------------

export const feedbackClusters = pgTable(
  "feedback_clusters",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull(),
    topNeed: text().notNull(),
    demand: priority().notNull(),
    representativeQuotes: jsonb().$type<string[]>().notNull().default([]),
    aiGenerationId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId)],
);

export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    status: roadmapStatus().notNull().default("later"),
    priority: priority().notNull().default("medium"),
    position: integer().notNull().default(0),
    isPublic: boolean().notNull().default(true),
    targetDate: date(),
    linkedReleaseId: uuid().references(() => releases.id, { onDelete: "set null" }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index().on(t.workspaceId, t.status, t.position)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    status: feedbackStatus().notNull().default("new"),
    priority: priority().notNull().default("medium"),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    source: text().$type<"customer" | "internal">().notNull().default("customer"),
    votes: integer().notNull().default(0),
    comments: integer().notNull().default(0),
    internalNotes: text(),
    roadmapItemId: uuid().references(() => roadmapItems.id, { onDelete: "set null" }),
    linkedReleaseId: uuid().references(() => releases.id, { onDelete: "set null" }),
    clusterId: uuid().references(() => feedbackClusters.id, { onDelete: "set null" }),
    mergedIntoId: uuid(),
    submitterName: text(),
    submitterEmail: text(),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    searchVector: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("feedback_workspace_status_idx").on(t.workspaceId, t.status),
    index("feedback_workspace_votes_idx").on(t.workspaceId, t.votes.desc()),
    index().on(t.roadmapItemId),
    index().on(t.clusterId),
    index("feedback_search_idx").using("gin", t.searchVector),
  ],
);

export const feedbackVotes = pgTable(
  "feedback_votes",
  {
    id: uuid().primaryKey().defaultRandom(),
    feedbackId: uuid()
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** `user:<id>`, `contact:<id>` or `visitor:<id>` — one vote per voter per request. */
    voterKey: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feedback_votes_voter_key").on(t.feedbackId, t.voterKey)],
);

export const feedbackComments = pgTable(
  "feedback_comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    feedbackId: uuid()
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    body: text().notNull(),
    isInternal: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.feedbackId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Activity, notifications, audit
// ---------------------------------------------------------------------------

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text()
      .$type<"ai_generated" | "approved" | "published" | "integration" | "feedback" | "scheduled" | "comment">()
      .notNull(),
    message: text().notNull(),
    link: text(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorName: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId, t.createdAt.desc())],
);

export const activityReads = pgTable(
  "activity_reads",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid()
      .notNull()
      .references(() => activityEvents.id, { onDelete: "cascade" }),
    readAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    ipAddress: text(),
    userAgent: text(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId, t.createdAt.desc()), index().on(t.userId, t.createdAt.desc())],
);

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    releaseId: uuid().references(() => releases.id, { onDelete: "cascade" }),
    type: text().notNull(),
    channel: text(),
    visitorId: text(),
    properties: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.workspaceId, t.occurredAt), index().on(t.releaseId, t.type)],
);

/** Daily roll-up maintained by the worker; dashboards read this, never the raw events. */
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    day: date().notNull(),
    type: text().notNull(),
    channel: text().notNull().default(""),
    /** Empty string for workspace-level events so the composite key stays NOT NULL. */
    releaseKey: text().notNull().default(""),
    count: integer().notNull().default(0),
    uniqueVisitors: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.day, t.type, t.channel, t.releaseKey] })],
);

// ---------------------------------------------------------------------------
// Integrations, API keys, webhooks
// ---------------------------------------------------------------------------

export const integrations = pgTable(
  "integrations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: integrationProvider().notNull(),
    status: integrationStatus().notNull().default("connected"),
    accountLabel: text(),
    detail: text().notNull().default(""),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    accessTokenEnc: text(),
    refreshTokenEnc: text(),
    tokenExpiresAt: timestamp({ withTimezone: true }),
    scopes: text(),
    lastSyncAt: timestamp({ withTimezone: true }),
    lastError: text(),
    connectedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integrations_workspace_provider_key").on(t.workspaceId, t.provider)],
);

export const integrationItems = pgTable(
  "integration_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    integrationId: uuid()
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    externalId: text().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    url: text(),
    completedAt: timestamp({ withTimezone: true }),
    releaseId: uuid().references(() => releases.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("integration_items_external_key").on(t.integrationId, t.externalId)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    prefix: text().notNull(),
    keyHash: text().notNull(),
    scopes: text().array().notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("api_keys_key_hash_key").on(t.keyHash), index().on(t.workspaceId)],
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text().notNull(),
    events: text().array().notNull(),
    active: boolean().notNull().default(true),
    secretEnc: text().notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    lastDeliveryAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index().on(t.workspaceId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Stable per event; receivers use it as an idempotency key across retries. */
    eventId: uuid().notNull(),
    event: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    responseCode: integer(),
    responseExcerpt: text(),
    error: text(),
    nextAttemptAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("webhook_deliveries_webhook_event_key").on(t.webhookId, t.eventId),
    index().on(t.workspaceId, t.createdAt.desc()),
  ],
);

// ---------------------------------------------------------------------------
// Billing & usage
// ---------------------------------------------------------------------------

export const subscriptions = pgTable("subscriptions", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  plan: plan().notNull().default("pro"),
  status: subscriptionStatus().notNull().default("trialing"),
  trialEndsAt: timestamp({ withTimezone: true }),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  stripeCustomerId: text().unique(),
  stripeSubscriptionId: text().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerInvoiceId: text().notNull().unique(),
    amountCents: integer().notNull(),
    currency: text().notNull(),
    status: text().notNull(),
    hostedUrl: text(),
    issuedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId, t.issuedAt.desc())],
);

/** Processed provider webhook events — makes billing webhooks idempotent. */
export const billingEvents = pgTable("billing_events", {
  id: uuid().primaryKey().defaultRandom(),
  providerEventId: text().notNull().unique(),
  type: text().notNull(),
  workspaceId: uuid().references(() => workspaces.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const usageCounters = pgTable(
  "usage_counters",
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    metric: text().notNull(),
    /** `YYYY-MM` billing period. */
    period: text().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.metric, t.period] })],
);

// ---------------------------------------------------------------------------
// AI, uploads, imports
// ---------------------------------------------------------------------------

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    releaseId: uuid().references(() => releases.id, { onDelete: "set null" }),
    operation: text().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    status: text().$type<"succeeded" | "failed">().notNull(),
    input: jsonb().$type<Record<string, unknown>>().notNull(),
    output: jsonb().$type<Record<string, unknown> | null>(),
    errorCode: text(),
    errorMessage: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    latencyMs: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId, t.createdAt.desc()), index().on(t.releaseId)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    purpose: text().$type<"logo" | "favicon" | "media" | "import">().notNull(),
    storageKey: text().notNull().unique(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    originalName: text().notNull(),
    sha256: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.workspaceId)],
);

export const migrationImports = pgTable("migration_imports", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  uploadId: uuid().references(() => uploads.id, { onDelete: "set null" }),
  source: text().notNull(),
  status: text().$type<"previewed" | "imported" | "failed">().notNull(),
  stats: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export const jobs = pgTable(
  "jobs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatus().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(5),
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    lockedBy: text(),
    lastError: text(),
    /** Optional idempotency key: at most one queued/running job per key. */
    dedupeKey: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("jobs_ready_idx").on(t.runAt).where(sql`${t.status} = 'queued'`),
    uniqueIndex("jobs_dedupe_key").on(t.dedupeKey).where(sql`${t.status} in ('queued', 'running')`),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  windowStart: timestamp({ withTimezone: true }).notNull(),
  count: integer().notNull(),
});

export const systemState = pgTable("system_state", {
  key: text().primaryKey(),
  value: jsonb().$type<Record<string, unknown>>().notNull(),
  updatedAt: updatedAt(),
});
