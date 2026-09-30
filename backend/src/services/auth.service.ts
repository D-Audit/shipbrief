import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db, type DbExecutor } from "../database/client.js";
import { authTokens, invitations, memberships, oauthAccounts, sessions, users } from "../database/schema.js";
import { passwordChangedTemplate, resetPasswordTemplate, verifyEmailTemplate, welcomeTemplate } from "../integrations/email/templates.js";
import { consumeOAuthState, createOAuthState } from "../integrations/oauth-state.js";
import type { SessionAuth } from "../types/express.js";
import type { Channel } from "../types/domain.js";
import { getDummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from "../utils/crypto.js";
import { AppError, badRequest, conflict, forbidden, isUniqueViolation, notConfigured, unauthorized } from "../utils/errors.js";
import { audit } from "./audit.service.js";
import { sendTransactionalEmail } from "./email.service.js";
import { permissionsFor } from "./permissions.js";
import { createSession, revokeAllSessions, setActiveWorkspace } from "./session.service.js";
import { createWorkspace, listUserWorkspaces } from "./workspace.service.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const INVALID_CREDENTIALS = "That email or password doesn't look right. Check both and try again.";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123",
  "11111111", "iloveyou", "letmein1", "welcome1", "admin123", "abc12345", "shipbrief",
]);

export function validatePasswordStrength(password: string) {
  if (password.trim().length < 8) throw badRequest("WEAK_PASSWORD", "Use at least 8 characters for your password.");
  if (password.length > 200) throw badRequest("WEAK_PASSWORD", "Use 200 characters or fewer for your password.");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw badRequest("WEAK_PASSWORD", "That password is too common. Choose something harder to guess.");
  }
}

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

// ---------------------------------------------------------------------------
// Registration, login, logout
// ---------------------------------------------------------------------------

export async function register(input: { name: string; email: string; password: string }, meta: RequestMeta) {
  validatePasswordStrength(input.password);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  let userId: string;
  try {
    const [user] = await db.insert(users).values({ email, name: input.name.trim(), passwordHash }).returning({ id: users.id });
    userId = user!.id;
  } catch (error) {
    if (isUniqueViolation(error, "users_email_key")) {
      throw conflict("EMAIL_TAKEN", "There's already an account with this email. Sign in instead, or use a different address.");
    }
    throw error;
  }

  await audit({ action: "auth.registered", userId, ...meta });
  await sendVerificationEmail(userId);
  const session = await createSession({ userId, ...meta });
  return { token: session.token, email, sentAt: new Date().toISOString() };
}

export async function login(input: { email: string; password: string }, meta: RequestMeta) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, emailVerifiedAt: users.emailVerifiedAt, email: users.email })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);

  // Always run one scrypt comparison so response time doesn't reveal whether the account exists.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyPasswordHash()));
  if (!user || !user.passwordHash || !valid) {
    await audit({ action: "auth.login_failed", userId: user?.id ?? null, ...meta, metadata: { email } });
    throw new AppError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
  }

  if (user.emailVerifiedAt) await acceptPendingInvitations(db, user.id, user.email);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const session = await createSession({ userId: user.id, ...meta });
  await audit({ action: "auth.login", userId: user.id, ...meta });
  return { token: session.token };
}

// ---------------------------------------------------------------------------
// Session payload returned to the web app
// ---------------------------------------------------------------------------

export async function describeSession(auth: SessionAuth) {
  // Invitations sent to an already-verified user are picked up on their next app load.
  if (auth.user.emailVerified && (await acceptPendingInvitations(db, auth.user.id, auth.user.email)) > 0 && !auth.workspace) {
    auth = { ...auth, workspace: await firstWorkspaceFor(auth) };
  }
  const workspaces = await listUserWorkspaces(auth.user.id);
  return {
    user: { id: auth.user.id, name: auth.user.name, email: auth.user.email },
    emailVerified: auth.user.emailVerified,
    needsOnboarding: !auth.workspace,
    workspace: auth.workspace ?? null,
    permissions: auth.workspace ? permissionsFor(auth.workspace.role) : [],
    workspaces,
  };
}

async function firstWorkspaceFor(auth: SessionAuth) {
  const [first] = await listUserWorkspaces(auth.user.id);
  return first ? (await setActiveWorkspace(auth.sessionId, auth.user.id, first.id)) ?? undefined : undefined;
}

