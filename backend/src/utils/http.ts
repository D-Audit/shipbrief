import type { Request, Response } from "express";
import type { z } from "zod";
import type { SessionAuth } from "../types/express.js";
import type { TeamRole } from "../types/domain.js";
import { badRequest, unauthorized } from "./errors.js";

/**
 * The single response envelope used by every endpoint:
 *   { success: true, data, meta? }
 *   { success: false, error: { code, message, details? } }
 */
export function sendData<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function sendNoContent(res: Response) {
  res.status(204).end();
}

type Source = "body" | "query" | "params";

/** Parses one part of the request against a zod schema, or throws VALIDATION_ERROR. */
export function parse<S extends z.ZodType>(req: Request, source: Source, schema: S): z.infer<S> {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    throw badRequest(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "The request is invalid.",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}

/** The authenticated user + active workspace that every workspace service call runs as. */
export type Actor = {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceSlug: string;
  role: TeamRole;
};

export function actorOf(req: Request): Actor {
  const auth = req.auth;
  if (!auth || auth.kind !== "session" || !auth.workspace) throw unauthorized();
  return {
    userId: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    workspaceId: auth.workspace.id,
    workspaceSlug: auth.workspace.slug,
    role: auth.workspace.role,
  };
}

export function sessionOf(req: Request): SessionAuth {
  if (!req.auth || req.auth.kind !== "session") throw unauthorized();
  return req.auth;
}

export function clientIp(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function requestMeta(req: Request) {
  return { ipAddress: clientIp(req), userAgent: req.get("user-agent")?.slice(0, 400) ?? null };
}
