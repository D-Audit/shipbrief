import crypto from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config/env.js";
import * as campaigns from "../services/campaign.service.js";
import * as changelog from "../services/changelog.service.js";
import * as contactsService from "../services/contact.service.js";
import * as rss from "../services/rss.service.js";
import * as inApp from "../services/in-app.service.js";
import { parse, sendData } from "../utils/http.js";
import {
  publicCommentSchema,
  publicFeedbackSchema,
  publicListQuery,
  releaseParam,
  subscribeConfirmQuery,
  subscribeSchema,
  unsubscribeQuery,
  viewSchema,
  widgetIdentifySchema,
  widgetListQuery,
  widgetParam,
  widgetReleaseParam,
  widgetSubscriptionSchema,
  workspaceParam,
} from "../validators/public.js";

const VISITOR_COOKIE = "sb_vid";
const VISITOR_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Anonymous visitor identity for reactions, read state and unique counts.
 * Embedded widgets send X-Visitor-Id (third-party cookies are unreliable);
 * first-party pages get an httpOnly cookie.
 */
function visitorId(req: Request, res: Response) {
  const header = req.get("x-visitor-id");
  if (header && VISITOR_PATTERN.test(header)) return header;
  const cookie: unknown = req.cookies?.[VISITOR_COOKIE];
  if (typeof cookie === "string" && VISITOR_PATTERN.test(cookie)) return cookie;
  const id = crypto.randomBytes(16).toString("base64url");
  res.cookie(VISITOR_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: config.isProduction, maxAge: 365 * 24 * 60 * 60 * 1000, path: "/" });
  return id;
}

function existingVisitor(req: Request) {
  const header = req.get("x-visitor-id");
  if (header && VISITOR_PATTERN.test(header)) return header;
  const cookie: unknown = req.cookies?.[VISITOR_COOKIE];
  return typeof cookie === "string" && VISITOR_PATTERN.test(cookie) ? cookie : null;
}

// Public changelog -------------------------------------------------------------

export async function workspace(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  res.setHeader("Cache-Control", "public, max-age=60");
  sendData(res, await changelog.getPublicWorkspace(workspace));
}

export async function listReleases(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  const query = parse(req, "query", publicListQuery);
  const { items, total } = await changelog.listPublicReleases(workspace, query);
  res.setHeader("Cache-Control", "public, max-age=30");
  sendData(res, items, 200, { page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total });
}

/** RSS 2.0 feed of the public changelog (same releases, same visibility rule). Express adds an ETag for conditional GETs. */
export async function feed(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  const xml = await rss.buildChangelogFeed(workspace);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("application/rss+xml; charset=utf-8").send(xml);
}

export async function getRelease(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  res.setHeader("Cache-Control", "public, max-age=30");
  sendData(res, await changelog.getPublicRelease(workspace, slug));
}

export async function recordView(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  const { slug } = parse(req, "body", viewSchema);
  await changelog.recordPublicView(workspace, slug ?? null, visitorId(req, res));
  res.status(204).end();
}

export async function recordClick(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  await changelog.recordCtaClick(workspace, slug, visitorId(req, res));
  res.status(204).end();
}

export async function engagement(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  sendData(res, await changelog.getEngagement(workspace, slug, existingVisitor(req)));
}

export async function toggleReaction(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  sendData(res, await changelog.toggleReaction(workspace, slug, visitorId(req, res)));
}

export async function listComments(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  sendData(res, await changelog.listPublicComments(workspace, slug));
}

export async function createComment(req: Request, res: Response) {
  const { workspace, slug } = parse(req, "params", releaseParam);
  const body = parse(req, "body", publicCommentSchema);
  sendData(res, await changelog.createPublicComment(workspace, slug, body, visitorId(req, res)), 201);
}

export async function submitFeedback(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  const { website: _honeypot, ...body } = parse(req, "body", publicFeedbackSchema);
  sendData(res, await changelog.submitPublicFeedback(workspace, body, visitorId(req, res)), 201);
}

export async function roadmap(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  res.setHeader("Cache-Control", "public, max-age=60");
  sendData(res, await changelog.listPublicRoadmap(workspace));
}

// In-app widget ----------------------------------------------------------------

