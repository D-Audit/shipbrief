import {
  mockAnalytics,
  mockApiKeys,
  mockAudiences,
  mockBilling,
  mockBranding,
  mockCampaigns,
  mockClusters,
  mockFeedback,
  mockFeedbackComments,
  mockPublicReleaseComments,
  mockIntegrations,
  mockOverview,
  mockReleases,
  mockRoadmap,
  mockSettings,
  mockTeam,
  mockWebhooks,
  mockWebhookDeliveries,
  mockActivity,
} from "@/lib/mock-data";
import type {
  AnalyticsOverview,
  AIChannelVariantResult,
  AIGenerationContext,
  AIGenerationResult,
  AIQualityReport,
  ChangelogFilterOptions,
  ChangelogEntry,
  ChangelogListFilters,
  ChangelogSort,
  CreatePublicReleaseCommentInput,
  Release,
  ReleaseVersion,
  ReleaseStatus,
  RoadmapItem,
  Channel,
  FeedbackCluster,
  FeedbackComment,
  FeedbackRequest,
  FeedbackStatus,
  ActivityEvent,
  ApiKey,
  Audience,
  Integration,
  MigrationPreview,
  MigrationResult,
  MigrationSource,
  PublicReleaseComment,
  PublicReleaseEngagement,
  TeamMember,
  Webhook,
  WorkspaceBranding,
  WorkspaceSettings,
} from "@/types";
import { mockReleaseVersions } from "@/lib/mock-data/release-versions";
import { withMockDelay } from "./utils";

let releases = [...mockReleases];
let campaigns = [...mockCampaigns];
let feedback = [...mockFeedback];
let feedbackComments = [...mockFeedbackComments];
let publicReleaseComments = mockPublicReleaseComments.map((comment) => ({ ...comment }));
const publicReactionReleaseIds = new Set<string>();
let feedbackClusters = [...mockClusters];
let roadmapItems = [...mockRoadmap];
let audiences = [...mockAudiences];
const integrations = [...mockIntegrations];
let teamMembers = [...mockTeam];
let activityEvents = [...mockActivity];
let billing = { ...mockBilling };
let apiKeys = [...mockApiKeys];
let webhooks = [...mockWebhooks];
let webhookDeliveries = [...mockWebhookDeliveries];
let branding = { ...mockBranding };
let workspaceSettings = { ...mockSettings, notifications: { ...mockSettings.notifications } };
let releaseVersions: Record<string, ReleaseVersion[]> = Object.fromEntries(
  Object.entries(mockReleaseVersions).map(([releaseId, versions]) => [
    releaseId,
    versions.map((version) => cloneReleaseVersion(version)),
  ])
);

function getReleaseRecord(id: string) {
  const release = releases.find((item) => item.id === id);
  if (!release) throw new Error("Release not found");
  return release;
}

function updateReleaseRecord(id: string, input: Partial<Release>, allowStatusChange = false) {
  const index = releases.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("Release not found");
  const current = releases[index];
  if (input.status && input.status !== current.status && !allowStatusChange) {
    throw new Error("Use the approval workflow to change a release status");
  }
  releases[index] = { ...current, ...input, updatedAt: new Date().toISOString() };
  return releases[index];
}

function cloneChannelVariants(variants: Release["channelVariants"]): Release["channelVariants"] {
  if (!variants) return undefined;
  return {
    changelog: variants.changelog ? { ...variants.changelog } : undefined,
    email: variants.email ? { ...variants.email } : undefined,
    in_app: variants.in_app ? { ...variants.in_app } : undefined,
  };
}

function cloneReleaseVersion(version: ReleaseVersion): ReleaseVersion {
  return {
    ...version,
    channels: version.channels ? [...version.channels] : version.channels,
    cta: version.cta ? { ...version.cta } : version.cta,
    channelVariants: cloneChannelVariants(version.channelVariants),
  };
}

function serialiseVersionedReleaseContent(release: Release) {
  return JSON.stringify({
    title: release.title,
    summary: release.summary,
    body: release.body,
    channels: release.channels,
    audienceId: release.audienceId ?? null,
    cta: release.cta ?? null,
    channelVariants: cloneChannelVariants(release.channelVariants) ?? null,
  });
}

function hasVersionedReleaseContentChanged(previous: Release, next: Release) {
  return serialiseVersionedReleaseContent(previous) !== serialiseVersionedReleaseContent(next);
}

function recordReleaseVersion(
  release: Release,
  changeNote: string,
  changedBy = "Don Jesus"
): ReleaseVersion {
  const existing = releaseVersions[release.id] ?? [];
  const version: ReleaseVersion = {
    id: `ver_${release.id}_${Date.now()}_${existing.length + 1}`,
    releaseId: release.id,
    version: Math.max(0, ...existing.map((entry) => entry.version)) + 1,
    title: release.title,
    summary: release.summary,
    body: release.body,
    channels: [...release.channels],
    audienceId: release.audienceId,
    cta: release.cta ? { ...release.cta } : undefined,
    channelVariants: cloneChannelVariants(release.channelVariants),
    changedBy,
    changedAt: new Date().toISOString(),
    changeNote,
  };
  releaseVersions = { ...releaseVersions, [release.id]: [version, ...existing] };
  return version;
}

function hasSnapshotField(version: ReleaseVersion, field: keyof ReleaseVersion) {
  return Object.prototype.hasOwnProperty.call(version, field);
}

function getRestoredReleaseFields(version: ReleaseVersion): Partial<Release> {
  const restored: Partial<Release> = {
    title: version.title,
    summary: version.summary,
    body: version.body,
  };

  if (version.channels) restored.channels = [...version.channels];
  if (hasSnapshotField(version, "audienceId")) restored.audienceId = version.audienceId;
  if (hasSnapshotField(version, "cta")) restored.cta = version.cta ? { ...version.cta } : undefined;
  if (hasSnapshotField(version, "channelVariants")) {
    restored.channelVariants = cloneChannelVariants(version.channelVariants);
  }

  return restored;
}

