import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../database/client.js";
import { oauthStates } from "../database/schema.js";
import { randomToken, sha256 } from "../utils/crypto.js";

/**
 * One-time state for OAuth redirects: CSRF protection (`state`) plus a PKCE
 * verifier. Stored hashed, bound to the initiating user/workspace, valid for
 * 10 minutes and deleted on first use.
 */
export async function createOAuthState(input: {
  purpose: "login" | "integration";
  provider: string;
  userId?: string | null;
  workspaceId?: string | null;
  data?: Record<string, unknown>;
}) {
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  await db.insert(oauthStates).values({
    stateHash: sha256(state),
    purpose: input.purpose,
    provider: input.provider,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    codeVerifier,
    data: input.data ?? {},
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export async function consumeOAuthState(state: string, purpose: "login" | "integration", provider: string) {
  const [row] = await db
    .delete(oauthStates)
    .where(
      and(
        eq(oauthStates.stateHash, sha256(state)),
        eq(oauthStates.purpose, purpose),
        eq(oauthStates.provider, provider),
        gt(oauthStates.expiresAt, new Date()),
      ),
    )
    .returning();
  return row ?? null;
}
