import { Router } from "express";
import multer from "multer";
import * as ws from "../controllers/workspace.controller.js";
import * as platform from "../controllers/platform.controller.js";
import { requirePermission } from "../middleware/auth.js";
import { limits } from "../middleware/rate-limit.js";
import { MAX_UPLOAD_BYTES } from "../services/upload.service.js";

/** Everything here requires a session with an active workspace; each route declares its permission. */
export const workspaceRoutes = Router();
const p = requirePermission;

workspaceRoutes.get("/overview", p("workspace:read"), ws.getOverview);
workspaceRoutes.get("/analytics", p("analytics:read"), ws.getAnalytics);
workspaceRoutes.get("/analytics/export", p("analytics:read"), ws.exportAnalytics);
workspaceRoutes.get("/activity", p("activity:read"), ws.listActivity);
workspaceRoutes.post("/activity/read-all", p("activity:read"), ws.markAllActivityRead);
workspaceRoutes.post("/activity/:id/read", p("activity:read"), ws.markActivityRead);
workspaceRoutes.get("/audit-logs", p("audit:read"), ws.listAudit);

workspaceRoutes.get("/changelog", p("release:read"), ws.listChangelog);
workspaceRoutes.get("/changelog/filters", p("release:read"), ws.changelogFilters);
workspaceRoutes.post("/releases/:id/comments/:commentId/hide", p("release:write"), ws.hideComment);

workspaceRoutes.get("/feedback", p("feedback:read"), ws.listFeedback);
workspaceRoutes.post("/feedback", p("feedback:create"), ws.createFeedback);
workspaceRoutes.get("/feedback/clusters", p("feedback:read"), ws.listClusters);
workspaceRoutes.post("/feedback/clusters/regenerate", p("feedback:manage"), limits.ai, platform.aiClusterFeedback);
workspaceRoutes.get("/feedback/:id", p("feedback:read"), ws.getFeedback);
workspaceRoutes.patch("/feedback/:id", p("feedback:manage"), ws.updateFeedback);
workspaceRoutes.post("/feedback/:id/vote", p("feedback:vote"), ws.voteFeedback);
workspaceRoutes.get("/feedback/:id/comments", p("feedback:read"), ws.listFeedbackComments);
workspaceRoutes.post("/feedback/:id/comments", p("feedback:comment"), ws.addFeedbackComment);
workspaceRoutes.post("/feedback/:id/merge", p("feedback:manage"), ws.mergeFeedback);

workspaceRoutes.get("/roadmap", p("roadmap:read"), ws.listRoadmap);
workspaceRoutes.post("/roadmap", p("roadmap:manage"), ws.createRoadmapItem);
workspaceRoutes.post("/roadmap/reorder", p("roadmap:manage"), ws.reorderRoadmap);
workspaceRoutes.post("/roadmap/from-cluster", p("roadmap:manage"), ws.roadmapFromCluster);
workspaceRoutes.get("/roadmap/:id", p("roadmap:read"), ws.getRoadmapItem);
workspaceRoutes.patch("/roadmap/:id", p("roadmap:manage"), ws.updateRoadmapItem);
workspaceRoutes.delete("/roadmap/:id", p("roadmap:manage"), ws.deleteRoadmapItem);

workspaceRoutes.get("/campaigns", p("release:read"), ws.listCampaigns);
workspaceRoutes.get("/campaigns/by-release", p("release:read"), ws.campaignByRelease);
workspaceRoutes.post("/campaigns", p("campaign:write"), ws.createCampaign);
workspaceRoutes.patch("/campaigns/:id", p("campaign:write"), ws.updateCampaign);
workspaceRoutes.get("/audiences", p("release:read"), ws.listAudiences);
workspaceRoutes.post("/audiences", p("audience:write"), ws.createAudience);
workspaceRoutes.post("/audiences/preview", p("release:read"), ws.previewAudience);
workspaceRoutes.get("/audiences/:id", p("release:read"), ws.getAudience);

