import crypto from "node:crypto";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db, type DbExecutor } from "../database/client.js";
import { emailDeliveries, memberships, users, workspaces } from "../database/schema.js";
import { EmailSendError, emailProvider } from "../integrations/email/provider.js";
import { notificationTemplate } from "../integrations/email/templates.js";
import { enqueue } from "../jobs/queue.js";
import type { WorkspaceNotificationSettings } from "../types/domain.js";

/**
 * Email notifications for important workspace events, gated by the
 * workspace's notification settings. Queued, so a slow provider never delays
 * the action that triggered them. The payload carries no secrets.
 */
export async function notifyWorkspace(
  input: { workspaceId: string; setting: keyof WorkspaceNotificationSettings; message: string; link: string; exceptUserId?: string | null },
  executor: DbExecutor = db,
) {
  const [workspace] = await executor
    .select({ settings: workspaces.notificationSettings })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!workspace?.settings[input.setting]) return;
  await enqueue("email.send", { kind: "notification", notificationId: crypto.randomUUID(), ...input }, { tx: executor, maxAttempts: 4 });
}

/** Job handler: sends one notification email per member (except the actor). */
export async function sendNotificationJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId);
  const message = String(payload.message).slice(0, 300);
  const link = String(payload.link);
  const exceptUserId = typeof payload.exceptUserId === "string" ? payload.exceptUserId : null;

  const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt))).limit(1);
  if (!workspace) return;
  const recipients = await db
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), isNull(users.deletedAt), exceptUserId ? ne(users.id, exceptUserId) : undefined));

  // Retries skip recipients this notification already reached.
  const template = `notification:${String(payload.notificationId ?? "legacy")}`;
  const alreadySent = new Set(
    (
      await db
        .select({ email: emailDeliveries.toEmail })
        .from(emailDeliveries)
        .where(and(eq(emailDeliveries.template, template), inArray(emailDeliveries.status, ["sent", "logged"])))
    ).map((row) => row.email),
  );
  const pending = recipients.filter((recipient) => !alreadySent.has(recipient.email));

  const rendered = notificationTemplate({ workspaceName: workspace.name, message, url: `${config.APP_URL}${link.startsWith("/") ? link : "/app/overview"}` });
  let failures = 0;
  for (const recipient of pending) {
    const [delivery] = await db
      .insert(emailDeliveries)
      .values({ workspaceId, toEmail: recipient.email, template, subject: rendered.subject, status: "queued", attempts: 1 })
      .returning({ id: emailDeliveries.id });
    try {
      const result = await emailProvider.send({ to: recipient.email, ...rendered, idempotencyKey: delivery!.id });
      await db.update(emailDeliveries).set({ status: result.status, provider: result.provider, providerMessageId: result.providerMessageId ?? null, sentAt: new Date() }).where(eq(emailDeliveries.id, delivery!.id));
    } catch (error) {
      failures += 1;
      await db.update(emailDeliveries).set({ status: "failed", provider: emailProvider.name, error: (error as Error).message.slice(0, 500) }).where(eq(emailDeliveries.id, delivery!.id));
      if (!(error instanceof EmailSendError) || !error.retryable) logger.warn({ err: error, workspaceId }, "Notification email failed");
    }
  }
  if (failures > 0) throw new Error(`${failures} of ${pending.length} notification emails failed`);
}
