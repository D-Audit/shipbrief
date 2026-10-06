import { and, desc, eq, inArray } from "drizzle-orm";
import { audiences, campaigns, workspaces } from "../database/schema.js";
import { enqueue } from "../jobs/queue.js";
import type { Channel } from "../types/domain.js";
import { publicChangelogUrls } from "../services/workspace.service.js";
import type { ChannelPublisher } from "./types.js";

/** Changelog: publication makes the release visible on the public changelog immediately. */
const changelogPublisher: ChannelPublisher = {
  channel: "changelog",
  async publish({ tx, release }) {
    const [workspace] = await tx
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, release.workspaceId))
      .limit(1);
    return { status: "published", meta: { url: workspace ? publicChangelogUrls(workspace).releaseUrl(release.slug) : null } };
  },
};

/** In-app: publication makes the announcement available to the What's New widget. */
const inAppPublisher: ChannelPublisher = {
  channel: "in_app",
  async publish({ release }) {
    return { status: "published", meta: { format: release.channelVariants.in_app?.format ?? "feed" } };
  },
};

/**
 * Email: hands the release to a campaign and queues delivery. Uses the most
 * recent unsent campaign for the release, or creates one from the email
 * variant. A campaign scheduled for later keeps its own send time.
 */
const emailPublisher: ChannelPublisher = {
  channel: "email",
  async publish({ tx, release, actorUserId }) {
    const [existing] = await tx
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.releaseId, release.id), inArray(campaigns.status, ["draft", "scheduled", "sending", "sent"])))
      .orderBy(desc(campaigns.createdAt))
      .limit(1);

    if (existing?.status === "sent" || existing?.status === "sending") {
      return { status: "skipped", meta: { campaignId: existing.id, reason: `Campaign already ${existing.status}` } };
    }

    let campaignId = existing?.id;
    let runAt = new Date();
    if (existing?.status === "scheduled" && existing.scheduledAt && existing.scheduledAt > runAt) {
      runAt = existing.scheduledAt;
    } else if (existing) {
      await tx.update(campaigns).set({ status: "scheduled", scheduledAt: runAt }).where(eq(campaigns.id, existing.id));
    } else {
      const variant = release.channelVariants.email;
      const [workspace] = await tx.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, release.workspaceId)).limit(1);
      const audienceId =
        release.audienceId ??
        (await tx.select({ id: audiences.id }).from(audiences).where(eq(audiences.workspaceId, release.workspaceId)).limit(1))[0]?.id ??
        null;
      const [created] = await tx
        .insert(campaigns)
        .values({
          workspaceId: release.workspaceId,
          releaseId: release.id,
          subject: variant?.subject || variant?.title || release.title,
          previewText: variant?.previewText || variant?.summary || release.summary,
          fromName: `${workspace?.name ?? "Product"} team`,
          audienceId,
          status: "scheduled",
          body: variant?.body || release.body,
          cta: release.cta,
          scheduledAt: runAt,
          createdBy: actorUserId,
        })
        .returning({ id: campaigns.id });
      campaignId = created!.id;
    }

    await enqueue("campaign.send", { campaignId }, { tx, runAt, dedupeKey: `campaign:${campaignId}`, maxAttempts: 5 });
    return { status: "pending", meta: { campaignId, sendAt: runAt.toISOString() } };
  },
};

export const publishers: Record<Channel, ChannelPublisher> = {
  changelog: changelogPublisher,
  email: emailPublisher,
  in_app: inAppPublisher,
};