workspaceRoutes.get("/team", p("team:read"), ws.listTeam);
workspaceRoutes.post("/team/invitations", p("team:manage"), ws.invite);
workspaceRoutes.post("/team/transfer-ownership", p("workspace:delete"), ws.transferOwnership);
workspaceRoutes.patch("/team/:id", p("team:manage"), ws.updateRole);
workspaceRoutes.delete("/team/:id", p("team:manage"), ws.removeMember);

workspaceRoutes.get("/settings", p("workspace:read"), ws.getSettings);
workspaceRoutes.patch("/settings", p("workspace:update"), ws.updateSettings);
workspaceRoutes.get("/settings/export", p("workspace:export"), ws.exportData);
workspaceRoutes.post("/settings/delete", p("workspace:delete"), ws.deleteWorkspace);
workspaceRoutes.get("/branding", p("workspace:read"), ws.getBranding);
workspaceRoutes.patch("/branding", p("branding:update"), ws.updateBranding);
workspaceRoutes.get("/widget", p("workspace:read"), ws.getWidget);
workspaceRoutes.patch("/widget", p("branding:update"), ws.updateWidget);

workspaceRoutes.get("/billing", p("billing:read"), ws.getBilling);
workspaceRoutes.post("/billing/checkout", p("billing:manage"), ws.checkout);
workspaceRoutes.post("/billing/portal", p("billing:manage"), ws.portal);

workspaceRoutes.post("/ai/generate-release", p("ai:use"), limits.ai, platform.aiGenerateRelease);
workspaceRoutes.post("/ai/rewrite", p("ai:use"), limits.ai, platform.aiRewrite);
workspaceRoutes.post("/ai/channel-variant", p("ai:use"), limits.ai, platform.aiChannelVariant);
workspaceRoutes.post("/ai/quality-check", p("ai:use"), limits.ai, platform.aiQualityCheck);

workspaceRoutes.get("/api-keys", p("developer:manage"), platform.listApiKeys);
workspaceRoutes.post("/api-keys", p("developer:manage"), platform.createApiKey);
workspaceRoutes.delete("/api-keys/:id", p("developer:manage"), platform.revokeApiKey);
workspaceRoutes.get("/webhooks", p("developer:manage"), platform.listWebhooks);
workspaceRoutes.post("/webhooks", p("developer:manage"), platform.createWebhook);
workspaceRoutes.get("/webhooks/deliveries", p("developer:manage"), platform.listDeliveries);
workspaceRoutes.post("/webhooks/deliveries/:id/retry", p("developer:manage"), platform.retryDelivery);
workspaceRoutes.patch("/webhooks/:id", p("developer:manage"), platform.updateWebhook);
workspaceRoutes.delete("/webhooks/:id", p("developer:manage"), platform.removeWebhook);
workspaceRoutes.post("/webhooks/:id/rotate-secret", p("developer:manage"), platform.rotateWebhookSecret);
workspaceRoutes.post("/webhooks/:id/test", p("developer:manage"), platform.testWebhook);

workspaceRoutes.get("/integrations", p("workspace:read"), platform.listIntegrations);
workspaceRoutes.post("/integrations/:provider/connect", p("integrations:manage"), platform.connectIntegration);
workspaceRoutes.get("/integrations/:provider/targets", p("integrations:manage"), platform.integrationTargets);
workspaceRoutes.post("/integrations/:provider/disconnect", p("integrations:manage"), platform.disconnectIntegration);
workspaceRoutes.post("/integrations/:provider/sync", p("integrations:manage"), platform.syncIntegration);
workspaceRoutes.patch("/integrations/:provider", p("integrations:manage"), platform.updateIntegration);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } });
workspaceRoutes.post("/uploads", limits.upload, p("release:write"), upload.single("file"), platform.upload);
workspaceRoutes.post("/imports/preview", p("import:run"), platform.previewImport);
workspaceRoutes.post("/imports", p("import:run"), platform.runImport);