function requirePublishingChannel(release: Release) {
  if (release.channels.length === 0) {
    throw new Error("Select at least one publishing channel before continuing");
  }
}

function requirePublicWorkspace(workspace: string) {
  if (workspace.trim().toLowerCase() !== workspaceSettings.slug.trim().toLowerCase()) {
    throw new Error("Workspace not found");
  }
}

function getPublicReleaseRecord(workspace: string, slug: string) {
  requirePublicWorkspace(workspace);
  const release = releases.find(
    (item) =>
      item.slug === slug &&
      item.status === "published" &&
      item.channels.includes("changelog")
  );
  if (!release) throw new Error("Update not found");
  return release;
}

function toPublicReleaseEngagement(release: Release): PublicReleaseEngagement {
  return {
    reactions: release.reactions,
    comments: release.comments,
    hasReacted: publicReactionReleaseIds.has(release.id),
  };
}

function sortChangelogEntries(a: ChangelogEntry, b: ChangelogEntry, sort: ChangelogSort) {
  const newestFirst = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

  if (sort === "oldest") return -newestFirst;
  if (sort === "most_engaged") {
    return (b.reactions + b.comments) - (a.reactions + a.comments) || newestFirst;
  }
  if (sort === "most_discussed") return b.comments - a.comments || newestFirst;
  return newestFirst;
}

export const releaseService = {
  async list(filters?: { status?: ReleaseStatus; search?: string }) {
    return withMockDelay(() => {
      let items = [...releases];
      if (filters?.status) items = items.filter((r) => r.status === filters.status);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.summary.toLowerCase().includes(q)
        );
      }
      return items.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  },

  async get(id: string) {
    return withMockDelay(() => {
      const release = releases.find((r) => r.id === id);
      if (!release) throw new Error("Release not found");
      return release;
    });
  },

  async create(input: Partial<Release>) {
    return withMockDelay(() => {
      const now = new Date().toISOString();
      const release: Release = {
        id: `rel_${Date.now()}`,
        title: input.title ?? "Untitled release",
        summary: input.summary ?? "",
        body: input.body ?? "",
        status: "draft",
        channels: input.channels ?? ["changelog"],
        category: input.category ?? "Feature",
        tags: input.tags ?? [],
        sourceRefs: input.sourceRefs ?? [],
        audienceId: input.audienceId,
        scheduledAt: input.scheduledAt,
        cta: input.cta ? { ...input.cta } : undefined,
        media: input.media ? [...input.media] : undefined,
        channelVariants: input.channelVariants ? { ...input.channelVariants } : undefined,
        featured: input.featured,
        views: 0,
        reactions: 0,
        comments: 0,
        createdAt: now,
        updatedAt: now,
        slug: input.slug ?? input.title?.toLowerCase().replace(/\s+/g, "-") ?? "untitled",
      };
      releases = [release, ...releases];
      recordReleaseVersion(release, "Release created", release.createdBy ?? "Don Jesus");
      return release;
    });
  },

  async update(
    id: string,
    input: Partial<Release>,
    options?: { changeNote?: string; changedBy?: string }
  ) {
    return withMockDelay(() => {
      const previous = getReleaseRecord(id);
      const updated = updateReleaseRecord(id, input);
      if (hasVersionedReleaseContentChanged(previous, updated)) {
        recordReleaseVersion(
          updated,
          options?.changeNote ?? "Saved release changes",
          options?.changedBy ?? "Don Jesus"
        );
      }
      return updated;
    });
  },

  async submitForReview(id: string) {
    return withMockDelay(() => {
      const release = getReleaseRecord(id);
      if (release.status !== "draft") throw new Error("Only draft releases can be submitted for review");
      const updated = updateReleaseRecord(id, { status: "in_review" }, true);
      recordActivity({ type: "comment", message: `Release ${updated.title} submitted for review (mock)`, link: `/app/releases/${id}`, actor: "Don Jesus" });
      return updated;
    });
  },

  async approve(id: string) {
    return withMockDelay(() => {
      const release = getReleaseRecord(id);
      if (release.status !== "in_review") throw new Error("A release must be in review before it can be approved");
      const updated = updateReleaseRecord(id, { status: "approved", reviewedBy: "Don Jesus" }, true);
      recordActivity({ type: "approved", message: `Release ${updated.title} approved`, link: `/app/releases/${id}`, actor: "Don Jesus" });
      return updated;
    });
  },

  async schedule(id: string, date: string) {
    return withMockDelay(() => {
      const release = getReleaseRecord(id);
      if (release.status !== "approved") throw new Error("A release must be approved before it can be scheduled");
      if (!date) throw new Error("Choose a schedule date before continuing");
      requirePublishingChannel(release);
      const updated = updateReleaseRecord(id, { status: "scheduled", scheduledAt: date }, true);
      recordActivity({ type: "scheduled", message: `Release ${updated.title} scheduled (mock)`, link: `/app/releases/${id}`, actor: "Don Jesus" });
      return updated;
    });
  },

  async publish(id: string) {
    return withMockDelay(() => {
      const release = getReleaseRecord(id);
      if (release.status !== "approved" && release.status !== "scheduled") {
        throw new Error("A release must be approved before it can be published");
      }
      requirePublishingChannel(release);
      const updated = updateReleaseRecord(id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        publishedBy: "Don Jesus",
      }, true);
      recordActivity({ type: "published", message: `Release ${updated.title} published (mock)`, link: `/app/releases/${id}`, actor: "Don Jesus" });
      return updated;
    });
  },

  async archive(id: string) {
    return withMockDelay(() => {
      const release = getReleaseRecord(id);
      if (release.status !== "published") throw new Error("Only published releases can be archived");
      return updateReleaseRecord(id, { status: "archived" }, true);
    });
  },

  async getVersionHistory(id: string) {
    return withMockDelay(() => (releaseVersions[id] ?? []).map((version) => cloneReleaseVersion(version)));
  },

  async restoreVersion(id: string, versionId: string) {
    return withMockDelay(() => {
      const version = releaseVersions[id]?.find((entry) => entry.id === versionId);
      if (!version) throw new Error("Release version not found");

      const updated = updateReleaseRecord(id, getRestoredReleaseFields(version));
      recordReleaseVersion(updated, `Restored version ${version.version}`);
      return updated;
    });
  },
};

