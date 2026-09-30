import { Router } from "express";
import * as controller from "../controllers/release.controller.js";
import { requirePermission } from "../middleware/auth.js";

export const releaseRoutes = Router();

releaseRoutes.get("/", requirePermission("release:read"), controller.list);
releaseRoutes.get("/counts", requirePermission("release:read"), controller.counts);
releaseRoutes.post("/", requirePermission("release:write"), controller.create);
releaseRoutes.get("/:id", requirePermission("release:read"), controller.get);
releaseRoutes.patch("/:id", requirePermission("release:write"), controller.update);
releaseRoutes.delete("/:id", requirePermission("release:delete"), controller.remove);
releaseRoutes.post("/:id/duplicate", requirePermission("release:write"), controller.duplicate);

releaseRoutes.post("/:id/submit", requirePermission("release:submit"), controller.submit);
releaseRoutes.post("/:id/approve", requirePermission("release:approve"), controller.approve);
releaseRoutes.post("/:id/request-changes", requirePermission("release:approve"), controller.requestChanges);
releaseRoutes.post("/:id/schedule", requirePermission("release:schedule"), controller.schedule);
releaseRoutes.post("/:id/unschedule", requirePermission("release:schedule"), controller.unschedule);
releaseRoutes.post("/:id/publish", requirePermission("release:publish"), controller.publish);
releaseRoutes.post("/:id/archive", requirePermission("release:archive"), controller.archive);

releaseRoutes.get("/:id/versions", requirePermission("release:read"), controller.versions);
releaseRoutes.post("/:id/versions/:versionId/restore", requirePermission("release:write"), controller.restoreVersion);