export async function switchWorkspace(auth: SessionAuth, workspaceId: string) {
  const membership = await setActiveWorkspace(auth.sessionId, auth.user.id, workspaceId);
  if (!membership) throw forbidden("You're not a member of that workspace.");
  return membership;
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

async function issueToken(executor: DbExecutor, userId: string, type: "verify_email" | "reset_password", ttlMs: number) {
  const token = randomToken(32);
  // Only the newest link of each type is valid.
  await executor
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)));
  await executor.insert(authTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function sendVerificationEmail(userId: string) {
  const [user] = await db.select({ name: users.name, email: users.email, verified: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.verified) return;
  const token = await issueToken(db, userId, "verify_email", VERIFY_TTL_MS);
  const url = `${config.APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const rendered = verifyEmailTemplate({ name: user.name, url });
  await sendTransactionalEmail({ template: "verify_email", message: { to: user.email, ...rendered } });
}

/** Sent once an address is confirmed (or on first social sign-in): what to do next. */
async function sendWelcomeEmail(userId: string) {
  const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const rendered = welcomeTemplate({ name: user.name, url: `${config.APP_URL}/onboarding` });
  await sendTransactionalEmail({ template: "welcome", message: { to: user.email, ...rendered } });
}

/** Security notice after any password change, so an unexpected change is noticed quickly. */
async function sendPasswordChangedEmail(userId: string, meta: RequestMeta) {
  const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const rendered = passwordChangedTemplate({
    name: user.name,
    when: new Date(),
    ipAddress: meta.ipAddress ?? null,
    resetUrl: `${config.APP_URL}/forgot-password?email=${encodeURIComponent(user.email)}`,
  });
  await sendTransactionalEmail({ template: "password_changed", message: { to: user.email, ...rendered } });
}

/** Resends verification for the signed-in user, or (anonymously) for an address — without revealing if it exists. */
export async function resendVerification(input: { email: string; sessionUserId?: string }) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt), isNull(users.emailVerifiedAt)))
    .limit(1);
  if (user && (!input.sessionUserId || input.sessionUserId === user.id)) await sendVerificationEmail(user.id);
  return { email, flow: "verify" as const, sentAt: new Date().toISOString() };
}

async function consumeToken(token: string, type: "verify_email" | "reset_password") {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, type), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "verify_email");
  if (!userId) return null;
  const [user] = await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id, email: users.email });
  await acceptPendingInvitations(db, user!.id, user!.email);
  await audit({ action: "auth.email_verified", userId });
  await sendWelcomeEmail(user!.id);
  return user!;
}

// ---------------------------------------------------------------------------
// Password reset & change
// ---------------------------------------------------------------------------

/** Always succeeds from the caller's perspective, so it can't be used to discover accounts. */
export async function requestPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);
  if (user) {
    const token = await issueToken(db, user.id, "reset_password", RESET_TTL_MS);
    const url = `${config.APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
    await sendTransactionalEmail({ template: "reset_password", message: { to: user.email, ...resetPasswordTemplate({ name: user.name, url }) } });
    await audit({ action: "auth.password_reset_requested", userId: user.id });
  }
  return { email, flow: "reset" as const, sentAt: new Date().toISOString() };
}

export async function resetPassword(input: { token: string; password: string }, meta: RequestMeta) {
  validatePasswordStrength(input.password);
  const userId = await consumeToken(input.token, "reset_password");
  if (!userId) throw badRequest("INVALID_RESET_TOKEN", "This reset link is invalid or has expired. Request a new one.");
  const passwordHash = await hashPassword(input.password);
  // Following a reset link proves control of the inbox, so the address is verified too.
  const [user] = await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, userId))
    .returning({ email: users.email });
  await revokeAllSessions(userId);
  await audit({ action: "auth.password_reset", userId, ...meta });
  await sendPasswordChangedEmail(userId, meta);
  return { email: user!.email };
}

export async function changePassword(auth: SessionAuth, input: { currentPassword: string; newPassword: string }, meta: RequestMeta) {
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, auth.user.id)).limit(1);
  if (user?.passwordHash && !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw badRequest("INVALID_PASSWORD", "Your current password is incorrect.");
  }
  validatePasswordStrength(input.newPassword);
  await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, auth.user.id));
  await revokeAllSessions(auth.user.id, auth.sessionId);
  await audit({ action: "auth.password_changed", userId: auth.user.id, ...meta });
  await sendPasswordChangedEmail(auth.user.id, meta);
}