/**
 * Mock boundary used by the dedicated AI Studio. Its contracts intentionally
 * mirror a future orchestrated AI API while keeping all transformation local.
 */
export const aiStudioService = {
  async generateRelease(
    context: string,
    generationContext: AIGenerationContext = {}
  ): Promise<Pick<Release, "title" | "summary" | "body">> {
    return withMockDelay(() => {
      const source = applyBrandVoiceGuidance(toPlainText(context), generationContext.brandVoice);
      return {
        title: source.split(/[.!?]/)[0]?.slice(0, 72) || "Product update",
        summary: contextualizeCustomerCopy("A customer-focused summary generated from your product context.", generationContext),
        body: `<p>${escapeHtml(contextualizeCustomerCopy(source || "Describe the customer benefit of this update.", generationContext))}</p>`,
      };
    }, 1400);
  },

  async rewrite(
    text: string,
    instruction: string,
    attempt = 0,
    generationContext: AIGenerationContext = {}
  ): Promise<AIGenerationResult> {
    return withMockDelay(() => {
      const source = applyBrandVoiceGuidance(toPlainText(text), generationContext.brandVoice);
      const normalizedInstruction = instruction.toLowerCase();
      const contextSummary = describeAIGenerationContext(generationContext);

      if (normalizedInstruction.includes("error")) {
        throw new Error("Mock AI generation failed");
      }

      if (normalizedInstruction.includes("shorter")) {
        const ratio = attempt % 2 === 0 ? 0.62 : 0.46;
        const shortened = source
          .slice(0, Math.max(90, Math.round(source.length * ratio)))
          .replace(/\s+\S*$/, "");
        return {
          id: `ai_${Date.now()}`,
          content: `<p>${escapeHtml(contextualizeCustomerCopy(`${shortened}${shortened.length < source.length ? "..." : ""}`, generationContext))}</p>`,
          summary: attempt ? "A tighter alternative" : "Shortened version",
          contextSummary,
        };
      }

      if (normalizedInstruction.includes("friendlier")) {
        const friendly = source
          .replace(/you can/gi, "you'll be able to")
          .replace(/implement/gi, "use")
          .replace(/configure/gi, "set up");
        return {
          id: `ai_${Date.now()}`,
          content: `<p>${escapeHtml(contextualizeCustomerCopy(friendly, generationContext))}</p>`,
          summary: "Friendlier version",
          contextSummary,
        };
      }

      if (normalizedInstruction.includes("benefit")) {
        return {
          id: `ai_${Date.now()}`,
          content: `<p>${escapeHtml(contextualizeCustomerCopy("Here is what this unlocks for customers:", generationContext))}</p><ul><li>Get to the outcome faster with a clearer workflow.</li><li>Spend less time on setup and follow-up work.</li><li>Use the update confidently in the moments that matter.</li></ul>`,
          summary: "Customer benefits surfaced",
          contextSummary,
        };
      }

      return {
        id: `ai_${Date.now()}`,
        content: `<p>${escapeHtml(contextualizeCustomerCopy(source, generationContext))}</p>`,
        summary: `Applied: ${instruction}`,
        contextSummary,
      };
    }, 1200);
  },

  async generateChannelVariant(
    release: Release,
    channel: Channel,
    generationContext: AIGenerationContext = {}
  ): Promise<AIChannelVariantResult> {
    return withMockDelay(() => {
      const title = applyBrandVoiceGuidance(release.title, generationContext.brandVoice);
      const summary = contextualizeCustomerCopy(release.summary, generationContext);
      const body = applyBrandVoiceGuidance(release.body, generationContext.brandVoice);
      const contextSummary = describeAIGenerationContext(generationContext);

      if (channel === "email") {
        return {
          variant: {
            channel,
            title,
            summary,
            body: `<p>${escapeHtml(getAudienceGreeting(generationContext))}</p><p>${escapeHtml(summary)}</p>${body}<p>Thanks,<br />The Acme team</p>`,
            subject: `${title} is here`,
            previewText: summary,
          },
          contextSummary,
        };
      }

      if (channel === "in_app") {
        return {
          variant: {
            channel,
            title,
            summary,
            body: `<p>${escapeHtml(summary)}</p>`,
            // Keep the presentation selected in Studio when generating a fresh
            // in-app draft. The future AI API can make the same round trip.
            format: release.channelVariants?.in_app?.format ?? "feed",
          },
          contextSummary,
        };
      }

      return {
        variant: {
          channel,
          title,
          summary,
          body,
        },
        contextSummary,
      };
    }, 1500);
  },

  async qualityCheck(
    input: string | Pick<Release, "title" | "summary" | "body" | "cta">
  ): Promise<AIQualityReport> {
    return withMockDelay(() => {
      const release = typeof input === "string"
        ? { title: "", summary: "", body: input, cta: undefined }
        : input;
      const text = toPlainText(`${release.title} ${release.summary} ${release.body}`);
      const issues: AIQualityReport["issues"] = [];

      if (/implement|configuration|infrastructure|endpoint/i.test(text)) {
        issues.push({
          id: "jargon",
          severity: "warning",
          title: "Technical language detected",
          detail: "Some wording describes implementation rather than the customer outcome.",
          suggestion: "Lead with what customers can now do or achieve.",
        });
      }
      if (!release.summary.trim()) {
        issues.push({
          id: "benefit",
          severity: "warning",
          title: "Customer benefit is missing",
          detail: "A concise summary helps customers understand why this update matters.",
          suggestion: "Add one sentence that starts with the outcome for the customer.",
        });
      }
      if (!release.cta?.label) {
        issues.push({
          id: "cta",
          severity: "info",
          title: "No next step yet",
          detail: "A call to action can help customers discover the update.",
          suggestion: "Add a useful next step when there is somewhere relevant to go.",
        });
      }
      if (text.length > 850) {
        issues.push({
          id: "length",
          severity: "info",
          title: "Long for an in-app message",
          detail: "This draft may be more effective as a changelog post or email.",
          suggestion: "Create a shorter in-app variant that focuses on one benefit.",
        });
      }

      return {
        score: Math.max(58, 100 - issues.reduce((total, issue) => total + (issue.severity === "warning" ? 14 : 6), 0)),
        issues,
        strengths: [
          "The update has a clear title.",
          "The draft is ready for human review before publishing.",
        ],
      };
    }, 850);
  },
};

function toPlainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function describeAIGenerationContext(context: AIGenerationContext) {
  const parts = [
    context.brandVoice?.trim() ? "workspace brand voice" : "default workspace voice",
    context.audience?.name ? `${context.audience.name} audience` : "all customers",
    `${context.sourceRefs?.length ?? 0} source reference${context.sourceRefs?.length === 1 ? "" : "s"}`,
  ];
  return `Context attached: ${parts.join(" · ")}`;
}

function getAudienceGreeting(context: AIGenerationContext) {
  const audience = context.audience?.name?.trim();
  if (!audience || /^all users$/i.test(audience)) return "Hi there,";
  return `Hi ${audience},`;
}

function getCustomerContextSentences(context: AIGenerationContext) {
  const sentences: string[] = [];
  const audience = context.audience?.name?.trim();
  const audienceRules = context.audience?.rules;
  if (audienceRules?.tags?.length) {
    sentences.push(`This is tailored for customers in the ${audienceRules.tags.join(" and ")} program.`);
  } else if (audienceRules?.plans?.length === 1) {
    sentences.push(`This is tailored for ${audienceRules.plans[0]} plan customers.`);
  } else if (audienceRules?.accountAgeDays) {
    sentences.push(`This is tailored for established customers who have been with you for ${audienceRules.accountAgeDays} days or more.`);
  } else if (audience && !/^all users$/i.test(audience)) {
    sentences.push(`Made for ${audience.toLowerCase()}.`);
  }

  const sourceTypes = new Set(context.sourceRefs?.map((reference) => reference.type) ?? []);
  if (sourceTypes.has("linear")) {
    sentences.push("It focuses on the customer outcome this work was planned to deliver.");
  } else if (sourceTypes.has("github")) {
    sentences.push("It reflects the latest product work ready for your workspace.");
  } else if (sourceTypes.has("manual")) {
    sentences.push("It highlights the intended customer benefit.");
  }
  return sentences;
}

function contextualizeCustomerCopy(value: string, context: AIGenerationContext) {
  const adjusted = applyBrandVoiceGuidance(value, context.brandVoice).trim();
  return [adjusted, ...getCustomerContextSentences(context)].filter(Boolean).join(" ");
}

/**
 * The mock keeps its transformations deterministic while exercising the same
 * context path a real AI provider will use. It only makes safe wording
 * adjustments when the saved guidance explicitly asks for them.
 */
function applyBrandVoiceGuidance(value: string, brandVoice?: string) {
  const guidance = brandVoice?.toLowerCase() ?? "";
  if (!guidance) return value;

  let adjusted = value;
  if (/friendly|warm|human|conversational/.test(guidance)) {
    adjusted = adjusted.replace(/\byou can\b/gi, "you'll be able to");
  }
  if (/avoid jargon|plain language|clear/.test(guidance)) {
    adjusted = adjusted
      .replace(/\bimplement(?:ation|ed|ing)?\b/gi, "use")
      .replace(/\bconfiguration\b/gi, "setup")
      .replace(/\binfrastructure\b/gi, "behind-the-scenes systems");
  }
  return adjusted;
}

export const feedbackService = {
  async list(filters?: { search?: string; status?: FeedbackStatus; priority?: FeedbackRequest["priority"] }) {
    return withMockDelay(() => {
      let items = feedback.filter((item) => !item.mergedIntoId);
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        items = items.filter((item) =>
          [item.title, item.description, item.tags.join(" ")].join(" ").toLowerCase().includes(query)
        );
      }
      if (filters?.status) items = items.filter((item) => item.status === filters.status);
      if (filters?.priority) items = items.filter((item) => item.priority === filters.priority);
      return [...items].sort((a, b) => b.votes - a.votes);
    });
  },
  async get(id: string) {
    return withMockDelay(() => {
      const item = feedback.find((f) => f.id === id);
      if (!item) throw new Error("Feedback not found");
      return item;
    });
  },
  async create(input: Pick<FeedbackRequest, "title" | "description"> & Partial<FeedbackRequest>) {
    return withMockDelay(() => {
      const item: FeedbackRequest = {
        id: `fb_${Date.now()}`,
        title: input.title.trim(),
        description: input.description.trim(),
        votes: 1,
        comments: 0,
        status: "new",
        tags: input.tags ?? [],
        source: input.source ?? "customer",
        priority: input.priority ?? "medium",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      feedback = [item, ...feedback];
      return item;
    });
  },
  async update(id: string, input: Partial<FeedbackRequest>) {
    return withMockDelay(() => {
      const index = feedback.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Feedback not found");
      feedback[index] = { ...feedback[index], ...input, updatedAt: new Date().toISOString() };
      return feedback[index];
    });
  },
  async vote(id: string) {
    return withMockDelay(() => {
      const index = feedback.findIndex((item) => item.id === id);
      const item = feedback[index];
      if (!item) throw new Error("Feedback not found");
      feedback[index] = { ...item, votes: item.votes + 1, updatedAt: new Date().toISOString() };
      return feedback[index];
    });
  },
  async listComments(feedbackId: string) {
    return withMockDelay(() =>
      feedbackComments
        .filter((comment) => comment.feedbackId === feedbackId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );
  },
  async comment(feedbackId: string, input: Pick<FeedbackComment, "body"> & Partial<FeedbackComment>) {
    return withMockDelay(() => {
      const index = feedback.findIndex((item) => item.id === feedbackId);
      if (index === -1) throw new Error("Feedback not found");
      const comment: FeedbackComment = {
        id: `comment_${Date.now()}`,
        feedbackId,
        author: input.author ?? "Don Jesus",
        body: input.body.trim(),
        createdAt: new Date().toISOString(),
        isInternal: input.isInternal ?? false,
      };
      feedbackComments = [...feedbackComments, comment];
      feedback[index] = { ...feedback[index], comments: feedback[index].comments + 1, updatedAt: new Date().toISOString() };
      return comment;
    });
  },
  async merge(sourceId: string, targetId: string) {
    return withMockDelay(() => {
      if (sourceId === targetId) throw new Error("Choose a different request to merge into");
      const sourceIndex = feedback.findIndex((item) => item.id === sourceId);
      const targetIndex = feedback.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) throw new Error("Feedback request not found");
      const source = feedback[sourceIndex];
      const target = feedback[targetIndex];
      feedback[targetIndex] = {
        ...target,
        votes: target.votes + source.votes,
        comments: target.comments + source.comments,
        tags: [...new Set([...target.tags, ...source.tags])],
        updatedAt: new Date().toISOString(),
      };
      feedback[sourceIndex] = { ...source, mergedIntoId: targetId, updatedAt: new Date().toISOString() };
      return feedback[targetIndex];
    });
  },
  async getClusters() {
    return withMockDelay(() => [...feedbackClusters]);
  },
  async cluster() {
    const clusters = await aiService.clusterFeedback(feedback.filter((item) => !item.mergedIntoId));
    feedbackClusters = clusters;
    return clusters;
  },
};

