import { api, downloadFile } from "@/lib/api/client";
import type {
  ActivityEvent,
  IntegrationTarget,
  AIChannelVariantResult,
  AIGenerationContext,
  AIGenerationResult,
  AIQualityReport,
  AnalyticsOverview,
  ApiKey,
  Audience,
  BillingInfo,
  Campaign,
  Channel,
  Contact,
  ContactImportResult,
  ContactList,
  ContactStatusFilter,
  ChangelogEntry,
  ChangelogFilterOptions,
  ChangelogListFilters,
  CreatedApiKey,
  CreatedWebhook,
  CreatePublicReleaseCommentInput,
  FeedbackCluster,
  FeedbackComment,
  FeedbackRequest,
  FeedbackStatus,
  Integration,
  MigrationPreview,
  MigrationResult,
  MigrationSource,
  PublicRelease,
  PublicReleaseComment,
  PublicReleaseEngagement,
  Release,
  ReleaseStatus,
  ReleaseVersion,
  RoadmapItem,
  TeamMember,
  Webhook,
  WebhookDelivery,
  WorkspaceBranding,
  WorkspaceSettings,
} from "@/types";

/**
 * Typed service layer over the ShipBrief API. Pages call these functions and
 * never build requests themselves; signatures match the original frontend
 * contracts so the UI didn't need to change shape.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: string | undefined | null) => (value && UUID.test(value) ? value : null);

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

const RELEASE_FIELDS = ["title", "summary", "body", "channels", "category", "tags", "audienceId", "sourceRefs", "cta", "media", "channelVariants", "seo", "featured", "slug"] as const;

/**
 * Sends only editable fields. A field present with `undefined` (e.g. a removed
 * CTA) is sent as `null` so the server clears it — JSON would otherwise drop it.
 */
function toReleasePayload(input: Partial<Release>) {
  const payload: Record<string, unknown> = {};
  for (const field of RELEASE_FIELDS) {
    if (!(field in input)) continue;
    const value = input[field];
    if (field === "audienceId") payload.audienceId = uuidOrNull(value as string | undefined);
    else if (field === "slug") { if (value) payload.slug = value; }
    else if (value === undefined) { if (field === "cta" || field === "seo") payload[field] = null; }
    else payload[field] = value;
  }
  return payload;
}

export const releaseService = {
  async list(filters?: { status?: ReleaseStatus; search?: string; tag?: string; category?: string }) {
    const { data } = await api.list<Release>("/releases", { query: { ...filters, pageSize: 100 } });
    return data;
  },
  get: (id: string) => api.get<Release>(`/releases/${id}`),
  create: (input: Partial<Release>) => api.post<Release>("/releases", toReleasePayload(input)),
  update: (id: string, input: Partial<Release>, options?: { changeNote?: string; changedBy?: string }) =>
    api.patch<Release>(`/releases/${id}`, { ...toReleasePayload(input), changeNote: options?.changeNote }),
  submitForReview: (id: string) => api.post<Release>(`/releases/${id}/submit`),
  approve: (id: string) => api.post<Release>(`/releases/${id}/approve`),
  schedule: (id: string, date: string) => api.post<Release>(`/releases/${id}/schedule`, { scheduledAt: new Date(date).toISOString() }),
  publish: (id: string) => api.post<Release>(`/releases/${id}/publish`),
  requestChanges: (id: string, note?: string) => api.post<Release>(`/releases/${id}/request-changes`, { note }),
  unschedule: (id: string) => api.post<Release>(`/releases/${id}/unschedule`),
  archive: (id: string) => api.post<Release>(`/releases/${id}/archive`),
  duplicate: (id: string) => api.post<Release>(`/releases/${id}/duplicate`),
  remove: (id: string) => api.delete<{ id: string }>(`/releases/${id}`),
  counts: () => api.get<Record<ReleaseStatus | "all", number>>("/releases/counts"),
  getVersionHistory: (id: string) => api.get<ReleaseVersion[]>(`/releases/${id}/versions`),
  restoreVersion: (id: string, versionId: string) => api.post<Release>(`/releases/${id}/versions/${versionId}/restore`),
};

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

function generationContext(context: AIGenerationContext = {}) {
  return {
    audienceId: uuidOrNull(context.audience?.id),
    sourceRefs: context.sourceRefs?.map((ref) => ({ type: ref.type, label: ref.label })),
  };
}