export async function updateProfile(auth: SessionAuth, input: { name: string }) {
  const [user] = await db.update(users).set({ name: input.name.trim() }).where(eq(users.id, auth.user.id)).returning({ id: users.id, name: users.name, email: users.email });
  return user!;
}

// ---------------------------------------------------------------------------
// Onboarding & invitations
// ---------------------------------------------------------------------------

export async function completeOnboarding(
  auth: SessionAuth,
  input: { workspaceName: string; workspaceSlug: string; role: string; goal: string; channels: Channel[] },
) {
  if (config.REQUIRE_EMAIL_VERIFICATION && !auth.user.emailVerified) {
    throw forbidden("Confirm your email address before creating a workspace.", "EMAIL_NOT_VERIFIED");
  }
  const workspace = await db.transaction((tx) =>
    createWorkspace(tx, {
      name: input.workspaceName.trim(),
      slug: input.workspaceSlug.trim().toLowerCase(),
      ownerId: auth.user.id,
      onboarding: { role: input.role, goal: input.goal, channels: input.channels },
    }),
  );
  await setActiveWorkspace(auth.sessionId, auth.user.id, workspace.id);
  await audit({ action: "workspace.created", workspaceId: workspace.id, userId: auth.user.id });
  return {
    id: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    role: input.role,
    goal: input.goal,
    channels: input.channels,
    createdAt: workspace.createdAt.toISOString(),
  };
}

/** Turns every open invitation for a verified email address into a membership. */
export async function acceptPendingInvitations(executor: DbExecutor, userId: string, email: string) {
  const pending = await executor
    .select()
    .from(invitations)
    .where(
      and(
        sql`lower(${invitations.email}) = ${email.toLowerCase()}`,
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
  for (const invitation of pending) {
    await executor.insert(memberships).values({ workspaceId: invitation.workspaceId, userId, role: invitation.role }).onConflictDoNothing();
    await executor.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitation.id));
    await audit({ action: "team.invitation_accepted", workspaceId: invitation.workspaceId, userId, targetId: invitation.id }, executor);
  }
  return pending.length;
}

// ---------------------------------------------------------------------------
// Social sign-in: Google (OIDC + PKCE) and GitHub (OAuth 2.0)
// ---------------------------------------------------------------------------

export const LOGIN_PROVIDERS = ["google", "github"] as const;
export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];

/** A verified identity from the provider. Only verified emails are ever returned. */
type OAuthProfile = { providerAccountId: string; email: string; name?: string; avatarUrl?: string };

type LoginProviderDefinition = {
  name: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  fetchProfile(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthProfile>;
};

const oauthFailed = (provider: string) => unauthorized(`${provider} sign-in failed. Try again.`, "OAUTH_FAILED");

async function exchangeCode(url: string, body: Record<string, string>, provider: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  const tokens = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !tokens.access_token) {
    logger.warn({ status: response.status, provider, error: tokens.error }, "OAuth token exchange failed");
    throw oauthFailed(provider);
  }
  return tokens.access_token;
}

async function getJson<T>(url: string, accessToken: string, provider: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "ShipBrief" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw oauthFailed(provider);
  return (await response.json()) as T;
}

