import crypto from "node:crypto";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { db } from "../database/client.js";
import { webhookDeliveries, webhooks } from "../database/schema.js";
import { NonRetryableJobError } from "../jobs/handlers/errors.js";
import { enqueue } from "../jobs/queue.js";
import type { WebhookEvent } from "../types/domain.js";
import { decryptSecret, encryptSecret, hmacSha256Hex, randomToken } from "../utils/crypto.js";
import { notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { assertPublicHttpUrl, isPrivateAddress } from "../utils/ssrf.js";
import { recordActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";

type WebhookRow = typeof webhooks.$inferSelect;

function toWebhookDto(row: WebhookRow) {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    status: row.active ? ("active" as const) : ("inactive" as const),
    lastDelivery: row.lastDeliveryAt?.toISOString(),
  };
}

function toDeliveryDto(row: typeof webhookDeliveries.$inferSelect) {
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event,
    status: row.status,
    attempts: row.attempts,
    deliveredAt: (row.deliveredAt ?? row.updatedAt).toISOString(),
    responseCode: row.responseCode ?? 0,
    error: row.error ?? undefined,
    nextAttemptAt: row.nextAttemptAt?.toISOString(),
  };
}

async function findWebhook(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, workspaceId), isNull(webhooks.deletedAt)))
    .limit(1);
  if (!row) throw notFound("WEBHOOK_NOT_FOUND", "Webhook not found.");
  return row;
}

export async function listWebhooks(actor: Actor) {
  const rows = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, actor.workspaceId), isNull(webhooks.deletedAt)))
    .orderBy(desc(webhooks.createdAt));
  return rows.map(toWebhookDto);
}

/** The signing secret is returned once, at creation. It is stored encrypted because signing needs the raw value. */
export async function createWebhook(actor: Actor, input: { url: string; events: WebhookEvent[] }) {
  await assertPublicHttpUrl(input.url);
  const secret = `whsec_${randomToken(24)}`;
  const [row] = await db
    .insert(webhooks)
    .values({ workspaceId: actor.workspaceId, url: input.url, events: input.events, secretEnc: encryptSecret(secret), createdBy: actor.userId })
    .returning();
  await recordActivity(db, { workspaceId: actor.workspaceId, type: "comment", message: "Webhook endpoint added", link: "/app/api", actorUserId: actor.userId, actorName: actor.name });
  await audit({ action: "webhook.created", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "webhook", targetId: row!.id, metadata: { url: input.url } });
  return { ...toWebhookDto(row!), secret };
}

export async function updateWebhook(actor: Actor, id: string, input: { url?: string; events?: WebhookEvent[]; status?: "active" | "inactive" }) {
  await findWebhook(actor.workspaceId, id);
  if (input.url) await assertPublicHttpUrl(input.url);
  const [row] = await db
    .update(webhooks)
    .set({ updatedAt: new Date(), url: input.url, events: input.events, active: input.status ? input.status === "active" : undefined })
    .where(eq(webhooks.id, id))
    .returning();
  return toWebhookDto(row!);
}

export async function rotateWebhookSecret(actor: Actor, id: string) {
  await findWebhook(actor.workspaceId, id);
  const secret = `whsec_${randomToken(24)}`;
  await db.update(webhooks).set({ secretEnc: encryptSecret(secret) }).where(eq(webhooks.id, id));
  await audit({ action: "webhook.secret_rotated", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "webhook", targetId: id });
  return { id, secret };
}

export async function removeWebhook(actor: Actor, id: string) {
  await findWebhook(actor.workspaceId, id);
  await db.update(webhooks).set({ deletedAt: new Date(), active: false }).where(eq(webhooks.id, id));
  await audit({ action: "webhook.deleted", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "webhook", targetId: id });
  return { id };
}

export async function listDeliveries(actor: Actor, webhookId?: string) {
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(and(eq(webhookDeliveries.workspaceId, actor.workspaceId), isNull(webhooks.deletedAt), webhookId ? eq(webhookDeliveries.webhookId, webhookId) : undefined))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(100);
  return rows.map((row) => toDeliveryDto(row.webhook_deliveries));
}

