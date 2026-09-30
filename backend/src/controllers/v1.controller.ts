import type { NextFunction, Request, Response } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { feedback, releases } from "../database/schema.js";
import { authenticateApiKey } from "../services/api-key.service.js";
import { upsertContact } from "../services/audience.service.js";
import { emitEvent, track } from "../services/events.service.js";
import { toFeedbackDto } from "../services/feedback.service.js";
import type { ApiKeyAuth } from "../types/express.js";
import type { ApiKeyScope } from "../types/domain.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";
import { parse, sendData } from "../utils/http.js";
import { uuidParam } from "../validators/common.js";
import { contactSchema } from "../validators/public.js";
import { createFeedbackSchema, listFeedbackQuery } from "../validators/workspace.js";
import { listReleasesQuery } from "../validators/releases.js";

/**
 * Public REST API (v1), authenticated with `Authorization: Bearer sb_live_…`.
 * Cookies are ignored here, so it is safe to call cross-origin.
 */
export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return next(unauthorized("Provide an API key as a Bearer token.", "API_KEY_REQUIRED"));
  const auth = await authenticateApiKey(token.trim());
  if (!auth) return next(unauthorized("That API key is invalid, expired or revoked.", "INVALID_API_KEY"));
  req.auth = auth;
  next();
}

export function requireScope(scope: ApiKeyScope) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth as ApiKeyAuth | undefined;
    if (!auth || auth.kind !== "api_key") return next(unauthorized());
    if (!auth.scopes.includes(scope)) return next(forbidden(`This API key is missing the ${scope} scope.`, "INSUFFICIENT_SCOPE"));
    next();
  };
}

const keyAuth = (req: Request) => req.auth as ApiKeyAuth;

function publicRelease(row: typeof releases.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    status: row.status,
    channels: row.channels,
    category: row.category,
    tags: row.tags,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReleases(req: Request, res: Response) {
  const query = parse(req, "query", listReleasesQuery);
  const where = and(eq(releases.workspaceId, keyAuth(req).workspace.id), isNull(releases.deletedAt), query.status ? eq(releases.status, query.status) : undefined);
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db.select().from(releases).where(where).orderBy(desc(releases.updatedAt)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(releases).where(where),
  ]);
  sendData(res, rows.map(publicRelease), 200, { page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total });
}

export async function getRelease(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const [row] = await db.select().from(releases).where(and(eq(releases.id, id), eq(releases.workspaceId, keyAuth(req).workspace.id), isNull(releases.deletedAt))).limit(1);
  if (!row) throw notFound("RELEASE_NOT_FOUND", "Release not found.");
  sendData(res, publicRelease(row));
}

export async function listFeedback(req: Request, res: Response) {
  const query = parse(req, "query", listFeedbackQuery);
  const where = and(eq(feedback.workspaceId, keyAuth(req).workspace.id), isNull(feedback.deletedAt), isNull(feedback.mergedIntoId), query.status ? eq(feedback.status, query.status) : undefined);
  const rows = await db.select().from(feedback).where(where).orderBy(desc(feedback.votes)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
  sendData(res, rows.map((row) => { const { internalNotes: _notes, ...dto } = toFeedbackDto(row); return dto; }));
}

export async function createFeedback(req: Request, res: Response) {
  const body = parse(req, "body", createFeedbackSchema);
  const workspaceId = keyAuth(req).workspace.id;
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(feedback)
      .values({ workspaceId, title: body.title, description: body.description, tags: body.tags ?? [], priority: body.priority ?? "medium", source: body.source ?? "customer", votes: 1 })
      .returning();
    await track(tx, { workspaceId, type: "feedback.submitted", channel: "api" });
    await emitEvent(tx, { workspaceId, event: "feedback.created", data: { id: row!.id, title: row!.title, source: row!.source } });
    return row!;
  });
  const { internalNotes: _notes, ...dto } = toFeedbackDto(created);
  sendData(res, dto, 201);
}

/** Identify/update an end user so audiences and email campaigns can target them. */
export async function upsertContactHandler(req: Request, res: Response) {
  const body = parse(req, "body", contactSchema);
  const contact = await upsertContact(keyAuth(req).workspace.id, body);
  sendData(res, { id: contact.id, externalId: contact.externalId, email: contact.email, name: contact.name, plan: contact.plan, tags: contact.tags, unsubscribed: Boolean(contact.unsubscribedAt) });
}