const loginProviders: Record<LoginProvider, LoginProviderDefinition> = {
  google: {
    name: "Google",
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    authorizeUrl: ({ state, codeChallenge, redirectUri }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID ?? "",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      })}`,
    async fetchProfile({ code, codeVerifier, redirectUri }) {
      const accessToken = await exchangeCode(
        "https://oauth2.googleapis.com/token",
        {
          code,
          client_id: config.GOOGLE_CLIENT_ID ?? "",
          client_secret: config.GOOGLE_CLIENT_SECRET ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: codeVerifier,
        },
        "Google",
      );
      const profile = await getJson<{ sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
        "https://openidconnect.googleapis.com/v1/userinfo",
        accessToken,
        "Google",
      );
      if (!profile.sub || !profile.email || !profile.email_verified) {
        throw unauthorized("Your Google account needs a verified email address.", "OAUTH_EMAIL_UNVERIFIED");
      }
      return { providerAccountId: profile.sub, email: profile.email, name: profile.name, avatarUrl: profile.picture };
    },
  },
  github: {
    name: "GitHub",
    clientId: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
    // GitHub OAuth apps don't take PKCE; the single-use, session-bound state guards the redirect.
    authorizeUrl: ({ state, redirectUri }) =>
      `https://github.com/login/oauth/authorize?${new URLSearchParams({
        client_id: config.GITHUB_CLIENT_ID ?? "",
        redirect_uri: redirectUri,
        scope: "read:user user:email",
        state,
        allow_signup: "true",
      })}`,
    async fetchProfile({ code, redirectUri }) {
      const accessToken = await exchangeCode(
        "https://github.com/login/oauth/access_token",
        { code, client_id: config.GITHUB_CLIENT_ID ?? "", client_secret: config.GITHUB_CLIENT_SECRET ?? "", redirect_uri: redirectUri },
        "GitHub",
      );
      const user = await getJson<{ id?: number; login?: string; name?: string | null; avatar_url?: string }>("https://api.github.com/user", accessToken, "GitHub");
      // The profile email can be hidden or unverified; only the primary, verified address is trusted.
      const emails = await getJson<{ email: string; primary: boolean; verified: boolean }[]>("https://api.github.com/user/emails", accessToken, "GitHub");
      const primary = emails.find((entry) => entry.primary && entry.verified);
      if (!user.id || !primary) {
        throw unauthorized("Your GitHub account needs a verified primary email address.", "OAUTH_EMAIL_UNVERIFIED");
      }
      return { providerAccountId: String(user.id), email: primary.email, name: user.name ?? user.login, avatarUrl: user.avatar_url };
    },
  },
};

const isProviderConfigured = (provider: LoginProvider) => Boolean(loginProviders[provider].clientId && loginProviders[provider].clientSecret);
const oauthRedirectUri = (provider: LoginProvider) => `${config.APP_URL}/api/auth/oauth/${provider}/callback`;

export function oauthProviders() {
  return Object.fromEntries(LOGIN_PROVIDERS.map((provider) => [provider, isProviderConfigured(provider)])) as Record<LoginProvider, boolean>;
}

export async function startOAuthSignIn(provider: LoginProvider, intent: "signIn" | "signUp") {
  if (!isProviderConfigured(provider)) {
    throw notConfigured("OAUTH_NOT_CONFIGURED", `${loginProviders[provider].name} sign-in isn't configured for this ShipBrief installation.`);
  }
  const { state, codeChallenge } = await createOAuthState({ purpose: "login", provider, data: { intent } });
  return loginProviders[provider].authorizeUrl({ state, codeChallenge, redirectUri: oauthRedirectUri(provider) });
}

export async function completeOAuthSignIn(provider: LoginProvider, input: { code: string; state: string }, meta: RequestMeta) {
  const definition = loginProviders[provider];
  const stored = await consumeOAuthState(input.state, "login", provider);
  if (!stored || !isProviderConfigured(provider)) throw unauthorized("This sign-in link has expired. Try again.", "OAUTH_STATE_INVALID");

  const profile = await definition.fetchProfile({ code: input.code, codeVerifier: stored.codeVerifier ?? "", redirectUri: oauthRedirectUri(provider) });
  const email = profile.email.toLowerCase();

  const { userId, created } = await db.transaction(async (tx) => {
    const [linked] = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.providerAccountId)))
      .limit(1);
    if (linked) return { userId: linked.userId, created: false };

    // The provider verified the address, so linking to an existing account with the same email is safe.
    const [existing] = await tx.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt))).limit(1);
    const id =
      existing?.id ??
      (await tx
        .insert(users)
        .values({ email, name: profile.name?.trim() || email.split("@")[0]!, emailVerifiedAt: new Date(), avatarUrl: profile.avatarUrl ?? null })
        .returning({ id: users.id }))[0]!.id;
    if (existing) await tx.update(users).set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }).where(eq(users.id, id));
    await tx.insert(oauthAccounts).values({ userId: id, provider, providerAccountId: profile.providerAccountId });
    await acceptPendingInvitations(tx, id, email);
    return { userId: id, created: !existing };
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const session = await createSession({ userId, ...meta });
  await audit({ action: created ? "auth.registered" : "auth.login", userId, ...meta, metadata: { provider } });
  if (created) await sendWelcomeEmail(userId);
  const [membership] = await db.select({ id: memberships.id }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
  return { token: session.token, needsOnboarding: !membership };
}

export async function logout(sessionId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}