export const aiStudioService = {
  generateRelease: (context: string, ctx: AIGenerationContext = {}) =>
    api.post<Pick<Release, "title" | "summary" | "body"> & { contextSummary: string }>("/ai/generate-release", { material: context, ...generationContext(ctx) }),

  rewrite: (text: string, instruction: string, attempt = 0, ctx: AIGenerationContext = {}, releaseId?: string) =>
    api.post<AIGenerationResult>("/ai/rewrite", { text, instruction, attempt, releaseId: uuidOrNull(releaseId) ?? undefined, ...generationContext(ctx) }),

  generateChannelVariant: (release: Release, channel: Channel, ctx: AIGenerationContext = {}) =>
    api.post<AIChannelVariantResult>("/ai/channel-variant", {
      channel,
      releaseId: uuidOrNull(release.id) ?? undefined,
      release: { title: release.title, summary: release.summary, body: release.body, inAppFormat: release.channelVariants?.in_app?.format },
      ...generationContext(ctx),
    }),

  qualityCheck: (input: string | Pick<Release, "title" | "summary" | "body" | "cta">) => {
    const release = typeof input === "string" ? { title: "", summary: "", body: input, cta: undefined } : input;
    return api.post<AIQualityReport>("/ai/quality-check", { title: release.title, summary: release.summary, body: release.body, cta: release.cta ?? null });
  },
};

/** Legacy AI entry points kept for existing callers; all route to the same API. */
export const aiService = {
  clusterFeedback: () => api.post<FeedbackCluster[]>("/feedback/clusters/regenerate"),
  rewrite: (text: string, instruction: string) => aiStudioService.rewrite(text, instruction),
  generateChannelVariant: (release: Release, channel: Channel) => aiStudioService.generateChannelVariant(release, channel),
  qualityCheck: (text: string) => aiStudioService.qualityCheck(text),
};


// ---------------------------------------------------------------------------
// Feedback & roadmap
// ---------------------------------------------------------------------------

export const feedbackService = {
  async list(filters?: { search?: string; status?: FeedbackStatus; priority?: FeedbackRequest["priority"] }) {
    const { data } = await api.list<FeedbackRequest>("/feedback", { query: { ...filters, pageSize: 100 } });
    return data;
  },
  get: (id: string) => api.get<FeedbackRequest>(`/feedback/${id}`),
  create: (input: Pick<FeedbackRequest, "title" | "description"> & Partial<FeedbackRequest>) =>
    api.post<FeedbackRequest>("/feedback", { title: input.title, description: input.description, tags: input.tags, priority: input.priority, source: input.source }),
  /** Public feedback form on the changelog; lands in the workspace's inbox as a customer request. */
  submitPublic: (workspace: string, input: { title: string; description: string; email?: string; name?: string; website?: string }) =>
    api.post<{ id: string; status: FeedbackStatus }>(`/public/workspaces/${encodeURIComponent(workspace)}/feedback`, input, { allowUnauthenticated: true }),
  update: (id: string, input: Partial<FeedbackRequest>) =>
    api.patch<FeedbackRequest>(`/feedback/${id}`, {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      tags: input.tags,
      internalNotes: "internalNotes" in input ? (input.internalNotes ?? null) : undefined,
      linkedReleaseId: "linkedReleaseId" in input ? uuidOrNull(input.linkedReleaseId) : undefined,
    }),
  vote: (id: string) => api.post<FeedbackRequest>(`/feedback/${id}/vote`),
  listComments: (feedbackId: string) => api.get<FeedbackComment[]>(`/feedback/${feedbackId}/comments`),
  comment: (feedbackId: string, input: Pick<FeedbackComment, "body"> & Partial<FeedbackComment>) =>
    api.post<FeedbackComment>(`/feedback/${feedbackId}/comments`, { body: input.body, isInternal: input.isInternal }),
  merge: (sourceId: string, targetId: string) => api.post<FeedbackRequest>(`/feedback/${sourceId}/merge`, { targetId }),
  getClusters: () => api.get<FeedbackCluster[]>("/feedback/clusters"),
  cluster: () => api.post<FeedbackCluster[]>("/feedback/clusters/regenerate"),
};

function toRoadmapPayload(input: Partial<RoadmapItem>) {
  return {
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    isPublic: input.isPublic,
    targetDate: "targetDate" in input ? (input.targetDate ? input.targetDate.slice(0, 10) : null) : undefined,
    linkedReleaseId: "linkedReleaseId" in input ? uuidOrNull(input.linkedReleaseId) : undefined,
    linkedFeedbackIds: input.linkedFeedbackIds,
  };
}

