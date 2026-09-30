import { and, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../../database/client.js";
import { authTokens, jobs, oauthStates, rateLimits, sessions } from "../../database/schema.js";

/** Deletes expired, no-longer-useful rows so hot tables stay small. */
export async function cleanup() {
  const now = new Date();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await db.delete(rateLimits).where(lt(rateLimits.windowStart, dayAgo));
  await db.delete(oauthStates).where(lt(oauthStates.expiresAt, now));
  await db.delete(authTokens).where(or(lt(authTokens.expiresAt, weekAgo), and(sql`${authTokens.usedAt} is not null`, lt(authTokens.createdAt, weekAgo))));
  await db.delete(sessions).where(or(lt(sessions.expiresAt, now), lt(sessions.revokedAt, weekAgo)));
  await db.delete(jobs).where(and(inArray(jobs.status, ["succeeded"]), lt(jobs.updatedAt, weekAgo)));
  await db.delete(jobs).where(and(inArray(jobs.status, ["dead", "failed"]), lt(jobs.updatedAt, monthAgo)));
}
