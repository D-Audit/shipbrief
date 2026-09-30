import { rollupAnalytics } from "../../services/analytics.service.js";
import { sendCampaignJob } from "../../services/campaign.service.js";
import { sendNotificationJob } from "../../services/notification.service.js";
import { publishDueReleases } from "../../services/release.service.js";
import { deliverWebhookJob } from "../../services/webhook.service.js";
import type { JobType } from "../queue.js";
import { NonRetryableJobError } from "./errors.js";
import { cleanup } from "./maintenance.js";

export type JobContext = { jobId: number; attempt: number };
export type JobHandler = (payload: Record<string, unknown>, context: JobContext) => Promise<void>;

export { NonRetryableJobError };

export const jobHandlers: Record<JobType, JobHandler> = {
  "release.publish_due": async () => {
    await publishDueReleases();
  },
  "campaign.send": sendCampaignJob,
  "email.send": async (payload) => {
    if (payload.kind !== "notification") throw new NonRetryableJobError(`Unknown email job kind: ${String(payload.kind)}`);
    await sendNotificationJob(payload);
  },
  "webhook.deliver": deliverWebhookJob,
  "analytics.rollup": async () => {
    await rollupAnalytics();
  },
  "maintenance.cleanup": cleanup,
};

/** Scheduled by every worker; de-duplicated so only one instance of each is queued at a time. */
export const recurringJobs: { type: JobType; everyMs: number }[] = [
  { type: "release.publish_due", everyMs: 30_000 },
  { type: "analytics.rollup", everyMs: 60_000 },
  { type: "maintenance.cleanup", everyMs: 60 * 60 * 1000 },
];
