import type { TeamRole } from "../types/domain.js";

/**
 * Role → permission matrix. The roles and their intent come straight from the
 * Team page ("Product Manager — review roadmap and approvals", "Marketer —
 * create and schedule communication", "Developer — provide source context and
 * drafts", "Viewer — view shared workspace information").
 *
 * This is the only place that knows which role may do what; routes declare the
 * permission they need and never compare role names themselves.
 */

const EVERYONE: readonly TeamRole[] = ["owner", "admin", "product_manager", "marketer", "developer", "viewer"];
const CONTRIBUTORS: readonly TeamRole[] = ["owner", "admin", "product_manager", "marketer", "developer"];
const APPROVERS: readonly TeamRole[] = ["owner", "admin", "product_manager"];
const COMMUNICATORS: readonly TeamRole[] = ["owner", "admin", "product_manager", "marketer"];
const TECHNICAL: readonly TeamRole[] = ["owner", "admin", "developer"];
const ADMINS: readonly TeamRole[] = ["owner", "admin"];
const OWNER: readonly TeamRole[] = ["owner"];

export const PERMISSIONS = {
  "workspace:read": EVERYONE,
  "workspace:update": ADMINS,
  "workspace:delete": OWNER,
  "workspace:export": ADMINS,
  "branding:update": [...ADMINS, "marketer"],
  "team:read": EVERYONE,
  "team:manage": ADMINS,
  "billing:read": ADMINS,
  "billing:manage": OWNER,
  "audit:read": ADMINS,

  "release:read": EVERYONE,
  "release:write": CONTRIBUTORS,
  "release:submit": CONTRIBUTORS,
  "release:approve": APPROVERS,
  "release:schedule": COMMUNICATORS,
  "release:publish": APPROVERS,
  "release:archive": APPROVERS,
  "release:delete": APPROVERS,

  "campaign:write": COMMUNICATORS,
  "audience:write": COMMUNICATORS,

  "feedback:read": EVERYONE,
  "feedback:create": CONTRIBUTORS,
  "feedback:comment": CONTRIBUTORS,
  "feedback:vote": CONTRIBUTORS,
  "feedback:manage": APPROVERS,

  "roadmap:read": EVERYONE,
  "roadmap:manage": APPROVERS,

  "ai:use": CONTRIBUTORS,
  "analytics:read": EVERYONE,
  "activity:read": EVERYONE,

  "integrations:manage": TECHNICAL,
  "developer:manage": TECHNICAL,
  "import:run": ADMINS,
} as const satisfies Record<string, readonly TeamRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: TeamRole, permission: Permission) {
  return (PERMISSIONS[permission] as readonly TeamRole[]).includes(role);
}

export function permissionsFor(role: TeamRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => can(role, permission));
}

/** Ownership is never granted through a role change; owners and admins may assign every other role. */
export function canAssignRole(actorRole: TeamRole, targetRole: TeamRole) {
  return targetRole !== "owner" && can(actorRole, "team:manage");
}