/**
 * Roadmap items own the many-to-one relationship from feedback to a roadmap
 * decision. Keeping it here makes the mock contract behave like a future
 * transactional API rather than leaving each client surface to update two
 * collections independently.
 */
function syncRoadmapFeedbackLinks(roadmapId: string, requestedIds: string[]) {
  const linkedFeedbackIds = [...new Set(requestedIds)];
  const knownIds = new Set(feedback.map((request) => request.id));
  const missingId = linkedFeedbackIds.find((id) => !knownIds.has(id));

  if (missingId) throw new Error("One of the selected feedback requests no longer exists");

  const linkedElsewhere = feedback.find(
    (request) =>
      linkedFeedbackIds.includes(request.id) &&
      request.roadmapItemId &&
      request.roadmapItemId !== roadmapId
  );

  if (linkedElsewhere) {
    throw new Error(`“${linkedElsewhere.title}” is already linked to another roadmap item`);
  }

  const selectedIds = new Set(linkedFeedbackIds);
  const updatedAt = new Date().toISOString();

  feedback = feedback.map((request) => {
    if (selectedIds.has(request.id) && request.roadmapItemId !== roadmapId) {
      return { ...request, roadmapItemId: roadmapId, updatedAt };
    }

    if (!selectedIds.has(request.id) && request.roadmapItemId === roadmapId) {
      return { ...request, roadmapItemId: undefined, updatedAt };
    }

    return request;
  });

  return linkedFeedbackIds;
}

function updateRoadmapRecord(id: string, input: Partial<RoadmapItem>) {
  const index = roadmapItems.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("Roadmap item not found");

  const current = roadmapItems[index];
  const linkedReleaseId = "linkedReleaseId" in input
    ? input.linkedReleaseId
    : current.linkedReleaseId;

  if (linkedReleaseId && linkedReleaseId !== current.linkedReleaseId) {
    const release = releases.find((item) => item.id === linkedReleaseId);
    if (!release) throw new Error("The selected release no longer exists");
    if (release.status !== "published") throw new Error("Only published releases can be linked to a roadmap item");
  }

  const linkedFeedbackIds = "linkedFeedbackIds" in input
    ? syncRoadmapFeedbackLinks(id, input.linkedFeedbackIds ?? [])
    : current.linkedFeedbackIds;

  roadmapItems[index] = { ...current, ...input, linkedFeedbackIds, linkedReleaseId };
  return roadmapItems[index];
}

export const roadmapService = {
  async list() {
    return withMockDelay(() => [...roadmapItems]);
  },
  async get(id: string) {
    return withMockDelay(() => {
      const item = roadmapItems.find((roadmapItem) => roadmapItem.id === id);
      if (!item) throw new Error("Roadmap item not found");
      return item;
    });
  },
  async create(input: Partial<RoadmapItem>) {
    return withMockDelay(() => {
      const item: RoadmapItem = {
        id: `rm_${Date.now()}`,
        title: input.title ?? "New item",
        description: input.description ?? "",
        status: input.status ?? "later",
        votes: input.votes ?? 0,
        linkedFeedbackIds: input.linkedFeedbackIds ?? [],
        linkedReleaseId: input.linkedReleaseId,
        targetDate: input.targetDate,
      };

      item.linkedFeedbackIds = syncRoadmapFeedbackLinks(item.id, item.linkedFeedbackIds);
      roadmapItems = [item, ...roadmapItems];
      return item;
    });
  },
  async update(id: string, input: Partial<RoadmapItem>) {
    return withMockDelay(() => updateRoadmapRecord(id, input));
  },
  async setLinks(id: string, input: Pick<RoadmapItem, "linkedFeedbackIds" | "linkedReleaseId">) {
    return withMockDelay(() => updateRoadmapRecord(id, input));
  },
  async createFromCluster(cluster: FeedbackCluster) {
    return roadmapService.create({
      title: cluster.title,
      description: cluster.topNeed,
      status: "later",
      votes: cluster.votes,
      linkedFeedbackIds: cluster.feedbackIds,
    });
  },
};

export const analyticsService = {
  async getOverview(range?: string): Promise<AnalyticsOverview> {
    void range;
    return withMockDelay(() => mockAnalytics);
  },
  async export(range: string) {
    return withMockDelay(() => ({ filename: `shipbrief-analytics-${range}.csv` }), 650);
  },
};

