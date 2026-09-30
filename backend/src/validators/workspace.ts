import { z } from "zod";
import {
  API_KEY_SCOPES,
  FEEDBACK_STATUSES,
  PLANS,
  PRIORITIES,
  ROADMAP_STATUSES,
  TEAM_ROLES,
  WEBHOOK_EVENTS,
  CHANNELS,
  INTEGRATION_PROVIDERS,
} from "../types/domain.js";
import { cta, email, httpUrl, linkTarget, name, richText, shortText, tags } from "./common.js";

// Feedback ---------------------------------------------------------------------

export const listFeedbackQuery = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(["votes", "newest"]).default("votes"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});
export const createFeedbackSchema = z.object({
  title: shortText(200).min(3, "Give the request a short title."),
  description: shortText(5000).default(""),
  tags: tags.optional(),
  priority: z.enum(PRIORITIES).optional(),
  source: z.enum(["customer", "internal"]).optional(),
});
export const updateFeedbackSchema = z.object({
  title: shortText(200).min(3).optional(),
  description: shortText(5000).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  tags: tags.optional(),
  internalNotes: shortText(5000).nullable().optional(),
  linkedReleaseId: z.uuid().nullable().optional(),
});
export const commentSchema = z.object({ body: shortText(5000).min(1, "Write a comment first."), isInternal: z.boolean().optional() });
export const mergeSchema = z.object({ targetId: z.uuid() });

// Roadmap ----------------------------------------------------------------------

const roadmapFields = {
  title: shortText(200).min(1),
  description: shortText(5000),
  status: z.enum(ROADMAP_STATUSES),
  priority: z.enum(PRIORITIES),
  isPublic: z.boolean(),
  targetDate: z.iso.date().nullable(),
  linkedReleaseId: z.uuid().nullable(),
  linkedFeedbackIds: z.array(z.uuid()).max(500),
};
export const createRoadmapSchema = z.object(roadmapFields).partial();
export const updateRoadmapSchema = z.object(roadmapFields).partial();
export const reorderRoadmapSchema = z.object({ status: z.enum(ROADMAP_STATUSES), ids: z.array(z.uuid()).max(500) });
export const fromClusterSchema = z.object({ clusterId: z.uuid() });

// Email ------------------------------------------------------------------------

const campaignFields = {
  releaseId: z.uuid(),
  subject: shortText(200),
  previewText: shortText(300),
  from: shortText(80),
  replyTo: email.nullable(),
  audienceId: z.union([z.uuid(), z.literal("")]).nullable().transform((value) => value || null),
  body: richText,
  cta: cta.nullable(),
  status: z.enum(["draft", "scheduled"]),
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
};
export const createCampaignSchema = z.object(campaignFields).partial().required({ releaseId: true });
export const updateCampaignSchema = z.object(campaignFields).partial();
export const byReleaseQuery = z.object({ releaseId: z.uuid() });

const audienceRules = z
  .object({
    plans: z.array(shortText(40)).max(20).optional(),
    tags: z.array(shortText(40)).max(20).optional(),
    accountAgeDays: z.number().int().min(0).max(36500).optional(),
  })
  .strict();
export const audienceRulesSchema = audienceRules;
export const createAudienceSchema = z.object({ name: name, rules: audienceRules });

// Team -------------------------------------------------------------------------

export const inviteSchema = z.object({ name, email, role: z.enum(TEAM_ROLES) });
export const roleSchema = z.object({ role: z.enum(TEAM_ROLES) });

// Settings, branding, widget ---------------------------------------------------

export const settingsSchema = z.object({
  name: shortText(80).min(2).optional(),
  slug: z.string().trim().toLowerCase().max(50).optional(),
  brandVoice: shortText(2000).optional(),
  timezone: z
    .string()
    .max(64)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone.")
    .optional(),
  notifications: z
    .object({ emailDigest: z.boolean(), releaseApproved: z.boolean(), feedbackCluster: z.boolean(), integrationErrors: z.boolean() })
    .partial()
    .optional(),
});
export const deleteWorkspaceSchema = z.object({ confirmation: z.string().max(200) });

