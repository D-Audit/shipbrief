import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";
import { SESSION_COOKIE } from "../services/session.service.js";
import { forbidden } from "../utils/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated requests. The session cookie is
 * SameSite=Lax, and in addition every state-changing request that carries it
 * must come from a trusted origin (Origin header, falling back to Referer).
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || !req.cookies?.[SESSION_COOKIE]) return next();

  const origin = req.get("origin") ?? refererOrigin(req.get("referer"));
  if (origin && config.trustedOrigins.includes(origin)) return next();
  next(forbidden("This request did not come from a trusted origin.", "CSRF_REJECTED"));
}

function refererOrigin(referer: string | undefined) {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** Accepts a well-formed incoming X-Request-Id (for tracing through proxies) or generates one. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  req.id = incoming && /^[A-Za-z0-9._-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

/** Public, embeddable endpoints (widget, public API) may be called from any site, without cookies. */
export function publicCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Visitor-Id,X-Widget-Session");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}
