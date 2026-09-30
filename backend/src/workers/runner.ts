import os from "node:os";
import { logger } from "../config/logger.js";
import { jobHandlers, NonRetryableJobError, recurringJobs } from "../jobs/handlers/index.js";
import { claimJobs, completeJob, enqueue, failJob, recoverStaleJobs } from "../jobs/queue.js";

/**
 * Polls the job table, runs handlers with bounded concurrency, and schedules
 * recurring maintenance. Safe to run as many copies as needed: claiming uses
 * SKIP LOCKED and recurring jobs are de-duplicated by key.
 */
export function startWorker(options: { id?: string; concurrency?: number; pollMs?: number } = {}) {
  const workerId = `${os.hostname()}:${process.pid}:${options.id ?? "worker"}`;
  const concurrency = options.concurrency ?? 4;
  const pollMs = options.pollMs ?? 1000;
  let running = 0;
  let stopped = false;
  const inFlight = new Set<Promise<void>>();
  const log = logger.child({ component: "worker", workerId });

  async function runOne(job: Awaited<ReturnType<typeof claimJobs>>[number]) {
    const handler = jobHandlers[job.type as keyof typeof jobHandlers];
    const started = Date.now();
    if (!handler) {
      await failJob(job, `No handler registered for ${job.type}`, false);
      log.error({ jobId: job.id, type: job.type }, "Unknown job type");
      return;
    }
    try {
      await handler(job.payload, { jobId: job.id, attempt: job.attempts });
      await completeJob(job.id);
      log.debug({ jobId: job.id, type: job.type, ms: Date.now() - started }, "Job succeeded");
    } catch (error) {
      const retryable = !(error instanceof NonRetryableJobError);
      const dead = await failJob(job, error instanceof Error ? error.message : String(error), retryable);
      log[dead ? "error" : "warn"]({ jobId: job.id, type: job.type, attempt: job.attempts, err: error }, dead ? "Job failed permanently" : "Job failed; will retry");
    }
  }

  async function tick() {
    if (stopped || running >= concurrency) return;
    try {
      const jobs = await claimJobs(workerId, concurrency - running);
      for (const job of jobs) {
        running += 1;
        const task = runOne(job).finally(() => {
          running -= 1;
          inFlight.delete(task);
        });
        inFlight.add(task);
      }
    } catch (error) {
      log.error({ err: error }, "Failed to claim jobs");
    }
  }

  const pollTimer = setInterval(() => void tick(), pollMs);
  const recurringTimers = recurringJobs.map(({ type, everyMs }) => {
    const schedule = () => void enqueue(type, {}, { dedupeKey: `recurring:${type}`, maxAttempts: 1 }).catch((error: unknown) => log.error({ err: error, type }, "Failed to schedule recurring job"));
    schedule();
    return setInterval(schedule, everyMs);
  });
  const staleTimer = setInterval(() => void recoverStaleJobs().catch(() => undefined), 60_000);
  log.info({ concurrency }, "Worker started");

  return {
    /** Runs one polling cycle immediately (used by tests). */
    tick,
    async stop() {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(staleTimer);
      recurringTimers.forEach(clearInterval);
      await Promise.allSettled([...inFlight]);
      log.info("Worker stopped");
    },
  };
}
