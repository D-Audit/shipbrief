import type { NextFunction, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { logger } from "../config/logger.js";
import { tooManyRequests } from "../utils/errors.js";
import { clientIp } from "../utils/http.js";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across every
 * API instance without adding Redis. One upsert per limited request.
 */

type Policy = {
  name: string;
  windowSeconds: number;
  max: number;
  /** Defaults to the client IP. Return extra discriminators (e.g. email) to limit per target. */
  key?: (req: Request) => string | undefined;
};

export async function hit(key: string, windowSeconds: number) {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, ${windowStart.toISOString()}, 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start = excluded.window_start then rate_limits.count + 1 else 1 end,
      window_start = excluded.window_start
    returning count
  `);
  const count = Number(result.rows[0]?.count ?? 1);
  const resetAt = windowStart.getTime() + windowSeconds * 1000;
  return { count, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
}

export function rateLimit(policy: Policy) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const discriminator = policy.key?.(req) ?? clientIp(req);
    const key = `${policy.name}:${discriminator}`;
    try {
      const { count, retryAfterSeconds } = await hit(key, policy.windowSeconds);
      res.setHeader("RateLimit-Limit", String(policy.max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, policy.max - count)));
      if (count > policy.max) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        logger.warn({ policy: policy.name, requestId: req.id }, "Rate limit exceeded");
        return next(tooManyRequests(undefined, retryAfterSeconds));
      }
    } catch (error) {
      // Fail open: a limiter outage must not take the API down with it.
      logger.error({ err: error, policy: policy.name }, "Rate limiter unavailable");
    }
    next();
  };
}

const userOrIp = (req: Request) => (req.auth?.kind === "session" ? `user:${req.auth.user.id}` : `ip:${clientIp(req)}`);
const emailAndIp = (req: Request) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 200) : "";
  return `${clientIp(req)}:${email}`;
};

/** Named policies, tuned so normal use never trips them but brute force does. */
export const limits = {
  login: rateLimit({ name: "login", windowSeconds: 15 * 60, max: 10, key: emailAndIp }),
  loginIp: rateLimit({ name: "login-ip", windowSeconds: 15 * 60, max: 50 }),
  signup: rateLimit({ name: "signup", windowSeconds: 60 * 60, max: 10 }),
  authEmail: rateLimit({ name: "auth-email", windowSeconds: 60 * 60, max: 6, key: emailAndIp }),
  passwordReset: rateLimit({ name: "password-reset", windowSeconds: 15 * 60, max: 10 }),
  ai: rateLimit({ name: "ai", windowSeconds: 60, max: 20, key: userOrIp }),
  publicWrite: rateLimit({ name: "public-write", windowSeconds: 10 * 60, max: 20 }),
  /** Each request sends an email, so keep it tight: a few tries per visitor per hour. */
  subscribe: rateLimit({ name: "subscribe", windowSeconds: 60 * 60, max: 5 }),
  testEmail: rateLimit({ name: "test-email", windowSeconds: 10 * 60, max: 10, key: userOrIp }),
  publicRead: rateLimit({ name: "public-read", windowSeconds: 60, max: 240 }),
  api: rateLimit({ name: "api", windowSeconds: 60, max: 600, key: userOrIp }),
  apiKey: rateLimit({
    name: "api-key",
    windowSeconds: 60,
    max: 300,
    key: (req) => (req.auth?.kind === "api_key" ? req.auth.apiKeyId : clientIp(req)),
  }),
  inboundWebhook: rateLimit({ name: "inbound-webhook", windowSeconds: 60, max: 300 }),
  upload: rateLimit({ name: "upload", windowSeconds: 10 * 60, max: 30, key: userOrIp }),
};
