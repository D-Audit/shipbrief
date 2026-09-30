import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { config } from "../config/env.js";
import { db } from "../database/client.js";
import { memberships, sessions, users, workspaces } from "../database/schema.js";
import type { SessionAuth } from "../types/express.js";
import { randomToken, sha256 } from "../utils/crypto.js";

export const SESSION_COOKIE = "sb_session";
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(input: { userId: string; ipAddress?: string | null; userAgent?: string | null }) {
  const token = randomToken(32);
  const [firstMembership] = await db
    .select({ workspaceId: memberships.workspaceId })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, input.userId), isNull(workspaces.deletedAt)))
    .orderBy(asc(memberships.createdAt))
    .limit(1);

  const [session] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: sha256(token),
      workspaceId: firstMembership?.workspaceId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: sessions.id });
  return { token, sessionId: session!.id };
}

/**
 * Resolves a raw cookie token to the signed-in user and their active
 * workspace + role. Returns null for unknown, expired or revoked sessions.
 */
export async function resolveSession(token: string): Promise<SessionAuth | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      workspaceId: sessions.workspaceId,
      userId: users.id,
      name: users.name,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  let workspace = row.workspaceId ? await loadMembership(row.userId, row.workspaceId) : undefined;
  if (!workspace) {
    // The active workspace was removed (or the user was removed from it): fall back to another membership.
    workspace = await firstMembership(row.userId);
    await db.update(sessions).set({ workspaceId: workspace?.id ?? null }).where(eq(sessions.id, row.sessionId));
  }

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));
  }

  return {
    kind: "session",
    sessionId: row.sessionId,
    user: { id: row.userId, name: row.name, email: row.email, emailVerified: Boolean(row.emailVerifiedAt) },
    workspace,
  };
}

async function loadMembership(userId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId), isNull(workspaces.deletedAt)))
    .limit(1);
  return row;
}

async function firstMembership(userId: string) {
  const [row] = await db
    .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), isNull(workspaces.deletedAt)))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  return row;
}

export async function setActiveWorkspace(sessionId: string, userId: string, workspaceId: string) {
  const membership = await loadMembership(userId, workspaceId);
  if (!membership) return null;
  await db.update(sessions).set({ workspaceId }).where(eq(sessions.id, sessionId));
  return membership;
}

export async function revokeSession(sessionId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

/** Signs a user out everywhere (optionally keeping the current session), e.g. after a password change. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    );
}

export async function listSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(asc(sessions.createdAt));
}

export async function revokeOwnSession(userId: string, sessionId: string) {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return result.length > 0;
}