export const overviewService = {
  async get() {
    return withMockDelay(() => mockOverview);
  },
};

export const integrationService = {
  async list() {
    return withMockDelay(() => [...integrations]);
  },
  async connect(id: string) {
    return withMockDelay(() => {
      const index = integrations.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Integration not found");
      const integration = integrations[index];
      integrations[index] = { ...integration, status: "connected", detail: integration.detail || "Workspace connection", lastSync: new Date().toISOString() };
      recordActivity({ type: "integration", message: `${integration.name} connected (mock)`, link: "/app/integrations" });
      return integrations[index];
    });
  },
  async disconnect(id: string) {
    return withMockDelay(() => {
      const index = integrations.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Integration not found");
      integrations[index] = { ...integrations[index], status: "disconnected", detail: "", lastSync: null };
      recordActivity({ type: "integration", message: `${integrations[index].name} disconnected (mock)`, link: "/app/integrations" });
      return integrations[index];
    });
  },
  async sync(id: string) {
    return withMockDelay(() => {
      const index = integrations.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Integration not found");
      if (integrations[index].status !== "connected") throw new Error("Connect this integration before syncing");
      integrations[index] = { ...integrations[index], lastSync: new Date().toISOString() };
      recordActivity({ type: "integration", message: `${integrations[index].name} sync completed (mock)`, link: "/app/integrations" });
      return integrations[index];
    }, 850);
  },
  async update(id: string, input: Partial<Pick<Integration, "detail">>) {
    return withMockDelay(() => {
      const index = integrations.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Integration not found");
      integrations[index] = { ...integrations[index], ...input };
      return integrations[index];
    });
  },
};

export const teamService = {
  async list() {
    return withMockDelay(() => [...teamMembers]);
  },
  async invite(input: Pick<TeamMember, "name" | "email" | "role">) {
    return withMockDelay(() => {
      const member: TeamMember = { id: `tm_${Date.now()}`, ...input, status: "invited" };
      teamMembers = [...teamMembers, member];
      recordActivity({ type: "comment", message: `Invited ${member.name} to the workspace (mock)`, link: "/app/team", actor: "Don Jesus" });
      return member;
    });
  },
  async updateRole(id: string, role: TeamMember["role"]) {
    return withMockDelay(() => {
      const index = teamMembers.findIndex((member) => member.id === id);
      if (index === -1) throw new Error("Team member not found");
      if (teamMembers[index].role === "owner") throw new Error("Transfer ownership before changing the owner role");
      teamMembers[index] = { ...teamMembers[index], role };
      return teamMembers[index];
    });
  },
  async remove(id: string) {
    return withMockDelay(() => {
      const member = teamMembers.find((item) => item.id === id);
      if (!member) throw new Error("Team member not found");
      if (member.role === "owner") throw new Error("The workspace owner cannot be removed");
      teamMembers = teamMembers.filter((item) => item.id !== id);
      recordActivity({ type: "comment", message: `${member.name} removed from the workspace (mock)`, link: "/app/team", actor: "Don Jesus" });
      return { id };
    });
  },
};

export const audienceService = {
  async list() {
    return withMockDelay(() => [...audiences]);
  },
  async get(id: string) {
    return withMockDelay(() => {
      const aud = audiences.find((a) => a.id === id);
      if (!aud) throw new Error("Audience not found");
      return aud;
    });
  },
  async preview(rules: Audience["rules"]) {
    return withMockDelay(() => {
      let size = 3240;
      if (rules.plans?.length === 1) {
        size = rules.plans[0] === "pro" ? 1248 : rules.plans[0] === "enterprise" ? 482 : 1510;
      }
      if (rules.tags?.includes("beta")) size = Math.min(size, 312);
      if (rules.accountAgeDays) size = Math.round(size * Math.max(0.2, 1 - rules.accountAgeDays / 500));
      return { size, rules };
    }, 450);
  },
  async create(input: Pick<Audience, "name" | "rules">) {
    return withMockDelay(() => {
      const audience: Audience = { id: `aud_${Date.now()}`, name: input.name, rules: input.rules, size: 0 };
      audiences = [...audiences, audience];
      return audience;
    });
  },
};

export const campaignService = {
  async list() {
    return withMockDelay(() => [...campaigns]);
  },
  async getByRelease(releaseId: string) {
    return withMockDelay(() => campaigns.find((c) => c.releaseId === releaseId) ?? null);
  },
  async create(input: Partial<import("@/types").Campaign>) {
    return withMockDelay(() => {
      const campaign: import("@/types").Campaign = {
        id: `camp_${Date.now()}`,
        releaseId: input.releaseId ?? "",
        subject: input.subject ?? "Untitled campaign",
        previewText: input.previewText ?? "",
        from: input.from ?? "Acme Product Team",
        replyTo: input.replyTo,
        audienceId: input.audienceId ?? "aud_all",
        status: input.status ?? "draft",
        scheduledAt: input.scheduledAt ?? null,
        sentAt: input.sentAt ?? null,
        body: input.body,
        cta: input.cta,
      };
      campaigns = [campaign, ...campaigns];
      return campaign;
    });
  },
  async update(id: string, input: Partial<import("@/types").Campaign>) {
    return withMockDelay(() => {
      const index = campaigns.findIndex((campaign) => campaign.id === id);
      if (index === -1) throw new Error("Campaign not found");
      campaigns[index] = { ...campaigns[index], ...input };
      return campaigns[index];
    });
  },
};

