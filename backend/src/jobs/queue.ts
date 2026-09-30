import { and, eq, lt, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { jobs } from "../database/schema.js";

/**
 * A small, durable job queue on Postgres.
 *
 * - `enqueue` accepts a transaction, so a job is only visible if the business
 *   change that produced it commits (transactional outbox).
 * - Workers claim with `FOR UPDATE SKIP LOCKED`, so any number of worker
 *   processes can run concurrently without double-processing.
 * - Failures retry with exponential backoff until `maxAttempts`, then the job
 *   is marked `dead` and kept for inspection.
 */

export type JobType =
  | "release.publish_due"
  | "campaign.send"
  | "email.send"
  | "webhook.deliver"
  | "analytics.rollup"
  | "maintenance.cleanup";

export type EnqueueOptions = {
  runAt?: Date;
  maxAttempts?: number;
  /** At most one queued/running job per key; later enqueues are dropped. */
  dedupeKey?: string;
  tx?: DbExecutor;
};

export async function enqueue(type: JobType, payload: Record<string, unknown> = {}, options: EnqueueOptions = {}) {
  const executor = options.tx ?? db;
  const [job] = await executor
    .insert(jobs)
    .values({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
      dedupeKey: options.dedupeKey ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  return job?.id ?? null;
}

export type ClaimedJob = typeof jobs.$inferSelect;

export async function claimJobs(workerId: string, limit: number): Promise<ClaimedJob[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1, updated_at = now()
    where id in (
      select id from jobs
      where status = 'queued' and run_at <= now()
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id, type, payload, attempts, max_attempts
  `);
  return result.rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
  })) as ClaimedJob[];
}

export async function completeJob(id: number) {
  await db.update(jobs).set({ status: "succeeded", lockedAt: null, lockedBy: null, lastError: null }).where(eq(jobs.id, id));
}

export function backoffMs(attempt: number) {
  // 30s, 2m, 8m, 32m, ~2h, capped at 6h — with jitter so retries don't stampede.
  const base = Math.min(30_000 * 4 ** (attempt - 1), 6 * 60 * 60 * 1000);
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

export async function failJob(job: Pick<ClaimedJob, "id" | "attempts" | "maxAttempts">, error: string, retryable = true) {
  const dead = !retryable || job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set({
      status: dead ? "dead" : "queued",
      runAt: dead ? undefined : new Date(Date.now() + backoffMs(job.attempts)),
      lockedAt: null,
      lockedBy: null,
      lastError: error.slice(0, 2000),
    })
    .where(eq(jobs.id, job.id));
  return dead;
}

/** Returns jobs whose worker died mid-flight back to the queue. */
export async function recoverStaleJobs(olderThanMs = 10 * 60 * 1000) {
  const result = await db
    .update(jobs)
    .set({ status: "queued", lockedAt: null, lockedBy: null })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(Date.now() - olderThanMs))))
    .returning({ id: jobs.id });
  return result.length;
}
