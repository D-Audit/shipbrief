import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "../database/client.js";
import { audiences, contacts } from "../database/schema.js";
import type { AudienceRules } from "../types/domain.js";
import { conflict, isUniqueViolation, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";

/** SQL predicate selecting the contacts an audience's rules describe. Empty rules = everyone. */
export function audienceFilter(rules: AudienceRules): SQL {
  const parts: SQL[] = [sql`true`];
  if (rules.plans?.length) parts.push(sql`${contacts.plan} = any(${sql`array[${sql.join(rules.plans.map((plan) => sql`${plan}`), sql`, `)}]::text[]`})`);
  if (rules.tags?.length) parts.push(sql`${contacts.tags} && ${sql`array[${sql.join(rules.tags.map((tag) => sql`${tag.toLowerCase()}`), sql`, `)}]::text[]`}`);
  if (rules.accountAgeDays) parts.push(sql`${contacts.signedUpAt} <= now() - make_interval(days => ${Math.floor(rules.accountAgeDays)})`);
  return sql.join(parts, sql` and `);
}

/** Contacts that can actually receive email. */
export function reachable(workspaceId: string) {
  return and(eq(contacts.workspaceId, workspaceId), sql`${contacts.email} is not null`, isNull(contacts.unsubscribedAt));
}

export async function listAudiences(actor: Actor) {
  const rows = await db
    .select({ id: audiences.id, name: audiences.name, rules: audiences.rules })
    .from(audiences)
    .where(and(eq(audiences.workspaceId, actor.workspaceId), isNull(audiences.deletedAt)))
    .orderBy(asc(audiences.createdAt));
  if (rows.length === 0) return [];

  // One scan of contacts computes every audience's size (COUNT … FILTER), instead of one query per audience.
  const selections = rows.map((row, index) => sql`count(*) filter (where ${audienceFilter(row.rules)})::int as ${sql.raw(`a${index}`)}`);
  const result = await db.execute<Record<string, number>>(sql`select ${sql.join(selections, sql`, `)} from ${contacts} where ${reachable(actor.workspaceId)}`);
  const sizes = result.rows[0] ?? {};
  return rows.map((row, index) => ({ ...row, size: Number(sizes[`a${index}`] ?? 0) }));
}

export async function audienceSize(executor: DbExecutor, workspaceId: string, rules: AudienceRules) {
  const [row] = await executor
    .select({ size: sql<number>`count(*)::int` })
    .from(contacts)
    .where(and(reachable(workspaceId), audienceFilter(rules)));
  return row?.size ?? 0;
}

export async function getAudience(actor: Actor, id: string) {
  const [row] = await db
    .select({ id: audiences.id, name: audiences.name, rules: audiences.rules })
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.workspaceId, actor.workspaceId), isNull(audiences.deletedAt)))
    .limit(1);
  if (!row) throw notFound("AUDIENCE_NOT_FOUND", "Audience not found.");
  return { ...row, size: await audienceSize(db, actor.workspaceId, row.rules) };
}

export async function previewAudience(actor: Actor, rules: AudienceRules) {
  return { size: await audienceSize(db, actor.workspaceId, rules), rules };
}

export async function createAudience(actor: Actor, input: { name: string; rules: AudienceRules }) {
  try {
    const [row] = await db
      .insert(audiences)
      .values({ workspaceId: actor.workspaceId, name: input.name.trim(), rules: input.rules })
      .returning({ id: audiences.id, name: audiences.name, rules: audiences.rules });
    return { ...row!, size: await audienceSize(db, actor.workspaceId, row!.rules) };
  } catch (error) {
    if (isUniqueViolation(error, "audiences_workspace_name_key")) throw conflict("AUDIENCE_EXISTS", "An audience with that name already exists.");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Contacts — the workspace's own end users, created through the public API.
// ---------------------------------------------------------------------------

export async function upsertContact(
  workspaceId: string,
  input: { externalId?: string; email?: string; name?: string; plan?: string; tags?: string[]; signedUpAt?: string },
) {
  const values = {
    workspaceId,
    externalId: input.externalId ?? null,
    email: input.email?.toLowerCase() ?? null,
    name: input.name ?? null,
    plan: input.plan ?? null,
    tags: input.tags ?? [],
    signedUpAt: input.signedUpAt ? new Date(input.signedUpAt) : null,
  };
  const existing = input.externalId
    ? await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.externalId, input.externalId))).limit(1)
    : input.email
      ? await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.workspaceId, workspaceId), sql`lower(${contacts.email}) = ${input.email.toLowerCase()}`)).limit(1)
      : [];
  if (existing[0]) {
    const [updated] = await db
      .update(contacts)
      .set({
        email: input.email !== undefined ? values.email : undefined,
        name: input.name,
        plan: input.plan,
        tags: input.tags,
        signedUpAt: input.signedUpAt ? values.signedUpAt : undefined,
        externalId: input.externalId,
      })
      .where(eq(contacts.id, existing[0].id))
      .returning();
    return updated!;
  }
  try {
    const [created] = await db.insert(contacts).values(values).returning();
    return created!;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("CONTACT_EXISTS", "A contact with that email or external id already exists.");
    throw error;
  }
}