export const changelogService = {
  async list(filters?: ChangelogListFilters) {
    return withMockDelay(() => {
      let source = releases.filter(
        (release) => release.channels.includes("changelog") && release.status !== "archived"
      );
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        source = source.filter(
          (release) =>
            release.title.toLowerCase().includes(q) ||
            release.summary.toLowerCase().includes(q)
        );
      }
      if (filters?.category) source = source.filter((release) => release.category === filters.category);
      if (filters?.status) source = source.filter((release) => release.status === filters.status);
      if (filters?.tag) {
        const tag = filters.tag.toLowerCase();
        source = source.filter((release) => release.tags.some((item) => item.toLowerCase() === tag));
      }

      return source
        .map((release): ChangelogEntry => ({
          id: release.id,
          title: release.title,
          summary: release.summary,
          category: release.category,
          tags: release.tags,
          publishedAt: release.publishedAt ?? release.scheduledAt ?? release.updatedAt,
          slug: release.slug ?? release.id,
          featured: release.featured ?? false,
          status: release.status,
          reactions: release.reactions,
          comments: release.comments,
        }))
        .sort((a, b) => sortChangelogEntries(a, b, filters?.sort ?? "newest"));
    });
  },
  async getFilterOptions(): Promise<ChangelogFilterOptions> {
    return withMockDelay(() => {
      const source = releases.filter(
        (release) => release.channels.includes("changelog") && release.status !== "archived"
      );

      return {
        categories: Array.from(new Set(source.map((release) => release.category))).sort((a, b) => a.localeCompare(b)),
        tags: Array.from(new Set(source.flatMap((release) => release.tags))).sort((a, b) => a.localeCompare(b)),
      };
    }, 120);
  },
  async getPublic(workspace: string, slug: string) {
    return withMockDelay(() => {
      return getPublicReleaseRecord(workspace, slug);
    });
  },
  async getPublicList(workspace: string) {
    return withMockDelay(() => {
      requirePublicWorkspace(workspace);
      return releases.filter((r) => r.status === "published" && r.channels.includes("changelog"));
    });
  },
};

/**
 * Public engagement remains a distinct service boundary from workspace
 * feedback: visitors can react to or discuss a published changelog entry
 * without gaining access to internal feedback threads.
 */
