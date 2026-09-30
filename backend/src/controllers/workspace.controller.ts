import type { Request, Response } from "express";
import * as activity from "../services/activity.service.js";
import * as analytics from "../services/analytics.service.js";
import { listAuditLogs } from "../services/audit.service.js";
import * as audiences from "../services/audience.service.js";
import * as billing from "../services/billing.service.js";
import * as campaigns from "../services/campaign.service.js";
import * as changelog from "../services/changelog.service.js";
import { exportWorkspace } from "../services/export.service.js";
import * as feedback from "../services/feedback.service.js";
import * as overview from "../services/overview.service.js";
import * as roadmap from "../services/roadmap.service.js";
import * as team from "../services/team.service.js";
import * as workspace from "../services/workspace.service.js";
import { actorOf, parse, sendData } from "../utils/http.js";
import { uuidParam } from "../validators/common.js";
import {
  activityQuery,
  audienceRulesSchema,
  brandingSchema,
  byReleaseQuery,
  checkoutSchema,
  commentParams,
  commentSchema,
  createAudienceSchema,
  createCampaignSchema,
  createFeedbackSchema,
  createRoadmapSchema,
  deleteWorkspaceSchema,
  fromClusterSchema,
  inviteSchema,
  listFeedbackQuery,
  mergeSchema,
  rangeQuery,
  reorderRoadmapSchema,
  roleSchema,
  settingsSchema,
  transferSchema,
  updateCampaignSchema,
  updateFeedbackSchema,
  updateRoadmapSchema,
  widgetSettingsSchema,
} from "../validators/workspace.js";
import { z } from "zod";
import { RELEASE_STATUSES } from "../types/domain.js";

// Overview, analytics, activity ------------------------------------------------

export const getOverview = async (req: Request, res: Response) => sendData(res, await overview.getOverview(actorOf(req)));

export async function getAnalytics(req: Request, res: Response) {
  const { range } = parse(req, "query", rangeQuery);
  sendData(res, await analytics.getOverview(actorOf(req), range));
}

export async function exportAnalytics(req: Request, res: Response) {
  const { range } = parse(req, "query", rangeQuery);
  const { filename, csv } = await analytics.exportCsv(actorOf(req), range);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function listActivity(req: Request, res: Response) {
  const query = parse(req, "query", activityQuery);
  sendData(res, await activity.listActivity(actorOf(req), query));
}

export async function markActivityRead(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await activity.markActivityRead(actorOf(req), id));
}

export const markAllActivityRead = async (req: Request, res: Response) => sendData(res, await activity.markAllActivityRead(actorOf(req)));

export async function listAudit(req: Request, res: Response) {
  const { limit } = parse(req, "query", z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }));
  sendData(res, await listAuditLogs(actorOf(req).workspaceId, limit));
}

// Changelog manager ------------------------------------------------------------

const changelogQuery = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(40).optional(),
  status: z.enum(RELEASE_STATUSES).optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(["newest", "oldest", "most_engaged", "most_discussed"]).default("newest"),
});

export async function listChangelog(req: Request, res: Response) {
  sendData(res, await changelog.listChangelogEntries(actorOf(req), parse(req, "query", changelogQuery)));
}

export const changelogFilters = async (req: Request, res: Response) => sendData(res, await changelog.changelogFilterOptions(actorOf(req)));

export async function hideComment(req: Request, res: Response) {
  const { id, commentId } = parse(req, "params", commentParams);
  sendData(res, await changelog.hideComment(actorOf(req), id, commentId));
}

// Feedback ---------------------------------------------------------------------

export async function listFeedback(req: Request, res: Response) {
  const query = parse(req, "query", listFeedbackQuery);
  const { items, total } = await feedback.listFeedback(actorOf(req), query);
  sendData(res, items, 200, { page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total });
}

export async function getFeedback(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await feedback.getFeedback(actorOf(req), id));
}

export async function createFeedback(req: Request, res: Response) {
  sendData(res, await feedback.createFeedback(actorOf(req), parse(req, "body", createFeedbackSchema)), 201);
}

export async function updateFeedback(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await feedback.updateFeedback(actorOf(req), id, parse(req, "body", updateFeedbackSchema)));
}

export async function voteFeedback(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await feedback.voteFeedback(actorOf(req), id));
}

export async function listFeedbackComments(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await feedback.listComments(actorOf(req), id));
}

export async function addFeedbackComment(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await feedback.addComment(actorOf(req), id, parse(req, "body", commentSchema)), 201);
}

export async function mergeFeedback(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const { targetId } = parse(req, "body", mergeSchema);
  sendData(res, await feedback.mergeFeedback(actorOf(req), id, targetId));
}

export const listClusters = async (req: Request, res: Response) => sendData(res, await feedback.listClusters(actorOf(req)));

// Roadmap ----------------------------------------------------------------------