export const brandingSchema = z.object({
  logoUrl: linkTarget.nullable().optional(),
  faviconUrl: linkTarget.nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #C85069.").optional(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .refine((value) => value === "" || /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(value), "Enter a domain like updates.example.com.")
    .optional(),
  publicTheme: z.enum(["light", "dark", "system"]).optional(),
  widgetTheme: z.enum(["inherit", "light", "dark"]).optional(),
});

export const widgetSettingsSchema = z.object({
  launcherMode: z.enum(["default", "manual"]).optional(),
  placement: z.enum(["bottom-right", "bottom-left"]).optional(),
  showUnreadBadge: z.boolean().optional(),
  theme: z.enum(["inherit", "light", "dark"]).optional(),
});

// Developer --------------------------------------------------------------------

export const createApiKeySchema = z.object({
  name: shortText(80).min(1, "Give the key a name."),
  scopes: z.array(z.enum(API_KEY_SCOPES)).max(API_KEY_SCOPES.length).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});
export const createWebhookSchema = z.object({ url: httpUrl, events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Choose at least one event.").max(WEBHOOK_EVENTS.length) });
export const updateWebhookSchema = z.object({
  url: httpUrl.optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export const deliveriesQuery = z.object({ webhookId: z.uuid().optional() });

// AI ---------------------------------------------------------------------------

const clientContext = {
  audienceId: z.uuid().nullable().optional(),
  sourceRefs: z.array(z.object({ type: z.enum(["github", "linear", "gitlab", "jira", "manual"]), label: shortText(200) })).max(20).optional(),
};
export const aiGenerateReleaseSchema = z.object({ material: z.string().max(50_000), releaseId: z.uuid().optional(), ...clientContext });
export const aiRewriteSchema = z.object({
  text: z.string().max(50_000),
  instruction: shortText(500).min(1),
  attempt: z.number().int().min(0).max(20).default(0),
  releaseId: z.uuid().optional(),
  ...clientContext,
});
export const aiVariantSchema = z.object({
  channel: z.enum(CHANNELS),
  releaseId: z.uuid().optional(),
  release: z.object({ title: shortText(200), summary: shortText(1000), body: z.string().max(50_000), inAppFormat: z.enum(["feed", "banner", "modal", "toast", "contextual"]).optional() }).optional(),
  ...clientContext,
});
export const aiQualitySchema = z.object({
  title: shortText(200).default(""),
  summary: shortText(1000).default(""),
  body: z.string().max(50_000).default(""),
  cta: z.object({ label: z.string().max(60).optional() }).nullable().optional(),
  releaseId: z.uuid().optional(),
});

// Misc -------------------------------------------------------------------------

export const providerParam = z.object({ provider: z.enum(INTEGRATION_PROVIDERS) });
/** Optional start date (YYYY-MM-DD) to pull older work instead of "since the last sync". */
export const syncSchema = z.object({ since: z.iso.date().optional() });
export const integrationUpdateSchema = z.object({
  detail: shortText(200),
  /** GitHub/GitLab only: read merged pull/merge requests, or every commit on the default branch. */
  track: z.enum(["pull_requests", "commits"]).optional(),
});
export const rangeQuery = z.object({ range: z.enum(["7d", "30d", "90d"]).default("30d") });
export const checkoutSchema = z.object({ plan: z.enum(PLANS) });
export const activityQuery = z.object({
  unreadOnly: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
  type: z.enum(["ai_generated", "approved", "published", "integration", "feedback", "scheduled", "comment"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const migrationSchema = z.object({
  source: z.enum(["headway", "featurebase", "csv", "json", "other"]),
  uploadId: z.uuid("Choose an export file first."),
  preserveDates: z.boolean().default(true),
  preserveFormatting: z.boolean().default(true),
});
export const uploadPurposeSchema = z.object({ purpose: z.enum(["logo", "favicon", "media", "import"]) });
export const commentParams = z.object({ id: z.uuid(), commentId: z.uuid() });
export const transferSchema = z.object({ membershipId: z.uuid() });
