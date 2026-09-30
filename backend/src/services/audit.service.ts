import { desc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { auditLogs, users } from "../database/schema.js";
import { logger } from "../config/logger.js";

/**
 * Security-relevant actions (sign-ins, role changes, key/webhook management,
 * publishing, deletions). Written best-effort: an audit write failure is
 * logged loudly but never fails the user's request.
 */
export async function audit(
  input: {
    action: string;
    workspaceId?: string | null;
    userId?: string | null;
    targetType?: string;
    targetId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
  executor: DbExecutor = db,
) {
  try {
    await executor.insert(auditLogs).values({
      action: input.action,
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "Failed to write audit log");
  }
}

export async function listAuditLogs(workspaceId: string, limit: number) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      actor: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.workspaceId, workspaceId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
