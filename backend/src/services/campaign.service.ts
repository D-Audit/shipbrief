import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db } from "../database/client.js";
import { audiences, campaigns, contacts, emailDeliveries, jobs, releasePublications, releases, workspaces } from "../database/schema.js";
import { EmailSendError, emailProvider } from "../integrations/email/provider.js";
import { releaseEmailTemplate } from "../integrations/email/templates.js";
import { NonRetryableJobError } from "../jobs/handlers/errors.js";
import { enqueue } from "../jobs/queue.js";
import type { ReleaseCta } from "../types/domain.js";
import { hmacSha256Hex, safeEqual } from "../utils/crypto.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { sanitizeRichText } from "../utils/html.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { audienceFilter, reachable } from "./audience.service.js";
import { emitEvent, track } from "./events.service.js";

type CampaignRow = typeof campaigns.$inferSelect;

function toCampaignDto(row: CampaignRow) {
  return {
    id: row.id,
    releaseId: row.releaseId,
    subject: row.subject,
    previewText: row.previewText,
    from: row.fromName,
    replyTo: row.replyTo ?? undefined,
    audienceId: row.audienceId ?? "",
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    body: row.body ?? undefined,
    cta: row.cta ?? undefined,
    stats: { recipients: row.recipientCount, delivered: row.deliveredCount, failed: row.failedCount },
    lastError: row.lastError ?? undefined,
  };
}

export async function listCampaigns(actor: Actor) {
  const rows = await db.select().from(campaigns).where(eq(campaigns.workspaceId, actor.workspaceId)).orderBy(desc(campaigns.createdAt)).limit(200);
  return rows.map(toCampaignDto);
}

export async function getCampaignByRelease(actor: Actor, releaseId: string) {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.workspaceId, actor.workspaceId), eq(campaigns.releaseId, releaseId)))
    .orderBy(desc(campaigns.createdAt))
    .limit(1);
  return row ? toCampaignDto(row) : null;
}

async function assertRefs(workspaceId: string, input: { releaseId?: string; audienceId?: string | null }) {
  if (input.releaseId) {
    const [release] = await db
      .select({ id: releases.id })
      .from(releases)
      .where(and(eq(releases.id, input.releaseId), eq(releases.workspaceId, workspaceId), isNull(releases.deletedAt)))
      .limit(1);
    if (!release) throw badRequest("RELEASE_NOT_FOUND", "The selected release no longer exists.");
  }
  if (input.audienceId) {
    const [audience] = await db
      .select({ id: audiences.id })
      .from(audiences)
      .where(and(eq(audiences.id, input.audienceId), eq(audiences.workspaceId, workspaceId), isNull(audiences.deletedAt)))
      .limit(1);
    if (!audience) throw badRequest("AUDIENCE_NOT_FOUND", "The selected audience no longer exists.");
  }
}

type CampaignInput = {
  releaseId?: string;
  subject?: string;
  previewText?: string;
  from?: string;
  replyTo?: string | null;
  audienceId?: string | null;
  body?: string;
  cta?: ReleaseCta | null;
  status?: "draft" | "scheduled";
  scheduledAt?: string | null;
};

export async function createCampaign(actor: Actor, input: CampaignInput & { releaseId: string }) {
  await assertRefs(actor.workspaceId, input);
  const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, actor.workspaceId)).limit(1);
  const [row] = await db
    .insert(campaigns)
    .values({
      workspaceId: actor.workspaceId,
      releaseId: input.releaseId,
      subject: input.subject?.trim() || "Untitled campaign",
      previewText: input.previewText ?? "",
      fromName: input.from?.trim() || `${workspace?.name ?? "Product"} team`,
      replyTo: input.replyTo ?? null,
      audienceId: input.audienceId ?? null,
      body: input.body !== undefined ? sanitizeRichText(input.body) : null,
      cta: input.cta ?? null,
      createdBy: actor.userId,
    })
    .returning();
  if (input.status === "scheduled") return updateCampaign(actor, row!.id, { status: "scheduled", scheduledAt: input.scheduledAt });
  return toCampaignDto(row!);
}

