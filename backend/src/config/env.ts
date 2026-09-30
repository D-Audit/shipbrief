import { z } from "zod";

/**
 * All runtime configuration is read once, validated, and exported as a typed
 * object. Nothing else in the codebase reads `process.env` directly, so a
 * missing or malformed variable fails fast at boot instead of mid-request.
 */

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === "true" || value === "1"));

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

/**
 * True when the sender address can't be delivered by a real provider: the
 * built-in default or a reserved/example domain. Resend rejects these (403).
 */
export function placeholderSenderDomain(emailFrom: string) {
  const address = emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom;
  const domain = address.split("@")[1]?.trim().toLowerCase() ?? "";
  return !domain || /(^|\.)(local|localhost|test|example|invalid)$/.test(domain) || /(^|\.)example\.(com|org|net)$/.test(domain);
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** Public URL of the web app. Used for links in emails, OAuth callbacks and origin checks. */
    APP_URL: z.url().default("http://localhost:3000"),
    /** Extra origins allowed to make cookie-authenticated, state-changing requests. */
    TRUSTED_ORIGINS: optionalString,
    /** Number of reverse proxies in front of the API (for correct client IPs). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),

    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    /** 32-byte key (base64 or hex) used to encrypt integration tokens and webhook secrets. */
    ENCRYPTION_KEY: z.string().min(32),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REQUIRE_EMAIL_VERIFICATION: bool(true),

    WORKER_MODE: z.enum(["embedded", "off"]).default("embedded"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),

    AI_PROVIDER: z.enum(["anthropic", "dev", "none"]).optional(),
    ANTHROPIC_API_KEY: optionalString,
    AI_MODEL: z.string().default("claude-opus-5-5"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

    EMAIL_PROVIDER: z.enum(["resend", "log"]).optional(),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().default("ShipBrief <no-reply@shipbrief.local>"),

    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage"),
    S3_BUCKET: optionalString,
    S3_REGION: optionalString,
    S3_ENDPOINT: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_PUBLIC_URL: optionalString,

    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: optionalString,
    STRIPE_PRICE_STARTER: optionalString,
    STRIPE_PRICE_PRO: optionalString,
    STRIPE_PRICE_SCALE: optionalString,

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    GITLAB_CLIENT_ID: optionalString,
    GITLAB_CLIENT_SECRET: optionalString,
    GITLAB_BASE_URL: z.url().default("https://gitlab.com"),
    LINEAR_CLIENT_ID: optionalString,
    LINEAR_CLIENT_SECRET: optionalString,
    JIRA_CLIENT_ID: optionalString,
    JIRA_CLIENT_SECRET: optionalString,

    /** Allow webhook targets on private networks (only for local development). */
    WEBHOOK_ALLOW_PRIVATE_TARGETS: bool(false),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (value.AI_PROVIDER === "dev") {
        ctx.addIssue({ code: "custom", path: ["AI_PROVIDER"], message: "The dev AI provider cannot run in production" });
      }
      if (value.EMAIL_PROVIDER === "log") {
        ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "The log email provider cannot run in production" });
      }
      if (placeholderSenderDomain(value.EMAIL_FROM)) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Set EMAIL_FROM to an address on a domain verified with your email provider" });
      }
      if (value.WEBHOOK_ALLOW_PRIVATE_TARGETS) {
        ctx.addIssue({ code: "custom", path: ["WEBHOOK_ALLOW_PRIVATE_TARGETS"], message: "Private webhook targets are not allowed in production" });
      }
    }
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const env = parsed.data;

  const aiProvider =
    env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : env.NODE_ENV === "production" ? "none" : "dev");
  const emailProvider = env.EMAIL_PROVIDER ?? (env.RESEND_API_KEY ? "resend" : env.NODE_ENV === "production" ? "resend" : "log");

  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    aiProvider,
    emailProvider,
    trustedOrigins: [
      new URL(env.APP_URL).origin,
      ...(env.TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
    ],
  } as const;
}

export const config = load();
export type AppConfig = typeof config;
