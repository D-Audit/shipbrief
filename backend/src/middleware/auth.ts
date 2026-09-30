import type { NextFunction, Request, Response } from "express";
import { can, type Permission } from "../services/permissions.js";
import { resolveSession, SESSION_COOKIE, sessionCookieOptions } from "../services/session.service.js";
import { forbidden, unauthorized } from "../utils/errors.js";

/**
 * Attaches `req.auth` when a valid session cookie is present. Never rejects on
 * its own — `requireAuth`/`requireWorkspace`/`requirePermission` decide that —
 * so public routes can still see who is signed in.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token.length > 20 && token.length < 200) {
    const auth = await resolveSession(token);
    if (auth) {
      req.auth = auth;
    } else {
      // Expired or revoked: clear the stale cookie so the browser stops sending it.
      const { maxAge: _maxAge, ...options } = sessionCookieOptions();
      res.clearCookie(SESSION_COOKIE, options);
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.kind !== "session") return next(unauthorized());
  next();
}

export function requireWorkspace(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.kind !== "session") return next(unauthorized());
  if (!req.auth.workspace) return next(forbidden("Create or join a workspace first.", "WORKSPACE_REQUIRED"));
  next();
}

/** Route guard: requires a session, an active workspace, and a role that grants `permission`. */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.kind !== "session") return next(unauthorized());
    if (!req.auth.workspace) return next(forbidden("Create or join a workspace first.", "WORKSPACE_REQUIRED"));
    if (!can(req.auth.workspace.role, permission)) {
      return next(forbidden("Your role doesn't allow this action. Ask a workspace admin for access."));
    }
    next();
  };
}
