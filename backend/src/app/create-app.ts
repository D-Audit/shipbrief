import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { authenticate } from "../middleware/auth.js";
import { errorHandler, notFoundHandler } from "../middleware/error-handler.js";
import { originCheck, requestId } from "../middleware/security.js";
import { apiRoutes } from "../routes/index.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);
  // Query strings are parsed shallowly: no nested objects, so `?a[b]=c` can't smuggle structures past validation.
  app.set("query parser", "simple");

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url.split("?")[0] }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      // JSON API: no documents are rendered, so lock the CSP down completely.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Stripe signs the raw request body, so its webhook route must see unparsed bytes.
  app.use("/api/billing/webhook", express.raw({ type: "application/json", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(authenticate);
  app.use(originCheck);

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
