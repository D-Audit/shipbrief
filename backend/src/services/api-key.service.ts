import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { apiKeys, workspaces } from "../database/schema.js";
import type { ApiKeyAuth } from "../types/express.js";
import { API_KEY_SCOPES, type ApiKeyScope } from "../types/domain.js";
import { randomToken, sha256 } from "../utils/crypto.js";
import { notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";

const KEY_PREFIX = "sb_live_";

function toApiKeyDto(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: row.createdAt.toISOString(),
    lastUsed: row.lastUsedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
  };
}

export async function listApiKeys(actor: Actor) {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.workspaceId, actor.workspaceId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toApiKeyDto);
}

/** Returns the full secret exactly once. Only its SHA-256 digest is stored. */
export async function createApiKey(actor: Actor, input: { name: string; scopes?: ApiKeyScope[]; expiresInDays?: number }) {
  const secret = `${KEY_PREFIX}${randomToken(24)}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      workspaceId: actor.workspaceId,
      name: input.name.trim(),
      prefix: secret.slice(0, KEY_PREFIX.length + 4),
      keyHash: sha256(secret),
      scopes: input.scopes?.length ? input.scopes : [...API_KEY_SCOPES],
      createdBy: actor.userId,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null,
    })
    .returning();
  await recordActivity(db, { workspaceId: actor.workspaceId, type: "comment", message: `API key created for ${row!.name}`, link: "/app/api", actorUserId: actor.userId, actorName: actor.name });
  await audit({ action: "api_key.created", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "api_key", targetId: row!.id, metadata: { name: row!.name, scopes: row!.scopes } });
  return { ...toApiKeyDto(row!), secret };
}

export async function revokeApiKey(actor: Actor, id: string) {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.workspaceId, actor.workspaceId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id, name: apiKeys.name });
  if (!row) throw notFound("API_KEY_NOT_FOUND", "API key not found.");
  await recordActivity(db, { workspaceId: actor.workspaceId, type: "comment", message: `API key ${row.name} revoked`, link: "/app/api", actorUserId: actor.userId, actorName: actor.name });
  await audit({ action: "api_key.revoked", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "api_key", targetId: id });
  return { id };
}

export async function authenticateApiKey(secret: string): Promise<ApiKeyAuth | null> {
  if (!secret.startsWith(KEY_PREFIX) || secret.length > 100) return null;
  const [row] = await db
    .select({ id: apiKeys.id, scopes: apiKeys.scopes, workspaceId: workspaces.id, slug: workspaces.slug, name: workspaces.name, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .innerJoin(workspaces, eq(workspaces.id, apiKeys.workspaceId))
    .where(
      and(
        eq(apiKeys.keyHash, sha256(secret)),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  // Throttled write: "last used" is accurate to the minute without a write per request.
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiKeys.id, row.id), or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, sql`now() - interval '1 minute'`))));
  return {
    kind: "api_key",
    apiKeyId: row.id,
    workspace: { id: row.workspaceId, slug: row.slug, name: row.name },
    scopes: row.scopes as ApiKeyScope[],
  };
}