const WIDGET_SESSION_HEADER = "x-widget-session";

/** Identified users (signed widget session) keep one read state everywhere; everyone else is an anonymous visitor. */
function widgetVisitor(req: Request, res: Response, key: string) {
  return inApp.readWidgetSession(key, req.get(WIDGET_SESSION_HEADER))?.visitorId ?? visitorId(req, res);
}

function existingWidgetVisitor(req: Request, key: string) {
  return inApp.readWidgetSession(key, req.get(WIDGET_SESSION_HEADER))?.visitorId ?? existingVisitor(req);
}

export async function widgetIdentify(req: Request, res: Response) {
  const { key } = parse(req, "params", widgetParam);
  const body = parse(req, "body", widgetIdentifySchema);
  res.setHeader("Cache-Control", "no-store");
  sendData(res, await inApp.identifyWidgetUser(key, body, existingVisitor(req)));
}

export async function widgetSubscription(req: Request, res: Response) {
  const { key } = parse(req, "params", widgetParam);
  const { subscribed } = parse(req, "body", widgetSubscriptionSchema);
  sendData(res, await inApp.setWidgetSubscription(key, req.get(WIDGET_SESSION_HEADER), subscribed));
}

export async function widgetConfig(req: Request, res: Response) {
  const { key } = parse(req, "params", widgetParam);
  res.setHeader("Cache-Control", "public, max-age=60");
  sendData(res, await inApp.getWidgetConfig(key));
}

export async function widgetUpdates(req: Request, res: Response) {
  const { key } = parse(req, "params", widgetParam);
  const { limit } = parse(req, "query", widgetListQuery);
  sendData(res, await inApp.listWidgetUpdates(key, existingWidgetVisitor(req, key), limit));
}

export async function widgetRead(req: Request, res: Response) {
  const { key, releaseId } = parse(req, "params", widgetReleaseParam);
  sendData(res, await inApp.markWidgetUpdateRead(key, releaseId, widgetVisitor(req, res, key)));
}

export async function widgetReadAll(req: Request, res: Response) {
  const { key } = parse(req, "params", widgetParam);
  sendData(res, await inApp.markAllWidgetUpdatesRead(key, widgetVisitor(req, res, key)));
}

export async function widgetDismiss(req: Request, res: Response) {
  const { key, releaseId } = parse(req, "params", widgetReleaseParam);
  sendData(res, await inApp.dismissWidgetUpdate(key, releaseId, widgetVisitor(req, res, key)));
}

export async function widgetClick(req: Request, res: Response) {
  const { key, releaseId } = parse(req, "params", widgetReleaseParam);
  sendData(res, await inApp.recordWidgetClick(key, releaseId, widgetVisitor(req, res, key)));
}

// Subscribe to updates (double opt-in) -------------------------------------------

export async function subscribe(req: Request, res: Response) {
  const { workspace } = parse(req, "params", workspaceParam);
  const { email, source } = parse(req, "body", subscribeSchema);
  sendData(res, await contactsService.requestSubscription(workspace, email, source), 202);
}

/** The link in the confirmation email: subscribes, then returns the person to the changelog with a thank-you. */
export async function confirmSubscribe(req: Request, res: Response) {
  const { token } = parse(req, "query", subscribeConfirmQuery);
  const confirmed = await contactsService.confirmSubscription(token);
  if (confirmed) return res.redirect(303, `${confirmed.changelogUrl}?subscribed=1`);
  res
    .status(400)
    .type("html")
    .send(`<!doctype html><meta charset="utf-8"><title>Subscription link expired</title><p>This subscription link is invalid or has expired. Subscribe again from the changelog page.</p>`);
}

// Email unsubscribe (link and RFC 8058 one-click POST) ---------------------------

export async function unsubscribe(req: Request, res: Response) {
  const { c, t } = parse(req, "query", unsubscribeQuery);
  const ok = await campaigns.unsubscribe(c, t);
  if (req.method === "POST") return res.status(ok ? 204 : 400).end();
  res
    .status(ok ? 200 : 400)
    .type("html")
    .send(`<!doctype html><meta charset="utf-8"><title>Unsubscribe</title><p>${ok ? "You've been unsubscribed from product update emails." : "This unsubscribe link is invalid."}</p>`);
}