/** Editable while draft or scheduled. Scheduling (re)queues the send job; returning to draft cancels it. */
export async function updateCampaign(actor: Actor, id: string, input: CampaignInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, actor.workspaceId)))
      .for("update")
      .limit(1);
    if (!current) throw notFound("CAMPAIGN_NOT_FOUND", "Campaign not found.");
    if (current.status !== "draft" && current.status !== "scheduled") {
      throw conflict("CAMPAIGN_LOCKED", `This campaign is ${current.status} and can no longer be edited.`);
    }
    await assertRefs(actor.workspaceId, input);

    const status = input.status ?? current.status;
    let scheduledAt = input.scheduledAt !== undefined ? (input.scheduledAt ? new Date(input.scheduledAt) : null) : current.scheduledAt;
    if (status === "scheduled") {
      if (!scheduledAt) throw badRequest("SCHEDULE_REQUIRED", "Choose a delivery date and time first.");
      if (scheduledAt.getTime() < Date.now() - 60_000) throw badRequest("SCHEDULE_IN_PAST", "Choose a delivery time in the future.");
      const [release] = await tx.select({ status: releases.status }).from(releases).where(eq(releases.id, input.releaseId ?? current.releaseId)).limit(1);
      if (!release || !["approved", "scheduled", "published"].includes(release.status)) {
        throw conflict("RELEASE_NOT_READY", "Approve the release before scheduling its email.");
      }
    } else {
      scheduledAt = input.scheduledAt !== undefined ? scheduledAt : current.scheduledAt;
    }

    const [updated] = await tx
      .update(campaigns)
      .set({
        releaseId: input.releaseId,
        subject: input.subject?.trim() || undefined,
        previewText: input.previewText,
        fromName: input.from?.trim() || undefined,
        replyTo: input.replyTo,
        audienceId: input.audienceId,
        body: input.body !== undefined ? sanitizeRichText(input.body) : undefined,
        cta: input.cta,
        status,
        scheduledAt,
      })
      .where(eq(campaigns.id, id))
      .returning();

    // Replace any queued send so the job always matches the saved schedule.
    await tx.delete(jobs).where(and(eq(jobs.dedupeKey, `campaign:${id}`), eq(jobs.status, "queued")));
    if (status === "scheduled") await enqueue("campaign.send", { campaignId: id }, { tx, runAt: scheduledAt!, dedupeKey: `campaign:${id}` });
    return toCampaignDto(updated!);
  });
}

// ---------------------------------------------------------------------------
// Delivery (worker)
// ---------------------------------------------------------------------------

export function unsubscribeToken(contactId: string) {
  return hmacSha256Hex(config.ENCRYPTION_KEY, `unsubscribe:${contactId}`).slice(0, 32);
}

export function unsubscribeUrl(contactId: string) {
  return `${config.APP_URL}/api/public/unsubscribe?c=${contactId}&t=${unsubscribeToken(contactId)}`;
}

export async function unsubscribe(contactId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(contactId) || !safeEqual(token, unsubscribeToken(contactId))) return false;
  await db.update(contacts).set({ unsubscribedAt: sql`coalesce(${contacts.unsubscribedAt}, now())` }).where(eq(contacts.id, contactId));
  return true;
}

const BATCH = 200;

/**
 * Job handler. Idempotent: recipients are materialised once as delivery rows
 * (unique per campaign+contact) and only `queued` rows are sent, so a retry
 * after a crash continues where it stopped and never double-sends.
 */