/** Re-queues a real delivery attempt. The result arrives asynchronously in the delivery log. */
export async function retryDelivery(actor: Actor, id: string) {
  const [row] = await db
    .update(webhookDeliveries)
    .set({ status: "pending", nextAttemptAt: new Date(), error: null })
    .where(and(eq(webhookDeliveries.id, id), eq(webhookDeliveries.workspaceId, actor.workspaceId)))
    .returning();
  if (!row) throw notFound("DELIVERY_NOT_FOUND", "Webhook delivery not found.");
  await enqueue("webhook.deliver", { deliveryId: id, manual: true }, { maxAttempts: 1, dedupeKey: `webhook-retry:${id}` });
  return toDeliveryDto(row);
}

export async function sendTestEvent(actor: Actor, id: string) {
  const webhook = await findWebhook(actor.workspaceId, id);
  const eventId = crypto.randomUUID();
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      webhookId: webhook.id,
      workspaceId: actor.workspaceId,
      eventId,
      event: "webhook.ping",
      payload: { id: eventId, type: "webhook.ping", createdAt: new Date().toISOString(), data: { message: "Test event from ShipBrief" } },
    })
    .returning();
  await enqueue("webhook.deliver", { deliveryId: delivery!.id, manual: true }, { maxAttempts: 1 });
  return toDeliveryDto(delivery!);
}

// ---------------------------------------------------------------------------
// Delivery (worker)
// ---------------------------------------------------------------------------

export function signPayload(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${hmacSha256Hex(secret, `${timestamp}.${body}`)}`;
}

/** DNS lookup that refuses private addresses at connect time, closing the DNS-rebinding gap. */
const guardedLookup: typeof dns.lookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = addresses as dns.LookupAddress[];
    if (!config.WEBHOOK_ALLOW_PRIVATE_TARGETS && list.some((entry) => isPrivateAddress(entry.address))) {
      return callback(Object.assign(new Error("Webhook target resolves to a private address"), { code: "EPRIVATE" }));
    }
    if (options.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}) as typeof dns.lookup;

function postJson(url: URL, headers: Record<string, string>, body: string) {
  return new Promise<{ status: number; excerpt: string }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      { method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() }, lookup: guardedLookup, timeout: 10_000 },
      (response) => {
        let excerpt = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          if (excerpt.length < 500) excerpt += chunk.slice(0, 500 - excerpt.length);
        });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, excerpt }));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Timed out after 10s")));
    request.on("error", reject);
    request.end(body);
  });
}

export async function deliverWebhookJob(payload: Record<string, unknown>, context: { attempt: number }) {
  const deliveryId = String(payload.deliveryId);
  const [row] = await db
    .select({ delivery: webhookDeliveries, webhook: webhooks })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!row) throw new NonRetryableJobError("Delivery no longer exists");
  const { delivery, webhook } = row;
  if (delivery.status === "success") return;
  if (webhook.deletedAt || (!webhook.active && !payload.manual)) {
    await db.update(webhookDeliveries).set({ status: "failed", error: "Webhook disabled" }).where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  let status = 0;
  let excerpt = "";
  let error: string | null = null;
  try {
    const url = await assertPublicHttpUrl(webhook.url);
    ({ status, excerpt } = await postJson(url, {
      "Content-Type": "application/json",
      "User-Agent": "ShipBrief-Webhooks/1.0",
      "ShipBrief-Event": delivery.event,
      "ShipBrief-Event-Id": delivery.eventId,
      "ShipBrief-Delivery": delivery.id,
      "ShipBrief-Signature": signPayload(decryptSecret(webhook.secretEnc), timestamp, body),
    }, body));
    if (status < 200 || status >= 300) error = `Endpoint responded with HTTP ${status}`;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Delivery failed";
  }

  const success = !error;
  await db
    .update(webhookDeliveries)
    .set({
      status: success ? "success" : "failed",
      attempts: sql`${webhookDeliveries.attempts} + 1`,
      responseCode: status || null,
      responseExcerpt: excerpt || null,
      error: error?.slice(0, 500) ?? null,
      deliveredAt: new Date(),
      nextAttemptAt: null,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
  await db.update(webhooks).set({ lastDeliveryAt: new Date() }).where(eq(webhooks.id, webhook.id));

  if (!success) {
    // 4xx other than 408/429 means the receiver rejected the payload; retrying won't change that.
    const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
    if (permanent || payload.manual) throw new NonRetryableJobError(error!);
    if (context.attempt === 1) {
      await recordActivity(db, { workspaceId: webhook.workspaceId, type: "integration", message: `Webhook delivery to ${new URL(webhook.url).host} failed; retrying`, link: "/app/api", actorName: "ShipBrief" });
    }
    throw new Error(error!);
  }
}