export const roadmapService = {
  list: () => api.get<RoadmapItem[]>("/roadmap"),
  get: (id: string) => api.get<RoadmapItem>(`/roadmap/${id}`),
  create: (input: Partial<RoadmapItem>) => api.post<RoadmapItem>("/roadmap", toRoadmapPayload(input)),
  update: (id: string, input: Partial<RoadmapItem>) => api.patch<RoadmapItem>(`/roadmap/${id}`, toRoadmapPayload(input)),
  setLinks: (id: string, input: Pick<RoadmapItem, "linkedFeedbackIds" | "linkedReleaseId">) =>
    api.patch<RoadmapItem>(`/roadmap/${id}`, { linkedFeedbackIds: input.linkedFeedbackIds, linkedReleaseId: uuidOrNull(input.linkedReleaseId) }),
  remove: (id: string) => api.delete<{ id: string }>(`/roadmap/${id}`),
  reorder: (status: RoadmapItem["status"], ids: string[]) => api.post<RoadmapItem[]>("/roadmap/reorder", { status, ids }),
  createFromCluster: (cluster: FeedbackCluster) => api.post<RoadmapItem>("/roadmap/from-cluster", { clusterId: cluster.id }),
};

// ---------------------------------------------------------------------------
// Analytics, overview, activity
// ---------------------------------------------------------------------------

export const analyticsService = {
  getOverview: (range = "30d") => api.get<AnalyticsOverview>("/analytics", { query: { range } }),
  export: (range: string) => downloadFile("/analytics/export", { range }),
};

