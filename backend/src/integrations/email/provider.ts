import { config } from "../../config/env.js";
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

function fromHeader(fromName?: string) {
  if (!fromName) return config.EMAIL_FROM;
  const address = config.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? config.EMAIL_FROM;
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
    throw new EmailSendError("Email delivery is not configured (set RESEND_API_KEY).", false);
  }
}

function createProvider(): EmailProvider {
  if (config.emailProvider === "log") return new LogProvider();
  return config.RESEND_API_KEY ? new ResendProvider(config.RESEND_API_KEY) : new UnconfiguredProvider();
}

export const emailProvider: EmailProvider = createProvider();

/** Test/dev helper: messages captured by the log provider. */
export function devOutbox(): EmailMessage[] {
  return emailProvider instanceof LogProvider ? emailProvider.outbox : [];
}
