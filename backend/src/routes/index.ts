import { Router } from "express";
import { sql } from "drizzle-orm";
import * as platform from "../controllers/platform.controller.js";
import * as ws from "../controllers/workspace.controller.js";
import { db } from "../database/client.js";
import { buildOpenApi } from "../docs/openapi.js";
import { limits } from "../middleware/rate-limit.js";
import { authRoutes } from "./auth.routes.js";
import { publicRoutes, v1Routes } from "./public.routes.js";
import { releaseRoutes } from "./release.routes.js";
import { workspaceRoutes } from "./workspace.routes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ success: true, data: { status: "ok" } });
});

const openApiDocument = buildOpenApi();
apiRoutes.get("/docs/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/public", publicRoutes);
apiRoutes.use("/v1", v1Routes);

// Unauthenticated callbacks and assets.
apiRoutes.post("/billing/webhook", limits.inboundWebhook, ws.stripeWebhook);
apiRoutes.get("/integrations/:provider/callback", platform.integrationCallback);
apiRoutes.get("/files/:workspace/:purpose/:name", platform.serveFile);

// Session-authenticated workspace API.
apiRoutes.use(limits.api);
apiRoutes.use("/releases", releaseRoutes);
apiRoutes.use(workspaceRoutes);
