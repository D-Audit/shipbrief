import { Router } from "express";
import * as pub from "../controllers/public.controller.js";
import * as v1 from "../controllers/v1.controller.js";
import { limits } from "../middleware/rate-limit.js";
import { publicCors } from "../middleware/security.js";

/** Unauthenticated, public-safe endpoints: changelog pages, engagement, the embeddable widget, unsubscribe. */
export const publicRoutes = Router();
publicRoutes.use(publicCors);

publicRoutes.get("/workspaces/:workspace", limits.publicRead, pub.workspace);
publicRoutes.get("/workspaces/:workspace/releases", limits.publicRead, pub.listReleases);
publicRoutes.get("/workspaces/:workspace/rss.xml", limits.publicRead, pub.feed);
publicRoutes.get("/workspaces/:workspace/releases/:slug", limits.publicRead, pub.getRelease);
publicRoutes.get("/workspaces/:workspace/releases/:slug/engagement", limits.publicRead, pub.engagement);
publicRoutes.post("/workspaces/:workspace/releases/:slug/reaction", limits.publicWrite, pub.toggleReaction);
publicRoutes.get("/workspaces/:workspace/releases/:slug/comments", limits.publicRead, pub.listComments);
publicRoutes.post("/workspaces/:workspace/releases/:slug/comments", limits.publicWrite, pub.createComment);
publicRoutes.post("/workspaces/:workspace/releases/:slug/click", limits.publicRead, pub.recordClick);
publicRoutes.post("/workspaces/:workspace/views", limits.publicRead, pub.recordView);
publicRoutes.post("/workspaces/:workspace/feedback", limits.publicWrite, pub.submitFeedback);
publicRoutes.get("/workspaces/:workspace/roadmap", limits.publicRead, pub.roadmap);

publicRoutes.get("/widget/:key", limits.publicRead, pub.widgetConfig);
publicRoutes.get("/widget/:key/updates", limits.publicRead, pub.widgetUpdates);
publicRoutes.post("/widget/:key/updates/read-all", limits.publicRead, pub.widgetReadAll);
publicRoutes.post("/widget/:key/updates/:releaseId/read", limits.publicRead, pub.widgetRead);
publicRoutes.post("/widget/:key/updates/:releaseId/dismiss", limits.publicRead, pub.widgetDismiss);
publicRoutes.post("/widget/:key/updates/:releaseId/click", limits.publicRead, pub.widgetClick);
publicRoutes.post("/widget/:key/identify", limits.widgetIdentify, pub.widgetIdentify);
publicRoutes.post("/widget/:key/subscription", limits.publicWrite, pub.widgetSubscription);

publicRoutes.post("/workspaces/:workspace/subscribe", limits.subscribe, pub.subscribe);
publicRoutes.get("/subscribe/confirm", limits.publicWrite, pub.confirmSubscribe);
publicRoutes.get("/unsubscribe", limits.publicWrite, pub.unsubscribe);
publicRoutes.post("/unsubscribe", limits.publicWrite, pub.unsubscribe);

/** Public REST API, authenticated by API key. */
export const v1Routes = Router();
v1Routes.use(publicCors);
v1Routes.use(v1.apiKeyAuth, limits.apiKey);
v1Routes.get("/releases", v1.requireScope("releases:read"), v1.listReleases);
v1Routes.get("/releases/:id", v1.requireScope("releases:read"), v1.getRelease);
v1Routes.get("/feedback", v1.requireScope("feedback:read"), v1.listFeedback);
v1Routes.post("/feedback", v1.requireScope("feedback:write"), v1.createFeedback);
v1Routes.post("/contacts", v1.requireScope("contacts:write"), v1.upsertContactHandler);
