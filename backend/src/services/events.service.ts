import crypto from "node:crypto";
import { and, arrayContains, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "../database/client.js";
import { analyticsEvents, webhookDeliveries, webhooks } from "../database/schema.js";
import { enqueue } from "../jobs/queue.js";
import type { WebhookEvent } from "../types/domain.js";

/**
 * Domain events fan out to subscribed webhooks. Deliveries are created inside
 * the caller's transaction and delivered by the worker, so a webhook is only
 * ever sent for a change that actually committed, and a slow receiver never
 * slows down the API.
 */
export async function emitEvent(
  tx: DbExecutor,
  input: { workspaceId: string; event: WebhookEvent; data: Record<string, unknown> },
) {
  const targets = await tx
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.workspaceId, input.workspaceId),
        eq(webhooks.active, true),
        isNull(webhooks.deletedAt),
        arrayContains(webhooks.events, [input.event]),
      ),
    );
  if (targets.length === 0) return;

  const eventId = crypto.randomUUID();
  const payload = { id: eventId, type: input.event, createdAt: new Date().toISOString(), data: input.data };
  const deliveries = await tx
    .insert(webhookDeliveries)
    .values(targets.map((target) => ({ webhookId: target.id, workspaceId: input.workspaceId, eventId, event: input.event, payload })))
    .returning({ id: webhookDeliveries.id });

  for (const delivery of deliveries) {
    await enqueue("webhook.deliver", { deliveryId: delivery.id }, { tx, maxAttempts: 8 });
  }
}

export type AnalyticsEventType =
  | "release.created"
  | "release.published"
  | "release.viewed"
  | "changelog.viewed"
  | "cta.clicked"
  | "reaction.added"
  | "comment.created"
  | "email.sent"
  | "email.opened"
  | "in_app.viewed"
  | "in_app.clicked"
  | "feedback.submitted"
  | "feedback.voted"
  | "roadmap.updated";

/** Appends a raw analytics event; the worker rolls these into `analytics_daily`. */
export async function track(
  executor: DbExecutor,
  input: {
    workspaceId: string;
    type: AnalyticsEventType;
    releaseId?: string | null;
    channel?: string | null;
    visitorId?: string | null;
    properties?: Record<string, unknown>;
  },
) {
  await executor.insert(analyticsEvents).values({
    workspaceId: input.workspaceId,
    type: input.type,
    releaseId: input.releaseId ?? null,
    channel: input.channel ?? null,
    visitorId: input.visitorId ?? null,
    properties: input.properties ?? {},
  });
}
