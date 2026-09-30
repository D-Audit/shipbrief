import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { db } from "../database/client.js";
import { invitations, memberships, users, workspaces } from "../database/schema.js";
import { invitationTemplate } from "../integrations/email/templates.js";
import type { TeamRole } from "../types/domain.js";
import { badRequest, conflict, forbidden, isUniqueViolation, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { recordActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";
import { assertSeatAvailable } from "./billing.service.js";
import { sendTransactionalEmail } from "./email.service.js";
import { canAssignRole } from "./permissions.js";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const ROLE_LABELS: Record<TeamRole, string> = { owner: "Owner", admin: "Admin", product_manager: "Product Manager", marketer: "Marketer", developer: "Developer", viewer: "Viewer" };

/** Members and open invitations, in the shape of the Team page (`status: active | invited`). */
export async function listTeam(actor: Actor) {
  const members = await db
    .select({ id: memberships.id, name: users.name, email: users.email, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, actor.workspaceId), isNull(users.deletedAt)))
    .orderBy(asc(memberships.createdAt));
  const pending = await db
    .select({ id: invitations.id, name: invitations.name, email: invitations.email, role: invitations.role })
    .from(invitations)
    .where(and(eq(invitations.workspaceId, actor.workspaceId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
    .orderBy(asc(invitations.createdAt));
  return [...members.map((m) => ({ ...m, status: "active" as const })), ...pending.map((i) => ({ ...i, status: "invited" as const }))];
}

export async function inviteMember(actor: Actor, input: { name: string; email: string; role: TeamRole }) {
  if (!canAssignRole(actor.role, input.role)) throw forbidden("You can't invite someone with that role.");
  const email = input.email.toLowerCase();
  const [existing] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, actor.workspaceId), sql`lower(${users.email}) = ${email}`))
    .limit(1);
  if (existing) throw conflict("ALREADY_MEMBER", "That person is already a member of this workspace.");

  const [{ pendingCount } = { pendingCount: 0 }] = await db
    .select({ pendingCount: sql<number>`count(*)::int` })
    .from(invitations)
    .where(and(eq(invitations.workspaceId, actor.workspaceId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())));
  await assertSeatAvailable(actor.workspaceId, pendingCount);

  let invitation;
  try {
    [invitation] = await db
      .insert(invitations)
      .values({ workspaceId: actor.workspaceId, email, name: input.name.trim(), role: input.role, invitedBy: actor.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error, "invitations_pending_email_key")) throw conflict("ALREADY_INVITED", "That email already has a pending invitation.");
    throw error;
  }

  const [workspace] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, actor.workspaceId)).limit(1);
  const rendered = invitationTemplate({ inviterName: actor.name, workspaceName: workspace?.name ?? "a workspace", role: ROLE_LABELS[input.role], url: `${config.APP_URL}/signup?email=${encodeURIComponent(email)}` });
  await sendTransactionalEmail({ template: "invitation", workspaceId: actor.workspaceId, message: { to: email, ...rendered } });
  await recordActivity(db, { workspaceId: actor.workspaceId, type: "comment", message: `Invited ${invitation!.name} to the workspace`, link: "/app/team", actorUserId: actor.userId, actorName: actor.name });
  await audit({ action: "team.invited", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "invitation", targetId: invitation!.id, metadata: { email, role: input.role } });
  return { id: invitation!.id, name: invitation!.name, email: invitation!.email, role: invitation!.role, status: "invited" as const };
}

export async function updateRole(actor: Actor, id: string, role: TeamRole) {
  if (!canAssignRole(actor.role, role)) throw forbidden("You can't assign that role.");
  const [membership] = await db
    .select({ id: memberships.id, role: memberships.role, userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.id, id), eq(memberships.workspaceId, actor.workspaceId)))
    .limit(1);
  if (membership) {
    if (membership.role === "owner") throw conflict("OWNER_ROLE_LOCKED", "Transfer ownership before changing the owner role.");
    await db.update(memberships).set({ role }).where(eq(memberships.id, id));
    await audit({ action: "team.role_changed", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "membership", targetId: id, metadata: { from: membership.role, to: role } });
  } else {
    const [invitation] = await db
      .update(invitations)
      .set({ role })
      .where(and(eq(invitations.id, id), eq(invitations.workspaceId, actor.workspaceId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
      .returning({ id: invitations.id });
    if (!invitation) throw notFound("MEMBER_NOT_FOUND", "Team member not found.");
  }
  const team = await listTeam(actor);
  return team.find((member) => member.id === id)!;
}

export async function removeMember(actor: Actor, id: string) {
  const [membership] = await db
    .select({ id: memberships.id, role: memberships.role, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.id, id), eq(memberships.workspaceId, actor.workspaceId)))
    .limit(1);
  if (membership) {
    if (membership.role === "owner") throw conflict("OWNER_REMOVAL", "The workspace owner cannot be removed.");
    // Access ends immediately: sessions resolve membership on every request.
    await db.delete(memberships).where(eq(memberships.id, id));
    await recordActivity(db, { workspaceId: actor.workspaceId, type: "comment", message: `${membership.name} removed from the workspace`, link: "/app/team", actorUserId: actor.userId, actorName: actor.name });
    await audit({ action: "team.removed", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "membership", targetId: id });
    return { id };
  }
  const [invitation] = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, id), eq(invitations.workspaceId, actor.workspaceId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id });
  if (!invitation) throw notFound("MEMBER_NOT_FOUND", "Team member not found.");
  await audit({ action: "team.invitation_revoked", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "invitation", targetId: id });
  return { id };
}

export async function transferOwnership(actor: Actor, membershipId: string) {
  if (actor.role !== "owner") throw forbidden("Only the owner can transfer ownership.");
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: memberships.id, userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.workspaceId, actor.workspaceId)))
      .limit(1);
    if (!target) throw notFound("MEMBER_NOT_FOUND", "Team member not found.");
    if (target.userId === actor.userId) throw badRequest("ALREADY_OWNER", "You're already the owner.");
    await tx.update(memberships).set({ role: "admin" }).where(and(eq(memberships.workspaceId, actor.workspaceId), eq(memberships.userId, actor.userId)));
    await tx.update(memberships).set({ role: "owner" }).where(eq(memberships.id, target.id));
  });
  await audit({ action: "team.ownership_transferred", workspaceId: actor.workspaceId, userId: actor.userId, targetType: "membership", targetId: membershipId });
  return listTeam(actor);
}