export async function sendCampaignJob(payload: Record<string, unknown>) {
  const campaignId = String(payload.campaignId);
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) throw new NonRetryableJobError("Campaign no longer exists");
  if (campaign.status !== "scheduled" && campaign.status !== "sending") return; // cancelled or already sent

  const [release] = await db.select().from(releases).where(eq(releases.id, campaign.releaseId)).limit(1);
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, campaign.workspaceId)).limit(1);
  if (!release || !workspace || release.deletedAt || workspace.deletedAt) throw new NonRetryableJobError("Release or workspace no longer exists");

  if (release.status === "scheduled" || release.status === "approved") {
    // Email must not go out before the release itself; wait for it.
    const runAt = release.scheduledAt && release.scheduledAt > new Date() ? release.scheduledAt : new Date(Date.now() + 5 * 60 * 1000);
    await db.update(campaigns).set({ scheduledAt: runAt }).where(eq(campaigns.id, campaignId));
    await db.transaction(async (tx) => {
      await tx.delete(jobs).where(and(eq(jobs.dedupeKey, `campaign:${campaignId}`), eq(jobs.status, "queued")));
      await enqueue("campaign.send", { campaignId }, { tx, runAt });
    });
    return;
  }
  if (release.status !== "published") {
    await db.update(campaigns).set({ status: "failed", lastError: "The release isn't published." }).where(eq(campaigns.id, campaignId));
    throw new NonRetryableJobError("Release isn't published");
  }

  await db.update(campaigns).set({ status: "sending" }).where(eq(campaigns.id, campaignId));

  const [audience] = campaign.audienceId ? await db.select().from(audiences).where(eq(audiences.id, campaign.audienceId)).limit(1) : [];
  await db.execute(sql`
    insert into email_deliveries (workspace_id, campaign_id, contact_id, to_email, template, subject, status)
    select ${campaign.workspaceId}, ${campaign.id}, ${contacts.id}, ${contacts.email}, 'release', ${campaign.subject}, 'queued'
    from ${contacts}
    where ${reachable(campaign.workspaceId)} and ${audienceFilter(audience?.rules ?? {})}
    on conflict (campaign_id, contact_id) do nothing
  `);

  const bodyHtml = sanitizeRichText(campaign.body ?? release.channelVariants.email?.body ?? release.body);
  let transientFailures = 0;
  for (;;) {
    const batch = await db
      .select({ id: emailDeliveries.id, toEmail: emailDeliveries.toEmail, contactId: emailDeliveries.contactId })
      .from(emailDeliveries)
      .where(and(eq(emailDeliveries.campaignId, campaignId), eq(emailDeliveries.status, "queued")))
      .limit(BATCH);
    if (batch.length === 0) break;
    let progressed = false;
    for (const delivery of batch) {
      const unsubscribe = delivery.contactId ? unsubscribeUrl(delivery.contactId) : `${config.APP_URL}/c/${workspace.slug}`;
      const rendered = releaseEmailTemplate({
        workspaceName: workspace.name,
        subject: campaign.subject,
        previewText: campaign.previewText,
        bodyHtml,
        cta: campaign.cta ?? release.cta,
        accent: workspace.accentColor,
        unsubscribeUrl: unsubscribe,
        changelogUrl: `${config.APP_URL}/c/${workspace.slug}`,
      });
      try {
        const result = await emailProvider.send({
          to: delivery.toEmail,
          ...rendered,
          fromName: campaign.fromName,
          replyTo: campaign.replyTo,
          idempotencyKey: delivery.id,
          headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        await db
          .update(emailDeliveries)
          .set({ status: result.status, provider: result.provider, providerMessageId: result.providerMessageId ?? null, sentAt: new Date(), attempts: sql`${emailDeliveries.attempts} + 1` })
          .where(eq(emailDeliveries.id, delivery.id));
        progressed = true;
      } catch (error) {
        const retryable = error instanceof EmailSendError && error.retryable;
        await db
          .update(emailDeliveries)
          .set({
            // Transient errors stay queued for the next attempt; permanent ones are recorded as failed.
            status: retryable ? "queued" : "failed",
            error: (error as Error).message.slice(0, 500),
            provider: emailProvider.name,
            attempts: sql`${emailDeliveries.attempts} + 1`,
          })
          .where(eq(emailDeliveries.id, delivery.id));
        if (retryable) transientFailures += 1;
        else progressed = true;
      }
    }
    if (!progressed) break; // the whole batch hit transient errors: stop and let the job retry later
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${emailDeliveries.status} in ('sent', 'logged'))::int`,
      failed: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'failed')::int`,
      queued: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'queued')::int`,
    })
    .from(emailDeliveries)
    .where(eq(emailDeliveries.campaignId, campaignId));

  await db.update(campaigns).set({ recipientCount: stats!.total, deliveredCount: stats!.delivered, failedCount: stats!.failed }).where(eq(campaigns.id, campaignId));
  if (stats!.queued > 0 && transientFailures > 0) {
    throw new Error(`${stats!.queued} emails still queued after transient provider errors`);
  }

  const allFailed = stats!.total > 0 && stats!.delivered === 0;
  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ status: allFailed ? "failed" : "sent", sentAt: new Date(), lastError: allFailed ? "Every delivery failed. Check the email provider configuration." : null })
      .where(eq(campaigns.id, campaignId));
    await tx
      .update(releasePublications)
      .set({ status: allFailed ? "failed" : "published", publishedAt: allFailed ? null : new Date(), error: allFailed ? "Email delivery failed" : null })
      .where(and(eq(releasePublications.releaseId, release.id), eq(releasePublications.channel, "email")));
    if (!allFailed) {
      await track(tx, { workspaceId: workspace.id, type: "email.sent", releaseId: release.id, channel: "email", properties: { count: stats!.delivered } });
      await emitEvent(tx, { workspaceId: workspace.id, event: "campaign.sent", data: { id: campaignId, releaseId: release.id, recipients: stats!.total, delivered: stats!.delivered } });
    }
    await recordActivity(tx, {
      workspaceId: workspace.id,
      type: "published",
      message: allFailed
        ? `Email for “${release.title}” failed to send`
        : emailProvider.name === "log"
          ? `Email for “${release.title}” processed for ${stats!.delivered} recipients (development: logged, not delivered)`
          : `Email for “${release.title}” sent to ${stats!.delivered} recipient${stats!.delivered === 1 ? "" : "s"}`,
      link: "/app/campaigns",
      actorName: "ShipBrief",
    });
  });
  logger.info({ campaignId, ...stats }, "Campaign processed");
}

