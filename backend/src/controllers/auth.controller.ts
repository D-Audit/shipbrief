import type { Request, Response } from "express";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import * as auth from "../services/auth.service.js";
import { listSessions, resolveSession, revokeOwnSession, SESSION_COOKIE, sessionCookieOptions } from "../services/session.service.js";
import { listUserWorkspaces } from "../services/workspace.service.js";
import { AppError, notFound } from "../utils/errors.js";
import { parse, requestMeta, sendData, sendNoContent, sessionOf } from "../utils/http.js";
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  oauthCallbackQuery,
  oauthProviderParam,
  oauthStartQuery,
  onboardingSchema,
  profileSchema,
  registerSchema,
  resendSchema,
  resetPasswordSchema,
  switchWorkspaceSchema,
  verifyEmailQuery,
} from "../validators/auth.js";
import { uuidParam } from "../validators/common.js";

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, options);
}

export async function register(req: Request, res: Response) {
  const body = parse(req, "body", registerSchema);
  const result = await auth.register(body, requestMeta(req));
  setSessionCookie(res, result.token);
  sendData(res, { email: result.email, flow: "verify", sentAt: result.sentAt }, 201);
}

export async function login(req: Request, res: Response) {
  const body = parse(req, "body", loginSchema);
  const result = await auth.login(body, requestMeta(req));
  setSessionCookie(res, result.token);
  const established = await resolveSession(result.token);
  sendData(res, await auth.describeSession(established!));
}

export async function logout(req: Request, res: Response) {
  if (req.auth?.kind === "session") await auth.logout(req.auth.sessionId);
  clearSessionCookie(res);
  sendNoContent(res);
}

export async function session(req: Request, res: Response) {
  if (!req.auth || req.auth.kind !== "session") return sendData(res, null);
  sendData(res, await auth.describeSession(req.auth));
}

export async function switchWorkspace(req: Request, res: Response) {
  const { workspaceId } = parse(req, "body", switchWorkspaceSchema);
  const current = sessionOf(req);
  await auth.switchWorkspace(current, workspaceId);
  const refreshed = await resolveSession(String(req.cookies[SESSION_COOKIE]));
  sendData(res, await auth.describeSession(refreshed!));
}

export async function resendEmail(req: Request, res: Response) {
  const body = parse(req, "body", resendSchema);
  const result =
    body.flow === "verify"
      ? await auth.resendVerification({ email: body.email, sessionUserId: req.auth?.kind === "session" ? req.auth.user.id : undefined })
      : await auth.requestPasswordReset(body.email);
  sendData(res, result);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = parse(req, "body", emailOnlySchema);
  sendData(res, await auth.requestPasswordReset(email));
}

export async function resetPassword(req: Request, res: Response) {
  const body = parse(req, "body", resetPasswordSchema);
  const result = await auth.resetPassword(body, requestMeta(req));
  clearSessionCookie(res);
  sendData(res, result);
}

/** Target of the link in the verification email; redirects back into the web app. */
export async function verifyEmail(req: Request, res: Response) {
  const { token } = parse(req, "query", verifyEmailQuery);
  const user = token ? await auth.verifyEmail(token) : null;
  if (!user) return res.redirect(303, `${config.APP_URL}/login?notice=verification-link-invalid`);
  const signedInHere = req.auth?.kind === "session" && req.auth.user.id === user.id;
  if (!signedInHere) return res.redirect(303, `${config.APP_URL}/login?notice=email-verified`);
  const hasWorkspace = (await listUserWorkspaces(user.id)).length > 0;
  res.redirect(303, `${config.APP_URL}${hasWorkspace ? "/app/overview" : "/onboarding"}`);
}

export async function changePassword(req: Request, res: Response) {
  const body = parse(req, "body", changePasswordSchema);
  await auth.changePassword(sessionOf(req), body, requestMeta(req));
  sendNoContent(res);
}

export async function updateProfile(req: Request, res: Response) {
  const body = parse(req, "body", profileSchema);
  sendData(res, await auth.updateProfile(sessionOf(req), body));
}

export async function sessionsList(req: Request, res: Response) {
  const current = sessionOf(req);
  const rows = await listSessions(current.user.id);
  sendData(res, rows.map((row) => ({ ...row, current: row.id === current.sessionId, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt.toISOString() })));
}

export async function revokeSession(req: Request, res: Response) {
  const { id } = parse(req, "params", uuidParam);
  const current = sessionOf(req);
  if (!(await revokeOwnSession(current.user.id, id))) throw notFound("SESSION_NOT_FOUND", "Session not found.");
  if (id === current.sessionId) clearSessionCookie(res);
  sendNoContent(res);
}

export async function onboarding(req: Request, res: Response) {
  const body = parse(req, "body", onboardingSchema);
  sendData(res, await auth.completeOnboarding(sessionOf(req), body), 201);
}

export async function providers(_req: Request, res: Response) {
  sendData(res, auth.oauthProviders());
}

export async function oauthStart(req: Request, res: Response) {
  const { provider } = parse(req, "params", oauthProviderParam);
  const { intent } = parse(req, "query", oauthStartQuery);
  res.redirect(302, await auth.startOAuthSignIn(provider, intent));
}

export async function oauthCallback(req: Request, res: Response) {
  const { provider } = parse(req, "params", oauthProviderParam);
  const query = parse(req, "query", oauthCallbackQuery);
  if (query.error || !query.code || !query.state) return res.redirect(303, `${config.APP_URL}/login?notice=oauth-cancelled&provider=${provider}`);
  try {
    const result = await auth.completeOAuthSignIn(provider, { code: query.code, state: query.state }, requestMeta(req));
    setSessionCookie(res, result.token);
    res.redirect(303, `${config.APP_URL}${result.needsOnboarding ? "/onboarding" : "/app/overview"}`);
  } catch (error) {
    logger.warn({ err: error, provider, requestId: req.id }, "Social sign-in failed");
    const notice = error instanceof AppError && error.code === "OAUTH_EMAIL_UNVERIFIED" ? "oauth-email-unverified" : "oauth-failed";
    res.redirect(303, `${config.APP_URL}/login?notice=${notice}&provider=${provider}`);
  }
}
