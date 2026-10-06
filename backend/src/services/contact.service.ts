import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { db } from "../database/client.js";
import { contacts, workspaces } from "../database/schema.js";
import { EmailSendError, emailProvider } from "../integrations/email/provider.js";
import { subscribeConfirmTemplate } from "../integrations/email/templates.js";
import { hmacSha256Hex, safeEqual } from "../utils/crypto.js";
import { badRequest, conflict, notConfigured, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";
import { getPublicWorkspaceBySlug } from "./workspace.service.js";

type ContactRow = typeof contacts.$inferSelect;

/** Tag added to everyone who subscribed themselves from the public changelog, so audiences can target them. */
export const CHANGELOG_SUBSCRIBER_TAG = "changelog";
export const MAX_IMPORT_ROWS = 5000;
const SUBSCRIBE_LINK_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toContactDto(row: ContactRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    tags: row.tags,
    externalId: row.externalId,
    subscribed: !row.unsubscribedAt,
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Managing contacts in the app
// ---------------------------------------------------------------------------

export async function listContacts(actor: Actor, filters: { search?: string; status: "all" | "subscribed" | "unsubscribed"; page: number; pageSize: number }) {
  const search = filters.search?.trim();
  const where = and(
    eq(contacts.workspaceId, actor.workspaceId),
    filters.status === "subscribed" ? isNull(contacts.unsubscribedAt) : filters.status === "unsubscribed" ? isNotNull(contacts.unsubscribedAt) : undefined,
    search ? or(ilike(contacts.email, `%${search}%`), ilike(contacts.name, `%${search}%`)) : undefined,
  );
  const [rows, [filtered], [totals]] = await Promise.all([
    db.select().from(contacts).where(where).orderBy(desc(contacts.createdAt)).limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize),
    db.select({ value: count() }).from(contacts).where(where),
    db
      .select({ total: count(), unsubscribed: sql<number>`count(*) filter (where ${contacts.unsubscribedAt} is not null)::int` })
      .from(contacts)
      .where(eq(contacts.workspaceId, actor.workspaceId)),
  ]);
  return {
    items: rows.map(toContactDto),
    total: filtered?.value ?? 0,
    counts: { total: totals?.total ?? 0, subscribed: (totals?.total ?? 0) - (totals?.unsubscribed ?? 0), unsubscribed: totals?.unsubscribed ?? 0 },
  };
}

export async function addContact(actor: Actor, input: { email: string; name?: string; plan?: string; tags?: string[] }) {
  const email = input.email.toLowerCase();
  const [existing] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.workspaceId, actor.workspaceId), sql`lower(${contacts.email}) = ${email}`)).limit(1);
  if (existing) throw conflict("CONTACT_EXISTS", "That email is already in your contacts.");
  const [created] = await db
    .insert(contacts)
    .values({ workspaceId: actor.workspaceId, email, name: input.name || null, plan: input.plan || null, tags: input.tags ?? [] })
    .returning();
  return toContactDto(created!);
}

export async function deleteContact(actor: Actor, id: string) {
  const [deleted] = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.workspaceId, actor.workspaceId))).returning({ id: contacts.id });
  if (!deleted) throw notFound("CONTACT_NOT_FOUND", "Contact not found.");
  return { id: deleted.id };
}

/** The separator the file uses: Excel saves ";" in many locales, and some tools export tabs. */
function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((delimiter) => ({ delimiter, n: firstLine.split(delimiter).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0]!.n > 0 ? counts[0]!.delimiter : ",";
}

/** Minimal RFC 4180 CSV: quoted fields, escaped quotes, separators and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some(Boolean));
}

/**
 * Imports a CSV of contacts. The first row may be a header naming the columns
 * (email, name, plan, tags); without one, the first column is the email.
 * Existing contacts are updated, never re-subscribed: someone who
 * unsubscribed stays unsubscribed whatever the import says.
 */
export async function importContacts(actor: Actor, csv: string) {
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  if (rows.length === 0) throw badRequest("IMPORT_EMPTY", "The file has no rows.");

  const header = rows[0]!.map((cell) => cell.toLowerCase());
  const hasHeader = header.some((cell) => ["email", "e-mail", "email address"].includes(cell));
  const column = (names: string[]) => (hasHeader ? header.findIndex((cell) => names.includes(cell)) : -1);
  const emailAt = hasHeader ? column(["email", "e-mail", "email address"]) : 0;
  const nameAt = column(["name", "full name"]);
  const planAt = column(["plan"]);
  const tagsAt = column(["tags", "tag"]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length > MAX_IMPORT_ROWS) throw badRequest("IMPORT_TOO_LARGE", `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en")} contacts at a time.`);

  const result = { added: 0, updated: 0, skipped: [] as { row: number; reason: string }[] };
  const seen = new Set<string>();
  for (const [index, cells] of dataRows.entries()) {
    const rowNumber = index + (hasHeader ? 2 : 1);
    const email = (cells[emailAt] ?? "").toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      result.skipped.push({ row: rowNumber, reason: email ? `“${email.slice(0, 60)}” isn't a valid email` : "No email" });
      continue;
    }
    if (seen.has(email)) {
      result.skipped.push({ row: rowNumber, reason: `${email} appears more than once` });
      continue;
    }
    seen.add(email);
    const name = nameAt >= 0 ? cells[nameAt]?.slice(0, 120) || null : null;
    const plan = planAt >= 0 ? cells[planAt]?.slice(0, 40) || null : null;
    const tags = tagsAt >= 0 ? [...new Set((cells[tagsAt] ?? "").split(/[|,]/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20).map((tag) => tag.slice(0, 40)) : null;

    const [existing] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.workspaceId, actor.workspaceId), sql`lower(${contacts.email}) = ${email}`)).limit(1);
    if (existing) {
      if (name || plan || tags) {
        await db.update(contacts).set({ name: name ?? undefined, plan: plan ?? undefined, tags: tags ?? undefined }).where(eq(contacts.id, existing.id));
      }
      result.updated += 1;
    } else {
      await db.insert(contacts).values({ workspaceId: actor.workspaceId, email, name, plan, tags: tags ?? [] }).onConflictDoNothing();
      result.added += 1;
    }
  }
  return { ...result, skipped: result.skipped.slice(0, 50), skippedCount: result.skipped.length };
}

