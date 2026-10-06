import { z } from "zod";
import * as authV from "../validators/auth.js";
import * as pubV from "../validators/public.js";
import * as relV from "../validators/releases.js";
import * as wsV from "../validators/workspace.js";

/**
 * OpenAPI 3.1 description of the API. Request bodies and query parameters are
 * generated from the same zod schemas the controllers validate with, so the
 * documented contract and the enforced one can't drift apart.
 */

type Auth = "session" | "apiKey" | "public";
type Endpoint = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  tag: string;
  summary: string;
  auth: Auth;
  permission?: string;
  body?: z.ZodType;
  query?: z.ZodType;
  status?: number;
};

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;

const E: Endpoint[] = [
  // Auth
  { method: "get", path: "/auth/session", tag: "Auth", summary: "Current user, active workspace, role and permissions (null when signed out)", auth: "public" },
  { method: "get", path: "/auth/providers", tag: "Auth", summary: "Which OAuth sign-in providers are configured", auth: "public" },
  { method: "post", path: "/auth/register", tag: "Auth", summary: "Create an account, start a session and send a verification email", auth: "public", body: authV.registerSchema, status: 201 },
  { method: "post", path: "/auth/login", tag: "Auth", summary: "Sign in with email and password", auth: "public", body: authV.loginSchema },
  { method: "post", path: "/auth/logout", tag: "Auth", summary: "Revoke the current session", auth: "public", status: 204 },
  { method: "get", path: "/auth/verify-email", tag: "Auth", summary: "Target of the verification email link; redirects into the app", auth: "public", query: authV.verifyEmailQuery, status: 303 },
  { method: "post", path: "/auth/resend-email", tag: "Auth", summary: "Resend a verification or password-reset email", auth: "public", body: authV.resendSchema },
  { method: "post", path: "/auth/forgot-password", tag: "Auth", summary: "Send a password-reset link (never reveals whether the account exists)", auth: "public", body: authV.emailOnlySchema },
  { method: "post", path: "/auth/reset-password", tag: "Auth", summary: "Set a new password with a one-time token; signs out all sessions", auth: "public", body: authV.resetPasswordSchema },
  { method: "get", path: "/auth/oauth/{provider}/start", tag: "Auth", summary: "Start Google or GitHub sign-in (redirect)", auth: "public", query: authV.oauthStartQuery, status: 302 },
  { method: "post", path: "/auth/onboarding", tag: "Auth", summary: "Create the first workspace (requires a verified email)", auth: "session", body: authV.onboardingSchema, status: 201 },
  { method: "post", path: "/auth/workspace", tag: "Auth", summary: "Switch the session's active workspace", auth: "session", body: authV.switchWorkspaceSchema },
  { method: "patch", path: "/auth/profile", tag: "Auth", summary: "Update your name", auth: "session", body: authV.profileSchema },
  { method: "post", path: "/auth/password", tag: "Auth", summary: "Change password; signs out other sessions", auth: "session", body: authV.changePasswordSchema, status: 204 },
  { method: "get", path: "/auth/sessions", tag: "Auth", summary: "Your active sessions", auth: "session" },
  { method: "delete", path: "/auth/sessions/{id}", tag: "Auth", summary: "Sign out one of your sessions", auth: "session", status: 204 },

  // Releases
  { method: "get", path: "/releases", tag: "Releases", summary: "List releases (search, filters, pagination)", auth: "session", permission: "release:read", query: relV.listReleasesQuery },
  { method: "get", path: "/releases/counts", tag: "Releases", summary: "Release counts by status", auth: "session", permission: "release:read" },
  { method: "post", path: "/releases", tag: "Releases", summary: "Create a draft release", auth: "session", permission: "release:write", body: relV.createReleaseSchema, status: 201 },
  { method: "get", path: "/releases/{id}", tag: "Releases", summary: "Get a release with per-channel publication state", auth: "session", permission: "release:read" },
  { method: "patch", path: "/releases/{id}", tag: "Releases", summary: "Update editable fields (records a version when content changes)", auth: "session", permission: "release:write", body: relV.updateReleaseSchema },
  { method: "delete", path: "/releases/{id}", tag: "Releases", summary: "Delete an unpublished release (soft delete)", auth: "session", permission: "release:delete" },
  { method: "post", path: "/releases/{id}/duplicate", tag: "Releases", summary: "Duplicate as a new draft", auth: "session", permission: "release:write", status: 201 },
  { method: "post", path: "/releases/{id}/submit", tag: "Releases", summary: "draft → in_review", auth: "session", permission: "release:submit" },
  { method: "post", path: "/releases/{id}/approve", tag: "Releases", summary: "in_review → approved", auth: "session", permission: "release:approve" },
  { method: "post", path: "/releases/{id}/request-changes", tag: "Releases", summary: "in_review → draft, with a review note", auth: "session", permission: "release:approve", body: relV.requestChangesSchema },
  { method: "post", path: "/releases/{id}/schedule", tag: "Releases", summary: "approved → scheduled (auto-published by the worker)", auth: "session", permission: "release:schedule", body: relV.scheduleSchema },
  { method: "post", path: "/releases/{id}/unschedule", tag: "Releases", summary: "scheduled → approved", auth: "session", permission: "release:schedule" },
  { method: "post", path: "/releases/{id}/publish", tag: "Releases", summary: "approved|scheduled → published on every selected channel", auth: "session", permission: "release:publish" },
  { method: "post", path: "/releases/{id}/archive", tag: "Releases", summary: "published → archived", auth: "session", permission: "release:archive" },
  { method: "get", path: "/releases/{id}/versions", tag: "Releases", summary: "Version history", auth: "session", permission: "release:read" },
  { method: "post", path: "/releases/{id}/versions/{versionId}/restore", tag: "Releases", summary: "Restore a version", auth: "session", permission: "release:write" },
  { method: "get", path: "/changelog", tag: "Releases", summary: "Changelog manager listing", auth: "session", permission: "release:read" },
  { method: "get", path: "/changelog/filters", tag: "Releases", summary: "Categories and tags in use", auth: "session", permission: "release:read" },
  { method: "post", path: "/releases/{id}/comments/{commentId}/hide", tag: "Releases", summary: "Hide a public comment", auth: "session", permission: "release:write" },

  // AI
  { method: "post", path: "/ai/generate-release", tag: "AI", summary: "Draft a release from notes or source material", auth: "session", permission: "ai:use", body: wsV.aiGenerateReleaseSchema },
  { method: "post", path: "/ai/rewrite", tag: "AI", summary: "Rewrite text with an instruction (shorter, clearer, friendlier…)", auth: "session", permission: "ai:use", body: wsV.aiRewriteSchema },
  { method: "post", path: "/ai/channel-variant", tag: "AI", summary: "Adapt a release for changelog, email or in-app", auth: "session", permission: "ai:use", body: wsV.aiVariantSchema },
  { method: "post", path: "/ai/quality-check", tag: "AI", summary: "Pre-publish quality review", auth: "session", permission: "ai:use", body: wsV.aiQualitySchema },
  { method: "post", path: "/feedback/clusters/regenerate", tag: "AI", summary: "Group open feedback into themes", auth: "session", permission: "feedback:manage" },

  // Feedback & roadmap
  { method: "get", path: "/feedback", tag: "Feedback", summary: "List feedback", auth: "session", permission: "feedback:read", query: wsV.listFeedbackQuery },
  { method: "post", path: "/feedback", tag: "Feedback", summary: "Create a request (counts your vote)", auth: "session", permission: "feedback:create", body: wsV.createFeedbackSchema, status: 201 },
  { method: "get", path: "/feedback/clusters", tag: "Feedback", summary: "Current feedback themes", auth: "session", permission: "feedback:read" },
  { method: "get", path: "/feedback/{id}", tag: "Feedback", summary: "Get a request", auth: "session", permission: "feedback:read" },
  { method: "patch", path: "/feedback/{id}", tag: "Feedback", summary: "Update status, priority, notes, links", auth: "session", permission: "feedback:manage", body: wsV.updateFeedbackSchema },
  { method: "post", path: "/feedback/{id}/vote", tag: "Feedback", summary: "Vote (idempotent, one per member)", auth: "session", permission: "feedback:vote" },
  { method: "get", path: "/feedback/{id}/comments", tag: "Feedback", summary: "Comments", auth: "session", permission: "feedback:read" },
  { method: "post", path: "/feedback/{id}/comments", tag: "Feedback", summary: "Add a comment (optionally internal)", auth: "session", permission: "feedback:comment", body: wsV.commentSchema, status: 201 },
  { method: "post", path: "/feedback/{id}/merge", tag: "Feedback", summary: "Merge into another request", auth: "session", permission: "feedback:manage", body: wsV.mergeSchema },
  { method: "get", path: "/roadmap", tag: "Roadmap", summary: "Roadmap items with linked feedback and derived votes", auth: "session", permission: "roadmap:read" },
  { method: "post", path: "/roadmap", tag: "Roadmap", summary: "Create an item", auth: "session", permission: "roadmap:manage", body: wsV.createRoadmapSchema, status: 201 },
  { method: "post", path: "/roadmap/reorder", tag: "Roadmap", summary: "Order items within a column", auth: "session", permission: "roadmap:manage", body: wsV.reorderRoadmapSchema },
  { method: "post", path: "/roadmap/from-cluster", tag: "Roadmap", summary: "Create an item from a feedback theme", auth: "session", permission: "roadmap:manage", body: wsV.fromClusterSchema, status: 201 },
  { method: "get", path: "/roadmap/{id}", tag: "Roadmap", summary: "Get an item", auth: "session", permission: "roadmap:read" },
  { method: "patch", path: "/roadmap/{id}", tag: "Roadmap", summary: "Update an item and its links", auth: "session", permission: "roadmap:manage", body: wsV.updateRoadmapSchema },
  { method: "delete", path: "/roadmap/{id}", tag: "Roadmap", summary: "Delete an item", auth: "session", permission: "roadmap:manage" },

  // Email
  { method: "get", path: "/campaigns", tag: "Email", summary: "List campaigns", auth: "session", permission: "release:read" },
  { method: "get", path: "/campaigns/by-release", tag: "Email", summary: "Latest campaign for a release", auth: "session", permission: "release:read", query: wsV.byReleaseQuery },
  { method: "post", path: "/campaigns", tag: "Email", summary: "Create a campaign", auth: "session", permission: "campaign:write", body: wsV.createCampaignSchema, status: 201 },
  { method: "patch", path: "/campaigns/{id}", tag: "Email", summary: "Edit or schedule a campaign", auth: "session", permission: "campaign:write", body: wsV.updateCampaignSchema },
  { method: "get", path: "/audiences", tag: "Email", summary: "Audiences with live sizes", auth: "session", permission: "release:read" },
  { method: "post", path: "/audiences", tag: "Email", summary: "Create an audience", auth: "session", permission: "audience:write", body: wsV.createAudienceSchema, status: 201 },
  { method: "post", path: "/audiences/preview", tag: "Email", summary: "Size of an audience for given rules", auth: "session", permission: "release:read", body: wsV.audienceRulesSchema },

  // Workspace
  { method: "get", path: "/overview", tag: "Workspace", summary: "Overview dashboard aggregate", auth: "session", permission: "workspace:read" },
  { method: "get", path: "/analytics", tag: "Workspace", summary: "Analytics for a range", auth: "session", permission: "analytics:read", query: wsV.rangeQuery },
  { method: "get", path: "/analytics/export", tag: "Workspace", summary: "Daily analytics as CSV", auth: "session", permission: "analytics:read", query: wsV.rangeQuery },
  { method: "get", path: "/activity", tag: "Workspace", summary: "Activity feed with per-user read state", auth: "session", permission: "activity:read", query: wsV.activityQuery },
  { method: "post", path: "/activity/{id}/read", tag: "Workspace", summary: "Mark one event read", auth: "session", permission: "activity:read" },
  { method: "post", path: "/activity/read-all", tag: "Workspace", summary: "Mark everything read", auth: "session", permission: "activity:read" },
  { method: "get", path: "/audit-logs", tag: "Workspace", summary: "Security audit log", auth: "session", permission: "audit:read" },
  { method: "get", path: "/team", tag: "Workspace", summary: "Members and pending invitations", auth: "session", permission: "team:read" },
  { method: "post", path: "/team/invitations", tag: "Workspace", summary: "Invite someone", auth: "session", permission: "team:manage", body: wsV.inviteSchema, status: 201 },
  { method: "patch", path: "/team/{id}", tag: "Workspace", summary: "Change a member's or invitation's role", auth: "session", permission: "team:manage", body: wsV.roleSchema },
  { method: "delete", path: "/team/{id}", tag: "Workspace", summary: "Remove a member or revoke an invitation", auth: "session", permission: "team:manage" },
  { method: "post", path: "/team/transfer-ownership", tag: "Workspace", summary: "Transfer ownership", auth: "session", permission: "workspace:delete", body: wsV.transferSchema },
  { method: "get", path: "/settings", tag: "Workspace", summary: "Workspace settings", auth: "session", permission: "workspace:read" },
  { method: "patch", path: "/settings", tag: "Workspace", summary: "Update settings", auth: "session", permission: "workspace:update", body: wsV.settingsSchema },
  { method: "get", path: "/settings/export", tag: "Workspace", summary: "Full JSON export", auth: "session", permission: "workspace:export" },
  { method: "post", path: "/settings/delete", tag: "Workspace", summary: "Delete the workspace (owner, name confirmation)", auth: "session", permission: "workspace:delete", body: wsV.deleteWorkspaceSchema },
  { method: "get", path: "/branding", tag: "Workspace", summary: "Branding", auth: "session", permission: "workspace:read" },
  { method: "patch", path: "/branding", tag: "Workspace", summary: "Update branding", auth: "session", permission: "branding:update", body: wsV.brandingSchema },
  { method: "get", path: "/changelog/settings", tag: "Workspace", summary: "Public changelog settings and its URLs (page and RSS)", auth: "session", permission: "workspace:read" },
  { method: "patch", path: "/changelog/settings", tag: "Workspace", summary: "Turn the public changelog, email subscriptions or author names on or off", auth: "session", permission: "branding:update", body: wsV.changelogSettingsSchema },
  { method: "get", path: "/widget", tag: "Workspace", summary: "Widget install settings", auth: "session", permission: "workspace:read" },
  { method: "patch", path: "/widget", tag: "Workspace", summary: "Update widget settings", auth: "session", permission: "branding:update", body: wsV.widgetSettingsSchema },
  { method: "get", path: "/widget/identity-secret", tag: "Workspace", summary: "Widget identity secret (signs userHash)", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/widget/identity-secret/rotate", tag: "Workspace", summary: "Rotate the widget identity secret", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/uploads", tag: "Workspace", summary: "Upload a logo, favicon, media file or import (multipart: purpose, file)", auth: "session", permission: "release:write", status: 201 },
  { method: "post", path: "/imports/preview", tag: "Workspace", summary: "Preview a CSV/JSON import", auth: "session", permission: "import:run", body: wsV.migrationSchema },
  { method: "post", path: "/imports", tag: "Workspace", summary: "Import posts as drafts", auth: "session", permission: "import:run", body: wsV.migrationSchema, status: 201 },

  // Billing
  { method: "get", path: "/billing", tag: "Billing", summary: "Plan, usage, invoices", auth: "session", permission: "billing:read" },
  { method: "post", path: "/billing/checkout", tag: "Billing", summary: "Start Stripe Checkout for a plan", auth: "session", permission: "billing:manage", body: wsV.checkoutSchema },
  { method: "post", path: "/billing/portal", tag: "Billing", summary: "Open the Stripe billing portal", auth: "session", permission: "billing:manage" },
  { method: "post", path: "/billing/webhook", tag: "Billing", summary: "Stripe webhook (signature-verified, idempotent)", auth: "public" },

  // Developer
  { method: "get", path: "/api-keys", tag: "Developer", summary: "List API keys (never includes secrets)", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/api-keys", tag: "Developer", summary: "Create a key; the secret is returned once", auth: "session", permission: "developer:manage", body: wsV.createApiKeySchema, status: 201 },
  { method: "delete", path: "/api-keys/{id}", tag: "Developer", summary: "Revoke a key", auth: "session", permission: "developer:manage" },
  { method: "get", path: "/webhooks", tag: "Developer", summary: "List webhooks", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/webhooks", tag: "Developer", summary: "Create a webhook; the signing secret is returned once", auth: "session", permission: "developer:manage", body: wsV.createWebhookSchema, status: 201 },
  { method: "patch", path: "/webhooks/{id}", tag: "Developer", summary: "Update a webhook", auth: "session", permission: "developer:manage", body: wsV.updateWebhookSchema },
  { method: "delete", path: "/webhooks/{id}", tag: "Developer", summary: "Delete a webhook", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/webhooks/{id}/rotate-secret", tag: "Developer", summary: "Rotate the signing secret", auth: "session", permission: "developer:manage" },
  { method: "post", path: "/webhooks/{id}/test", tag: "Developer", summary: "Send a test event", auth: "session", permission: "developer:manage", status: 202 },
  { method: "get", path: "/webhooks/deliveries", tag: "Developer", summary: "Delivery log", auth: "session", permission: "developer:manage", query: wsV.deliveriesQuery },
  { method: "post", path: "/webhooks/deliveries/{id}/retry", tag: "Developer", summary: "Queue a re-delivery", auth: "session", permission: "developer:manage", status: 202 },
  { method: "get", path: "/integrations", tag: "Developer", summary: "Integrations and their state", auth: "session", permission: "workspace:read" },
  { method: "get", path: "/integrations/{provider}/targets", tag: "Developer", summary: "Repositories / projects / teams the connection can see", auth: "session", permission: "integrations:manage" },
  { method: "post", path: "/integrations/{provider}/connect", tag: "Developer", summary: "Start OAuth; returns authorizeUrl", auth: "session", permission: "integrations:manage" },
  { method: "post", path: "/integrations/{provider}/sync", tag: "Developer", summary: "Pull completed work into a draft release", auth: "session", permission: "integrations:manage" },
  { method: "post", path: "/integrations/{provider}/disconnect", tag: "Developer", summary: "Disconnect and delete stored tokens", auth: "session", permission: "integrations:manage" },
  { method: "patch", path: "/integrations/{provider}", tag: "Developer", summary: "Set the repository/project scope", auth: "session", permission: "integrations:manage", body: wsV.integrationUpdateSchema },

  // Public
  { method: "get", path: "/public/workspaces/{workspace}", tag: "Public", summary: "Public workspace name and branding", auth: "public" },
  { method: "get", path: "/public/workspaces/{workspace}/releases", tag: "Public", summary: "Published changelog entries", auth: "public", query: pubV.publicListQuery },
  { method: "get", path: "/public/workspaces/{workspace}/releases/{slug}", tag: "Public", summary: "One published update", auth: "public" },
  { method: "get", path: "/public/workspaces/{workspace}/rss.xml", tag: "Public", summary: "RSS 2.0 feed of the public changelog", auth: "public" },
  { method: "get", path: "/public/workspaces/{workspace}/releases/{slug}/engagement", tag: "Public", summary: "Reaction/comment counts and whether this visitor reacted", auth: "public" },
  { method: "post", path: "/public/workspaces/{workspace}/releases/{slug}/reaction", tag: "Public", summary: "Toggle this visitor's reaction", auth: "public" },
  { method: "get", path: "/public/workspaces/{workspace}/releases/{slug}/comments", tag: "Public", summary: "Public comments", auth: "public" },
  { method: "post", path: "/public/workspaces/{workspace}/releases/{slug}/comments", tag: "Public", summary: "Post a comment", auth: "public", body: pubV.publicCommentSchema, status: 201 },
  { method: "post", path: "/public/workspaces/{workspace}/views", tag: "Public", summary: "Record a view (deduplicated per visitor)", auth: "public", body: pubV.viewSchema, status: 204 },
  { method: "post", path: "/public/workspaces/{workspace}/feedback", tag: "Public", summary: "Submit customer feedback", auth: "public", body: pubV.publicFeedbackSchema, status: 201 },
  { method: "get", path: "/public/workspaces/{workspace}/roadmap", tag: "Public", summary: "Public roadmap items", auth: "public" },
  { method: "get", path: "/public/widget/{key}", tag: "Public", summary: "Widget configuration", auth: "public" },
  { method: "get", path: "/public/widget/{key}/updates", tag: "Public", summary: "In-app updates with this visitor's read state (X-Visitor-Id)", auth: "public", query: pubV.widgetListQuery },
  { method: "post", path: "/public/widget/{key}/updates/{releaseId}/read", tag: "Public", summary: "Mark an update read", auth: "public" },
  { method: "post", path: "/public/widget/{key}/updates/read-all", tag: "Public", summary: "Mark all updates read", auth: "public" },
  { method: "post", path: "/public/widget/{key}/updates/{releaseId}/dismiss", tag: "Public", summary: "Dismiss an announcement", auth: "public" },
  { method: "post", path: "/public/widget/{key}/updates/{releaseId}/click", tag: "Public", summary: "Record a CTA click", auth: "public" },
  { method: "post", path: "/public/widget/{key}/identify", tag: "Public", summary: "Identify a signed-in user (userHash = HMAC-SHA256(identity secret, user.id)); adds them to contacts", auth: "public", body: pubV.widgetIdentifySchema },
  { method: "post", path: "/public/widget/{key}/subscription", tag: "Public", summary: "Turn release emails on or off for the identified user (X-Widget-Session)", auth: "public", body: pubV.widgetSubscriptionSchema },
  { method: "get", path: "/public/unsubscribe", tag: "Public", summary: "Unsubscribe link from release emails (also accepts one-click POST)", auth: "public", query: pubV.unsubscribeQuery },

  // v1
  { method: "get", path: "/v1/releases", tag: "Public API v1", summary: "List releases", auth: "apiKey", permission: "releases:read", query: relV.listReleasesQuery },
  { method: "get", path: "/v1/releases/{id}", tag: "Public API v1", summary: "Get a release", auth: "apiKey", permission: "releases:read" },
  { method: "get", path: "/v1/feedback", tag: "Public API v1", summary: "List feedback", auth: "apiKey", permission: "feedback:read", query: wsV.listFeedbackQuery },
  { method: "post", path: "/v1/feedback", tag: "Public API v1", summary: "Create feedback", auth: "apiKey", permission: "feedback:write", body: wsV.createFeedbackSchema, status: 201 },
  { method: "post", path: "/v1/contacts", tag: "Public API v1", summary: "Create or update an end user (audiences, email)", auth: "apiKey", permission: "contacts:write", body: pubV.contactSchema },
];

const errorEnvelope = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string", examples: ["RELEASE_NOT_FOUND"] }, message: { type: "string" }, details: {} },
    },
    requestId: { type: "string" },
  },
};

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of E) {
    const params = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    const queryParams = endpoint.query
      ? Object.entries((toSchema(endpoint.query).properties ?? {}) as Record<string, unknown>).map(([name, schema]) => ({ name, in: "query", required: false, schema }))
      : [];
    const status = String(endpoint.status ?? 200);
    paths[endpoint.path] ??= {};
    paths[endpoint.path]![endpoint.method] = {
      tags: [endpoint.tag],
      summary: endpoint.summary,
      ...(endpoint.permission ? { description: `${endpoint.auth === "apiKey" ? "Scope" : "Permission"}: \`${endpoint.permission}\`` } : {}),
      security: endpoint.auth === "session" ? [{ session: [] }] : endpoint.auth === "apiKey" ? [{ apiKey: [] }] : [],
      parameters: [...params, ...queryParams],
      ...(endpoint.body ? { requestBody: { required: true, content: { "application/json": { schema: toSchema(endpoint.body) } } } } : {}),
      responses: {
        [status]: {
          description: "Success",
          ...(status === "204" || status.startsWith("30") ? {} : { content: { "application/json": { schema: { type: "object", properties: { success: { const: true }, data: {}, meta: { $ref: "#/components/schemas/PageMeta" } } } } } }),
        },
        default: { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "ShipBrief API",
      version: "1.0.0",
      description:
        "Every response uses the envelope `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? }, requestId }`. Session endpoints require the `sb_session` cookie and a trusted `Origin` on state-changing requests.",
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "sb_session" },
        apiKey: { type: "http", scheme: "bearer", description: "`sb_live_…` API key" },
      },
      schemas: { Error: errorEnvelope, PageMeta: { type: "object", properties: { page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, hasMore: { type: "boolean" } } } },
    },
    paths,
  };
}