export type OverviewAttentionItem = {
  id: string;
  kind: "review" | "approved" | "draft" | "cluster" | "delivery" | "scheduled";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type OverviewSummary = {
  userName: string;
  metrics: {
    published: number;
    publishedTrend: number;
    feedback: number;
    feedbackNew: number;
    engagement: number;
    engagementTrend: number;
    scheduled: number;
    nextScheduledAt?: string;
  };
  attention: OverviewAttentionItem[];
  upcoming: Release[];
  signals: (FeedbackRequest & { roadmapStatus?: RoadmapItem["status"] })[];
};

export const overviewService = {
  get: () => api.get<OverviewSummary>("/overview"),
};

export const activityService = {
  list: (filters?: { unreadOnly?: boolean; type?: ActivityEvent["type"] }) =>
    api.get<ActivityEvent[]>("/activity", { query: { unreadOnly: filters?.unreadOnly ? "true" : undefined, type: filters?.type } }),
  markRead: (id: string) => api.post<ActivityEvent>(`/activity/${id}/read`),
  markAllRead: () => api.post<ActivityEvent[]>("/activity/read-all"),
};

// ---------------------------------------------------------------------------
// Integrations & team
// ---------------------------------------------------------------------------

export const integrationService = {
  list: () => api.get<Integration[]>("/integrations"),
  /**
   * Starts the provider's OAuth flow. The browser leaves for the provider and
   * comes back to /app/integrations, so this promise intentionally never resolves.
   */
  async connect(id: string): Promise<Integration> {
    const { authorizeUrl } = await api.post<{ authorizeUrl: string }>(`/integrations/${id}/connect`);
    window.location.assign(authorizeUrl);
    return new Promise<Integration>(() => undefined);
  },
  /** Repositories / projects / teams the connected account can see. */
  targets: (id: string) => api.get<IntegrationTarget[]>(`/integrations/${id}/targets`),
  disconnect: (id: string) => api.post<Integration>(`/integrations/${id}/disconnect`),
  /** `since` (YYYY-MM-DD) pulls work completed from that date instead of since the last sync. */
  sync: (id: string, since?: string) => api.post<Integration & { newItems: number }>(`/integrations/${id}/sync`, since ? { since } : {}),
  update: (id: string, input: Partial<Pick<Integration, "detail" | "track">>) => api.patch<Integration>(`/integrations/${id}`, { detail: input.detail ?? "", ...(input.track ? { track: input.track } : {}) }),
};

export const teamService = {
  list: () => api.get<TeamMember[]>("/team"),
  invite: (input: Pick<TeamMember, "name" | "email" | "role">) => api.post<TeamMember>("/team/invitations", input),
  updateRole: (id: string, role: TeamMember["role"]) => api.patch<TeamMember>(`/team/${id}`, { role }),
  remove: (id: string) => api.delete<{ id: string }>(`/team/${id}`),
};

// ---------------------------------------------------------------------------
// Audiences & email campaigns
// ---------------------------------------------------------------------------

export const audienceService = {
  list: () => api.get<Audience[]>("/audiences"),
  get: (id: string) => api.get<Audience>(`/audiences/${id}`),
  preview: (rules: Audience["rules"]) => api.post<{ size: number; rules: Audience["rules"] }>("/audiences/preview", rules),
  create: (input: Pick<Audience, "name" | "rules">) => api.post<Audience>("/audiences", input),
};

function toCampaignPayload(input: Partial<Campaign>) {
  return {
    releaseId: uuidOrNull(input.releaseId) ?? undefined,
    subject: input.subject,
    previewText: input.previewText,
    from: input.from,
    replyTo: input.replyTo || undefined,
    audienceId: "audienceId" in input ? uuidOrNull(input.audienceId) : undefined,
    body: input.body,
    cta: "cta" in input ? (input.cta ?? null) : undefined,
    // Only draft/scheduled are client-settable; sending/sent are owned by the server.
    status: input.status === "draft" || input.status === "scheduled" ? input.status : undefined,
    scheduledAt: "scheduledAt" in input ? (input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null) : undefined,
  };
}

export const campaignService = {
  list: () => api.get<Campaign[]>("/campaigns"),
  getByRelease: (releaseId: string) => api.get<Campaign | null>("/campaigns/by-release", { query: { releaseId } }),
  create: (input: Partial<Campaign>) => api.post<Campaign>("/campaigns", toCampaignPayload(input)),
  update: (id: string, input: Partial<Campaign>) => api.patch<Campaign>(`/campaigns/${id}`, toCampaignPayload(input)),
  /** Sends the saved campaign to the signed-in teammate only. */
  sendTest: (id: string) => api.post<{ to: string; status: "sent" | "logged" }>(`/campaigns/${id}/test`),
};

export const contactService = {
  list: (query: { search?: string; status?: ContactStatusFilter; page?: number; pageSize?: number } = {}) => api.get<ContactList>("/contacts", { query }),
  add: (input: { email: string; name?: string; plan?: string; tags?: string[] }) => api.post<Contact>("/contacts", input),
  importCsv: (csv: string) => api.post<ContactImportResult>("/contacts/import", { csv }),
  remove: (id: string) => api.delete<{ id: string }>(`/contacts/${id}`),
};

// ---------------------------------------------------------------------------
// Changelog (workspace manager + public pages)
// ---------------------------------------------------------------------------

export const changelogService = {
  list: (filters?: ChangelogListFilters) => api.get<ChangelogEntry[]>("/changelog", { query: filters }),
  getFilterOptions: () => api.get<ChangelogFilterOptions>("/changelog/filters"),
  getPublic: (workspace: string, slug: string) =>
    api.get<PublicRelease>(`/public/workspaces/${encodeURIComponent(workspace)}/releases/${encodeURIComponent(slug)}`, { allowUnauthenticated: true }),
  /** Public "Get updates by email": sends a confirmation link; the visitor is subscribed once they click it. */
  subscribe: (workspace: string, email: string) =>
    api.post<{ sent: boolean }>(`/public/workspaces/${encodeURIComponent(workspace)}/subscribe`, { email }, { allowUnauthenticated: true }),
  async getPublicList(workspace: string, filters?: { search?: string; tag?: string; page?: number }) {
    const { data } = await api.list<PublicRelease>(`/public/workspaces/${encodeURIComponent(workspace)}/releases`, { query: { pageSize: 50, ...filters }, allowUnauthenticated: true });
    return data;
  },
};

const publicBase = (workspace: string, slug: string) => `/public/workspaces/${encodeURIComponent(workspace)}/releases/${encodeURIComponent(slug)}`;

/**
 * Public engagement is separate from workspace feedback: visitors react to and
 * discuss published updates without access to internal threads.
 */
export const publicEngagementService = {
  get: (workspace: string, slug: string) => api.get<PublicReleaseEngagement>(`${publicBase(workspace, slug)}/engagement`, { allowUnauthenticated: true }),
  toggleReaction: (workspace: string, slug: string) => api.post<PublicReleaseEngagement>(`${publicBase(workspace, slug)}/reaction`, {}, { allowUnauthenticated: true }),
  listComments: (workspace: string, slug: string) => api.get<PublicReleaseComment[]>(`${publicBase(workspace, slug)}/comments`, { allowUnauthenticated: true }),
  createComment: (input: CreatePublicReleaseCommentInput) =>
    api.post<PublicReleaseComment>(`${publicBase(input.workspace, input.slug)}/comments`, { author: input.author, body: input.body }, { allowUnauthenticated: true }),
  /** Counts a view of the changelog (slug omitted) or of one update. Deduplicated per visitor server-side. */
  recordView: (workspace: string, slug?: string) =>
    api.post<void>(`/public/workspaces/${encodeURIComponent(workspace)}/views`, { slug: slug ?? null }, { allowUnauthenticated: true }),
  recordClick: (workspace: string, slug: string) => api.post<void>(`${publicBase(workspace, slug)}/click`, {}, { allowUnauthenticated: true }),
};

// ---------------------------------------------------------------------------
// Billing, developer platform, branding, settings, imports
// ---------------------------------------------------------------------------

export const billingService = {
  get: () => api.get<BillingInfo>("/billing"),
  /**
   * Plan changes go through Stripe Checkout (or the billing portal for existing
   * subscribers). The plan only changes after Stripe confirms, via webhook.
   */
  async changePlan(plan: "starter" | "pro" | "scale"): Promise<BillingInfo> {
    const { url } = await api.post<{ url: string }>("/billing/checkout", { plan });
    window.location.assign(url);
    return new Promise<BillingInfo>(() => undefined);
  },
  async openPortal() {
    const { url } = await api.post<{ url: string }>("/billing/portal");
    window.location.assign(url);
  },
};

export const apiService = {
  getKeys: () => api.get<ApiKey[]>("/api-keys"),
  createKey: (name: string) => api.post<CreatedApiKey>("/api-keys", { name }),
  revokeKey: (id: string) => api.delete<{ id: string }>(`/api-keys/${id}`),
  getWebhooks: () => api.get<Webhook[]>("/webhooks"),
  createWebhook: (input: Pick<Webhook, "url" | "events">) => api.post<CreatedWebhook>("/webhooks", input),
  updateWebhook: (id: string, input: Partial<Pick<Webhook, "url" | "events" | "status">>) => api.patch<Webhook>(`/webhooks/${id}`, input),
  removeWebhook: (id: string) => api.delete<{ id: string }>(`/webhooks/${id}`),
  testWebhook: (id: string) => api.post<WebhookDelivery>(`/webhooks/${id}/test`),
  getDeliveries: (webhookId?: string) => api.get<WebhookDelivery[]>("/webhooks/deliveries", { query: { webhookId } }),
  /** Queues a real re-delivery; the outcome appears in the delivery log shortly after. */
  retryDelivery: (id: string) => api.post<WebhookDelivery>(`/webhooks/deliveries/${id}/retry`),
};

export type UploadedAsset = { id: string; url: string; contentType: string; size: number; name: string };

export function uploadFile(file: File, purpose: "logo" | "favicon" | "media" | "import") {
  const form = new FormData();
  form.set("purpose", purpose);
  form.set("file", file);
  return api.post<UploadedAsset>("/uploads", form);
}

export type PublicWorkspace = { name: string; slug: string; branding: WorkspaceBranding };

export const brandingService = {
  get: () => api.get<WorkspaceBranding>("/branding"),
  update: (input: Partial<WorkspaceBranding>) => api.patch<WorkspaceBranding>("/branding", input),
  /** Public, unauthenticated branding for a workspace's changelog. */
  getPublic: (workspace: string) => api.get<PublicWorkspace>(`/public/workspaces/${encodeURIComponent(workspace)}`, { allowUnauthenticated: true }),
  uploadAsset: (file: File, purpose: "logo" | "favicon") => uploadFile(file, purpose),
};

export type AccountSession = { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; lastSeenAt: string; current: boolean };

export const settingsService = {
  get: () => api.get<WorkspaceSettings>("/settings"),
  update: (input: Partial<WorkspaceSettings>) => api.patch<WorkspaceSettings>("/settings", input),
  exportData: () => downloadFile("/settings/export"),
  deleteWorkspace: (confirmation: string) => api.post<{ id: string }>("/settings/delete", { confirmation }),
  listSessions: () => api.get<AccountSession[]>("/auth/sessions"),
  revokeSession: (id: string) => api.delete<void>(`/auth/sessions/${id}`),
};

export type StagedPreview = MigrationPreview & { uploadId: string };

export const migrationService = {
  /** Uploads the export and returns what an import would create. Nothing is imported yet. */
  async preview(input: { source: MigrationSource; file: File }): Promise<StagedPreview> {
    const upload = await uploadFile(input.file, "import");
    const preview = await api.post<MigrationPreview>("/imports/preview", { source: input.source, uploadId: upload.id });
    return { ...preview, uploadId: upload.id };
  },
  /** Imports every post as a draft release. Existing releases are never overwritten. */
  stageImport: (input: { source: MigrationSource; uploadId: string; preserveDates: boolean; preserveFormatting: boolean }) =>
    api.post<MigrationResult>("/imports", input),
};