// ---------------------------------------------------------------------------
// Public "Subscribe to updates" (double opt-in)
// ---------------------------------------------------------------------------

/**
 * The confirmation link carries everything needed to subscribe, signed with
 * the server key, so nothing is stored until the person clicks it.
 */
function signSubscription(workspaceId: string, email: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ w: workspaceId, e: email, x: expiresAt })).toString("base64url");
  return `${payload}.${hmacSha256Hex(config.ENCRYPTION_KEY, `subscribe:${payload}`).slice(0, 32)}`;
}

function readSubscription(token: string): { workspaceId: string; email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, hmacSha256Hex(config.ENCRYPTION_KEY, `subscribe:${payload}`).slice(0, 32))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { w?: unknown; e?: unknown; x?: unknown };
    if (typeof data.w !== "string" || typeof data.e !== "string" || typeof data.x !== "number" || data.x < Date.now()) return null;
    return { workspaceId: data.w, email: data.e };
  } catch {
    return null;
  }
}

/**
 * Emails a confirmation link. The response never says whether the address is
 * already subscribed, so the form can't be used to look people up.
 */
export async function requestSubscription(workspaceSlug: string, email: string) {
  const workspace = await getPublicWorkspaceBySlug(workspaceSlug);
  const token = signSubscription(workspace.id, email.toLowerCase(), Date.now() + SUBSCRIBE_LINK_DAYS * 24 * 60 * 60 * 1000);
  const url = `${config.APP_URL}/api/public/subscribe/confirm?token=${encodeURIComponent(token)}`;
  const rendered = subscribeConfirmTemplate({ workspaceName: workspace.name, url, accent: workspace.accentColor });
  try {
    await emailProvider.send({ to: email, ...rendered, fromName: workspace.name });
  } catch (error) {
    logger.warn({ err: error, workspaceId: workspace.id }, "Subscription confirmation email failed");
    if (error instanceof EmailSendError && !error.retryable) throw notConfigured("EMAIL_UNAVAILABLE", "Email subscriptions aren't available right now. Please try again later.");
    throw notConfigured("EMAIL_UNAVAILABLE", "We couldn't send the confirmation email. Please try again in a few minutes.");
  }
  return { sent: true };
}

/** Confirms a subscription link. Returns the workspace slug to send the person back to, or null if the link is invalid. */
export async function confirmSubscription(token: string) {
  const subscription = readSubscription(token);
  if (!subscription) return null;
  const [workspace] = await db.select({ slug: workspaces.slug }).from(workspaces).where(and(eq(workspaces.id, subscription.workspaceId), isNull(workspaces.deletedAt))).limit(1);
  if (!workspace) return null;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, subscription.workspaceId), sql`lower(${contacts.email}) = ${subscription.email}`))
    .limit(1);
  if (existing) {
    // Clicking the link is fresh, explicit consent, so it also re-subscribes someone who unsubscribed before.
    await db
      .update(contacts)
      .set({ unsubscribedAt: null, tags: existing.tags.includes(CHANGELOG_SUBSCRIBER_TAG) ? undefined : [...existing.tags, CHANGELOG_SUBSCRIBER_TAG] })
      .where(eq(contacts.id, existing.id));
  } else {
    await db
      .insert(contacts)
      .values({ workspaceId: subscription.workspaceId, email: subscription.email, tags: [CHANGELOG_SUBSCRIBER_TAG], signedUpAt: new Date() })
      .onConflictDoNothing();
  }
  return { workspaceSlug: workspace.slug };
}
