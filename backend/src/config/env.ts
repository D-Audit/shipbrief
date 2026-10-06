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

/**
 * True when the sender is a free mailbox (gmail.com, outlook.com, …). Nobody can
 * verify those domains, so Resend rejects every email sent from them (403).
 */
export function publicMailboxSender(emailFrom: string) {
  const address = emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom;
  const domain = address.split("@")[1]?.trim().toLowerCase() ?? "";
  return /^(gmail|googlemail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|yandex|mail|zoho)\.[a-z.]+$/.test(domain) || /^yahoo\.[a-z.]+$/.test(domain);
}

type GmailEnv = { GMAIL_CLIENT_ID?: string; GMAIL_CLIENT_SECRET?: string; GMAIL_REFRESH_TOKEN?: string; GMAIL_SENDER?: string };
const gmailConfigured = (env: GmailEnv) =>
  Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && env.GMAIL_SENDER);

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

    /**
     * Widget key (Project ID) of the workspace whose in-app releases ShipBrief shows its own
     * signed-in users in the app's "What's new" panel. Unset hides it.
     */
    PRODUCT_UPDATES_WIDGET_KEY: optionalString,

    WORKER_MODE: z.enum(["embedded", "off"]).default("embedded"),
    /** How often connected sources (GitHub, GitLab, Linear, Jira) are checked for new work. 0 turns automatic sync off. */
    INTEGRATION_SYNC_MINUTES: z.coerce.number().int().min(0).max(1440).default(15),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),

    AI_PROVIDER: z.enum(["anthropic", "dev", "none"]).optional(),
    ANTHROPIC_API_KEY: optionalString,
    AI_MODEL: z.string().default("claude-opus-5-5"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

    EMAIL_PROVIDER: z.enum(["gmail", "resend", "smtp", "log"]).optional(),
    RESEND_API_KEY: optionalString,
    /**
     * Gmail API sending (HTTPS, so it works where SMTP ports are blocked). An
     * OAuth client plus a refresh token granted for the gmail.send scope.
     */
    GMAIL_CLIENT_ID: optionalString,
    GMAIL_CLIENT_SECRET: optionalString,
    GMAIL_REFRESH_TOKEN: optionalString,
    /** The Gmail address that granted the refresh token; emails are sent from it. */
    GMAIL_SENDER: optionalString,
    /** SMTP sending, e.g. a Gmail account with an App Password. Defaults suit Gmail. */
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
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
      if (value.EMAIL_PROVIDER === "gmail" && !gmailConfigured(value)) {
        ctx.addIssue({ code: "custom", path: ["GMAIL_REFRESH_TOKEN"], message: "Gmail sending needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and GMAIL_SENDER" });
      }
      if (value.EMAIL_PROVIDER === "smtp" && !(value.SMTP_USER && value.SMTP_PASSWORD)) {
        ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP sending needs SMTP_USER and SMTP_PASSWORD" });
      }
      // Without a Resend key email is simply off, so the sender address is never used.
      // Gmail and SMTP fall back to the account's own address, so a placeholder is fine there.
      if (value.RESEND_API_KEY && !value.SMTP_USER && !gmailConfigured(value) && placeholderSenderDomain(value.EMAIL_FROM)) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Set EMAIL_FROM to an address on a domain verified with your email provider" });
      }
      if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
        ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Resend sending needs RESEND_API_KEY (resend.com → API Keys)" });
      }
      const usesResend = value.EMAIL_PROVIDER ? value.EMAIL_PROVIDER === "resend" : !gmailConfigured(value) && !(value.SMTP_USER && value.SMTP_PASSWORD);
      if (usesResend && value.RESEND_API_KEY && publicMailboxSender(value.EMAIL_FROM)) {
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Resend can't send from a free mailbox like gmail.com. Use an address on a domain verified at resend.com/domains" });
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
  const emailProvider =
    env.EMAIL_PROVIDER ??
    (gmailConfigured(env) ? "gmail" : env.SMTP_USER && env.SMTP_PASSWORD ? "smtp" : env.RESEND_API_KEY ? "resend" : env.NODE_ENV === "production" ? "resend" : "log");

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
