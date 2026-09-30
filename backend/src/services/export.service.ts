import { and, eq, isNull } from "drizzle-orm";
import { db } from "../database/client.js";
import { audiences, campaigns, feedback, feedbackComments, memberships, releases, roadmapItems, users, workspaces } from "../database/schema.js";
import type { Actor } from "../utils/http.js";
import { audit } from "./audit.service.js";

/** Full workspace export (GDPR/data portability). Secrets and credentials are never included. */
export async function exportWorkspace(actor: Actor) {
  const ws = actor.workspaceId;
  const [workspace] = await db
    .select({ name: workspaces.name, slug: workspaces.slug, brandVoice: workspaces.brandVoice, timezone: workspaces.timezone, createdAt: workspaces.createdAt })
    .from(workspaces)
    .where(eq(workspaces.id, ws))
    .limit(1);
  const data = {
    exportedAt: new Date().toISOString(),
    workspace,
    team: await db.select({ name: users.name, email: users.email, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, ws)),
    releases: await db.select().from(releases).where(and(eq(releases.workspaceId, ws), isNull(releases.deletedAt))).then((rows) => rows.map(({ searchVector: _search, ...row }) => row)),
    feedback: await db.select().from(feedback).where(and(eq(feedback.workspaceId, ws), isNull(feedback.deletedAt))).then((rows) => rows.map(({ searchVector: _search, ...row }) => row)),
    feedbackComments: await db.select().from(feedbackComments).where(eq(feedbackComments.workspaceId, ws)),
    roadmap: await db.select().from(roadmapItems).where(and(eq(roadmapItems.workspaceId, ws), isNull(roadmapItems.deletedAt))),
    campaigns: await db.select().from(campaigns).where(eq(campaigns.workspaceId, ws)),
    audiences: await db.select().from(audiences).where(and(eq(audiences.workspaceId, ws), isNull(audiences.deletedAt))),
  };
  await audit({ action: "workspace.exported", workspaceId: ws, userId: actor.userId });
  return { filename: `shipbrief-${workspace?.slug ?? "workspace"}-export.json`, data };
}
