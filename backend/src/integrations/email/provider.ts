import nodemailer from "nodemailer";
import { config, placeholderSenderDomain } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
  /** Passed to providers that support it so retries never send twice. */
  idempotencyKey?: string;
};

export type EmailSendResult = {
  /** `sent`: accepted by a real provider. `logged`: development only — nothing left this machine. */
  status: "sent" | "logged";
  provider: string;
  providerMessageId?: string;
};

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

function fromHeader(fromName?: string, emailFrom = config.EMAIL_FROM) {
  if (!fromName) return emailFrom;
  const address = emailFrom.match(/<([^>]+)>/)?.[1] ?? emailFrom;
  return `${fromName.replace(/[<>"\r\n]/g, "").slice(0, 80)} <${address}>`;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: fromHeader(message.fromName),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo ?? undefined,
          headers: message.headers,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailSendError(`Email provider unreachable: ${(error as Error).message}`, true);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      // 429 and 5xx are transient; other 4xx (bad address, unverified domain) won't fix themselves.
      throw new EmailSendError(`Resend rejected the message (${response.status}): ${detail}`, response.status === 429 || response.status >= 500);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", provider: this.name, providerMessageId: body.id };
  }
}

/**
 * Gmail API sending: the message is built as raw MIME and posted over HTTPS,
 * so it works on hosts that block SMTP ports (e.g. Render's free plan). A
 * long-lived refresh token is exchanged for short access tokens as needed.
 */
class GmailApiProvider implements EmailProvider {
  readonly name = "gmail";
  private readonly composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
  private readonly emailFrom: string;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    sender: string,
  ) {
    this.emailFrom = placeholderSenderDomain(config.EMAIL_FROM) ? `ShipBrief <${sender}>` : config.EMAIL_FROM;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailSendError(`Google sign-in unreachable: ${(error as Error).message}`, true);
    }
    const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!response.ok || !body.access_token) {
      // invalid_grant / invalid_client: the refresh token was revoked or expired, or the client is wrong. Needs a new token.
      throw new EmailSendError(`Google refused the Gmail credentials (${response.status} ${body.error ?? ""})`.trim(), response.status >= 500);
    }
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const built = await this.composer.sendMail({
      from: fromHeader(message.fromName, this.emailFrom),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? undefined,
      headers: message.headers,
    });
    const raw = (built.message as Buffer).toString("base64url");

    let response: Response;
    try {
      response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailSendError(`Gmail unreachable: ${(error as Error).message}`, true);
    }
    if (response.status === 401) this.accessToken = null;
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      // 401 (stale token, refreshed on retry), 429 (daily/rate limit) and 5xx are transient.
      throw new EmailSendError(`Gmail rejected the message (${response.status}): ${detail}`, response.status === 401 || response.status === 429 || response.status >= 500);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", provider: this.name, providerMessageId: body.id };
  }
}

/**
 * SMTP sending, built for a Gmail account with an App Password. Gmail always
 * sends as the signed-in account, so a placeholder EMAIL_FROM falls back to
 * "ShipBrief <SMTP_USER>".
 */
class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly transport;
  private readonly emailFrom: string;

  constructor(user: string, password: string) {
    this.transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user, pass: password.replace(/\s+/g, "") },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
    this.emailFrom = placeholderSenderDomain(config.EMAIL_FROM) ? `ShipBrief <${user}>` : config.EMAIL_FROM;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.transport.sendMail({
        from: fromHeader(message.fromName, this.emailFrom),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ?? undefined,
        headers: message.headers,
      });
      return { status: "sent", provider: this.name, providerMessageId: info.messageId };
    } catch (error) {
      const err = error as Error & { code?: string; responseCode?: number };
      // Bad credentials or a rejected address won't fix themselves; network errors and 4xx SMTP replies are transient.
      const permanent = err.code === "EAUTH" || (err.responseCode !== undefined && err.responseCode >= 500);
      throw new EmailSendError(`SMTP send failed: ${err.message}`, !permanent);
    }
  }
}

/**
 * Development provider: writes the message to the log (so verification and
 * reset links can be clicked locally) and reports `logged`, never `sent`.
 * Refused in production by env validation.
 */
class LogProvider implements EmailProvider {
  readonly name = "log";
  readonly outbox: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.outbox.push(message);
    if (this.outbox.length > 200) this.outbox.shift();
    logger.info({ to: message.to, subject: message.subject, text: message.text.slice(0, 1500) }, "Email (log provider — not delivered)");
    return { status: "logged", provider: this.name };
  }
}

class UnconfiguredProvider implements EmailProvider {
  readonly name = "unconfigured";
  async send(): Promise<EmailSendResult> {
    throw new EmailSendError("Email delivery is not configured (set the GMAIL_* settings, SMTP_USER and SMTP_PASSWORD, or RESEND_API_KEY).", false);
  }
}

function createProvider(): EmailProvider {
  if (config.emailProvider === "log") return new LogProvider();
  if (config.emailProvider === "gmail" && config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET && config.GMAIL_REFRESH_TOKEN && config.GMAIL_SENDER) {
    return new GmailApiProvider(config.GMAIL_CLIENT_ID, config.GMAIL_CLIENT_SECRET, config.GMAIL_REFRESH_TOKEN, config.GMAIL_SENDER);
  }
  if (config.emailProvider === "smtp" && config.SMTP_USER && config.SMTP_PASSWORD) return new SmtpProvider(config.SMTP_USER, config.SMTP_PASSWORD);
  return config.RESEND_API_KEY ? new ResendProvider(config.RESEND_API_KEY) : new UnconfiguredProvider();
}

export const emailProvider: EmailProvider = createProvider();

/** Test/dev helper: messages captured by the log provider. */
export function devOutbox(): EmailMessage[] {
  return emailProvider instanceof LogProvider ? emailProvider.outbox : [];
}