export const publicEngagementService = {
  async get(workspace: string, slug: string): Promise<PublicReleaseEngagement> {
    return withMockDelay(() => toPublicReleaseEngagement(getPublicReleaseRecord(workspace, slug)));
  },
  async toggleReaction(workspace: string, slug: string): Promise<PublicReleaseEngagement> {
    return withMockDelay(() => {
      const release = getPublicReleaseRecord(workspace, slug);
      const hasReacted = publicReactionReleaseIds.has(release.id);

      if (hasReacted) {
        publicReactionReleaseIds.delete(release.id);
      } else {
        publicReactionReleaseIds.add(release.id);
      }

      const updated = updateReleaseRecord(release.id, {
        reactions: Math.max(0, release.reactions + (hasReacted ? -1 : 1)),
      });
      return toPublicReleaseEngagement(updated);
    });
  },
  async listComments(workspace: string, slug: string): Promise<PublicReleaseComment[]> {
    return withMockDelay(() => {
      const release = getPublicReleaseRecord(workspace, slug);
      return publicReleaseComments
        .filter((comment) => comment.releaseId === release.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((comment) => ({ ...comment }));
    });
  },
  async createComment(input: CreatePublicReleaseCommentInput): Promise<PublicReleaseComment> {
    return withMockDelay(() => {
      const release = getPublicReleaseRecord(input.workspace, input.slug);
      const body = input.body.trim();
      const author = input.author?.trim();

      if (!body) throw new Error("Write a comment before posting it");
      if (body.length > 1000) throw new Error("Comments must be 1,000 characters or fewer");

      const comment: PublicReleaseComment = {
        id: `public_comment_${Date.now()}`,
        releaseId: release.id,
        author: author ? author.slice(0, 80) : "Guest",
        body,
        createdAt: new Date().toISOString(),
      };
      publicReleaseComments = [...publicReleaseComments, comment];
      updateReleaseRecord(release.id, {
        comments: publicReleaseComments.filter((item) => item.releaseId === release.id).length,
      });
      return { ...comment };
    }, 650);
  },
};

export const activityService = {
  async list(filters?: { unreadOnly?: boolean; type?: ActivityEvent["type"] }) {
    return withMockDelay(() => {
      let items = [...activityEvents];
      if (filters?.unreadOnly) items = items.filter((event) => !event.read);
      if (filters?.type) items = items.filter((event) => event.type === filters.type);
      return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  },
  async markRead(id: string) {
    return withMockDelay(() => {
      const index = activityEvents.findIndex((event) => event.id === id);
      if (index === -1) throw new Error("Activity event not found");
      activityEvents[index] = { ...activityEvents[index], read: true };
      return activityEvents[index];
    });
  },
  async markAllRead() {
    return withMockDelay(() => {
      activityEvents = activityEvents.map((event) => ({ ...event, read: true }));
      return activityEvents;
    });
  },
};

export const billingService = {
  async get() {
    return withMockDelay(() => billing);
  },
  async changePlan(plan: "starter" | "pro" | "scale") {
    return withMockDelay(() => {
      const prices = { starter: 19, pro: 49, scale: 149 };
      billing = { ...billing, plan, price: prices[plan] };
      recordActivity({ type: "comment", message: `Plan changed to ${plan} (mock)`, link: "/app/billing", actor: "Don Jesus" });
      return billing;
    });
  },
};

export const apiService = {
  async getKeys() {
    return withMockDelay(() => [...apiKeys]);
  },
  async createKey(name: string) {
    return withMockDelay(() => {
      const key: ApiKey = { id: `key_${Date.now()}`, name, prefix: "shipbrief_live_", createdAt: new Date().toISOString() };
      apiKeys = [key, ...apiKeys];
      recordActivity({ type: "comment", message: `API key created for ${name} (mock)`, link: "/app/api", actor: "Don Jesus" });
      return key;
    });
  },
  async revokeKey(id: string) {
    return withMockDelay(() => {
      const key = apiKeys.find((item) => item.id === id);
      if (!key) throw new Error("API key not found");
      apiKeys = apiKeys.filter((item) => item.id !== id);
      recordActivity({ type: "comment", message: `API key ${key.name} revoked (mock)`, link: "/app/api", actor: "Don Jesus" });
      return { id };
    });
  },
  async getWebhooks() {
    return withMockDelay(() => [...webhooks]);
  },
  async createWebhook(input: Pick<Webhook, "url" | "events">) {
    return withMockDelay(() => {
      const webhook: Webhook = { id: `wh_${Date.now()}`, ...input, status: "active", lastDelivery: undefined };
      webhooks = [webhook, ...webhooks];
      recordActivity({ type: "comment", message: "Webhook endpoint added (mock)", link: "/app/api", actor: "Don Jesus" });
      return webhook;
    });
  },
  async updateWebhook(id: string, input: Partial<Pick<Webhook, "url" | "events" | "status">>) {
    return withMockDelay(() => {
      const index = webhooks.findIndex((webhook) => webhook.id === id);
      if (index === -1) throw new Error("Webhook not found");
      webhooks[index] = { ...webhooks[index], ...input };
      return webhooks[index];
    });
  },
  async removeWebhook(id: string) {
    return withMockDelay(() => {
      const webhook = webhooks.find((item) => item.id === id);
      if (!webhook) throw new Error("Webhook not found");
      webhooks = webhooks.filter((item) => item.id !== id);
      webhookDeliveries = webhookDeliveries.filter((delivery) => delivery.webhookId !== id);
      return { id };
    });
  },
  async getDeliveries(webhookId?: string) {
    return withMockDelay(() => webhookDeliveries.filter((delivery) => !webhookId || delivery.webhookId === webhookId));
  },
  async retryDelivery(id: string) {
    return withMockDelay(() => {
      const index = webhookDeliveries.findIndex((delivery) => delivery.id === id);
      if (index === -1) throw new Error("Webhook delivery not found");
      webhookDeliveries[index] = { ...webhookDeliveries[index], status: "success", responseCode: 202, deliveredAt: new Date().toISOString() };
      return webhookDeliveries[index];
    });
  },
};

export const brandingService = {
  async get() {
    return withMockDelay(() => branding);
  },
  async update(input: Partial<WorkspaceBranding>) {
    return withMockDelay(() => {
      branding = { ...branding, ...input };
      return branding;
    });
  },
};

export const settingsService = {
  async get() {
    return withMockDelay(() => workspaceSettings);
  },
  async update(input: Partial<WorkspaceSettings>) {
    return withMockDelay(() => {
      workspaceSettings = { ...workspaceSettings, ...input, notifications: { ...workspaceSettings.notifications, ...input.notifications } };
      return workspaceSettings;
    });
  },
  async exportData() {
    return withMockDelay(() => ({ filename: "shipbrief-workspace-export.json" }), 700);
  },
};

export const migrationService = {
  async preview(input: { source: MigrationSource; fileName?: string }): Promise<MigrationPreview> {
    return withMockDelay(
      () => ({
        source: input.source,
        fileName: input.fileName,
        posts: input.source === "csv" ? 28 : 42,
        images: input.source === "csv" ? 0 : 39,
        tags: input.source === "other" ? 8 : 12,
        conflicts: 0,
      }),
      650
    );
  },
  async stageImport(input: {
    source: MigrationSource;
    fileName?: string;
    preserveDates: boolean;
    preserveFormatting: boolean;
  }): Promise<MigrationResult> {
    return withMockDelay(
      () => {
        const posts = input.source === "csv" ? 28 : 42;
        const result: MigrationResult = {
          source: input.source,
          fileName: input.fileName,
          posts,
          images: input.source === "csv" ? 0 : 39,
          tags: input.source === "other" ? 8 : 12,
          conflicts: 0,
          imported: posts,
          preservedDates: input.preserveDates,
          preservedFormatting: input.preserveFormatting,
        };
        recordActivity({
          type: "integration",
          message: `Migration from ${input.source} staged (${posts} posts, mock)`,
          link: "/app/integrations",
          actor: "Don Jesus",
        });
        return result;
      },
      1200
    );
  },
};

function recordActivity(input: Omit<ActivityEvent, "id" | "timestamp" | "read">) {
  activityEvents = [{ id: `act_${Date.now()}`, timestamp: new Date().toISOString(), read: false, ...input }, ...activityEvents];
}

export const aiService = {
  async clusterFeedback(items: FeedbackRequest[]): Promise<FeedbackCluster[]> {
    return withMockDelay(() => {
      const availableIds = new Set(items.map((item) => item.id));
      return mockClusters
        .map((cluster) => ({
          ...cluster,
          feedbackIds: cluster.feedbackIds.filter((id) => availableIds.has(id)),
        }))
        .filter((cluster) => cluster.feedbackIds.length > 0);
    }, 1400);
  },

  async rewrite(text: string, instruction: string) {
    return withMockDelay(() => {
      if (instruction.toLowerCase().includes("shorter")) {
        return { id: `ai_${Date.now()}`, content: text.slice(0, Math.max(80, text.length * 0.6)) + "…", summary: "Shortened version" };
      }
      if (instruction.toLowerCase().includes("friendlier")) {
        return { id: `ai_${Date.now()}`, content: text.replace(/\./g, "!").replace(/you can/gi, "you'll love being able to"), summary: "Friendlier version" };
      }
      return { id: `ai_${Date.now()}`, content: `[AI ${instruction}] ${text}`, summary: `Applied: ${instruction}` };
    }, 1200);
  },

  async generateChannelVariant(release: Release, channel: Channel) {
    return withMockDelay(() => {
      if (channel === "email") {
        return {
          id: `ai_${Date.now()}`,
          content: release.body,
          summary: release.summary,
          channel,
          subject: release.title,
          previewText: release.summary,
        };
      }
      return {
        id: `ai_${Date.now()}`,
        content: release.body,
        summary: release.summary,
        channel,
      };
    }, 1500);
  },

  async qualityCheck(text: string) {
    return withMockDelay(() => ({
      issues: text.length > 500 ? ["Content may be too long for in-app"] : [],
      suggestions: text.includes("implement") ? ["Consider replacing technical jargon with customer benefits"] : [],
    }), 800);
  },
};
