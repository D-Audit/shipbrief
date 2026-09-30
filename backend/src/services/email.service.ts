import { eq } from "drizzle-orm";
import { logger } from "../config/logger.js";
import { db } from "../database/client.js";
import { emailDeliveries } from "../database/schema.js";
import { EmailSendError, emailProvider, type EmailMessage } from "../integrations/email/provider.js";

/**
 * Sends a transactional email now and records the outcome. Used for auth
 * emails whose links carry one-time tokens: sending inline keeps those tokens
 * out of the job table. Never throws — the caller's flow (sign-up, reset)
 * must not fail because the provider is down; the user can resend.
 */
export async function sendTransactionalEmail(input: { template: string; workspaceId?: string | null; message: EmailMessage }) {
  const [delivery] = await db
    .insert(emailDeliveries)
    .values({
      workspaceId: input.workspaceId ?? null,
      toEmail: input.message.to,
      template: input.template,
      subject: input.message.subject,
      status: "queued",
      attempts: 1,
    })
    .returning({ id: emailDeliveries.id });

  try {
    const result = await emailProvider.send({ ...input.message, idempotencyKey: delivery!.id });
    await db
      .update(emailDeliveries)
      .set({ status: result.status, provider: result.provider, providerMessageId: result.providerMessageId ?? null, sentAt: new Date() })
      .where(eq(emailDeliveries.id, delivery!.id));
    return { ok: true as const, status: result.status };
  } catch (error) {
    const message = error instanceof EmailSendError ? error.message : "Unexpected email failure";
    logger.error({ err: error, template: input.template, deliveryId: delivery!.id }, "Transactional email failed");
    await db.update(emailDeliveries).set({ status: "failed", error: message.slice(0, 500), provider: emailProvider.name }).where(eq(emailDeliveries.id, delivery!.id));
    return { ok: false as const, status: "failed" as const };
  }
}