export const listRoadmap = async (req: Request, res: Response) => sendData(res, await roadmap.listRoadmap(actorOf(req)));

export async function getRoadmapItem(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await roadmap.getRoadmapItem(actorOf(req), id));
}

export async function createRoadmapItem(req: Request, res: Response) {
  sendData(res, await roadmap.createRoadmapItem(actorOf(req), parse(req, "body", createRoadmapSchema)), 201);
}

export async function updateRoadmapItem(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await roadmap.updateRoadmapItem(actorOf(req), id, parse(req, "body", updateRoadmapSchema)));
}

export async function deleteRoadmapItem(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await roadmap.deleteRoadmapItem(actorOf(req), id));
}

export async function reorderRoadmap(req: Request, res: Response) {
  const { status, ids } = parse(req, "body", reorderRoadmapSchema);
  sendData(res, await roadmap.reorderRoadmap(actorOf(req), status, ids));
}

export async function roadmapFromCluster(req: Request, res: Response) {
  const { clusterId } = parse(req, "body", fromClusterSchema);
  sendData(res, await roadmap.createFromCluster(actorOf(req), clusterId), 201);
}

// Campaigns & audiences --------------------------------------------------------

export const listCampaigns = async (req: Request, res: Response) => sendData(res, await campaigns.listCampaigns(actorOf(req)));

export async function campaignByRelease(req: Request, res: Response) {
  const { releaseId } = parse(req, "query", byReleaseQuery);
  sendData(res, await campaigns.getCampaignByRelease(actorOf(req), releaseId));
}

export async function createCampaign(req: Request, res: Response) {
  sendData(res, await campaigns.createCampaign(actorOf(req), parse(req, "body", createCampaignSchema)), 201);
}

export async function updateCampaign(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await campaigns.updateCampaign(actorOf(req), id, parse(req, "body", updateCampaignSchema)));
}

export const listAudiences = async (req: Request, res: Response) => sendData(res, await audiences.listAudiences(actorOf(req)));

export async function getAudience(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await audiences.getAudience(actorOf(req), id));
}

export async function previewAudience(req: Request, res: Response) {
  sendData(res, await audiences.previewAudience(actorOf(req), parse(req, "body", audienceRulesSchema)));
}

export async function createAudience(req: Request, res: Response) {
  sendData(res, await audiences.createAudience(actorOf(req), parse(req, "body", createAudienceSchema)), 201);
}

// Team -------------------------------------------------------------------------

export const listTeam = async (req: Request, res: Response) => sendData(res, await team.listTeam(actorOf(req)));

export async function invite(req: Request, res: Response) {
  sendData(res, await team.inviteMember(actorOf(req), parse(req, "body", inviteSchema)), 201);
}

export async function updateRole(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const { role } = parse(req, "body", roleSchema);
  sendData(res, await team.updateRole(actorOf(req), id, role));
}

export async function removeMember(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  sendData(res, await team.removeMember(actorOf(req), id));
}

export async function transferOwnership(req: Request, res: Response) {
  const { membershipId } = parse(req, "body", transferSchema);
  sendData(res, await team.transferOwnership(actorOf(req), membershipId));
}

// Settings, branding, widget, billing ------------------------------------------

export const getSettings = async (req: Request, res: Response) => sendData(res, await workspace.getSettings(actorOf(req)));
export const updateSettings = async (req: Request, res: Response) => sendData(res, await workspace.updateSettings(actorOf(req), parse(req, "body", settingsSchema)));
export const getBranding = async (req: Request, res: Response) => sendData(res, await workspace.getBranding(actorOf(req)));
export const updateBranding = async (req: Request, res: Response) => sendData(res, await workspace.updateBranding(actorOf(req), parse(req, "body", brandingSchema)));
export const getWidget = async (req: Request, res: Response) => sendData(res, await workspace.getWidgetSettings(actorOf(req)));
export const updateWidget = async (req: Request, res: Response) => sendData(res, await workspace.updateWidgetSettings(actorOf(req), parse(req, "body", widgetSettingsSchema)));

export async function deleteWorkspace(req: Request, res: Response) {
  const { confirmation } = parse(req, "body", deleteWorkspaceSchema);
  sendData(res, await workspace.deleteWorkspace(actorOf(req), confirmation));
}

export async function exportData(req: Request, res: Response) {
  const { filename, data } = await exportWorkspace(actorOf(req));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
}

export const getBilling = async (req: Request, res: Response) => sendData(res, await billing.getBilling(actorOf(req)));

export async function checkout(req: Request, res: Response) {
  const { plan } = parse(req, "body", checkoutSchema);
  sendData(res, await billing.createCheckout(actorOf(req), plan));
}

export const portal = async (req: Request, res: Response) => sendData(res, await billing.createPortal(actorOf(req)));

export async function stripeWebhook(req: Request, res: Response) {
  sendData(res, await billing.handleStripeWebhook(req.body as Buffer, req.get("stripe-signature")));
}
