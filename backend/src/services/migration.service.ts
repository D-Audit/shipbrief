import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../database/client.js";
import { migrationImports, releases } from "../database/schema.js";
import { badRequest } from "../utils/errors.js";
import { escapeHtml, htmlToPlainText, sanitizeRichText } from "../utils/html.js";
import type { Actor } from "../utils/http.js";
import { slugify, uniqueSlug } from "../utils/slug.js";
import { recordActivity } from "./activity.service.js";
import { readWorkspaceUpload } from "./upload.service.js";

type MigrationSource = "headway" | "featurebase" | "csv" | "json" | "other";

type ImportedPost = { title: string; body: string; summary: string; date: Date | null; tags: string[]; category: string | null; images: number };

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
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
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const [header, ...data] = rows;
  if (!header) return [];
  const keys = header.map((key) => key.trim().toLowerCase().replace(/\s+/g, "_"));
  return data.map((values) => Object.fromEntries(keys.map((key, index) => [key, values[index]?.trim() ?? ""])));
}

const pick = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return undefined;
};

/** Maps the column/field names used by Headway, Featurebase and generic exports onto one shape. */
function normalise(record: Record<string, unknown>): ImportedPost | null {
  const title = String(pick(record, ["title", "name", "headline", "subject"]) ?? "").trim();
  if (!title) return null;
  const rawBody = String(pick(record, ["body", "content", "html", "content_html", "description", "text", "markdown"]) ?? "");
  const looksHtml = /<[a-z][\s\S]*>/i.test(rawBody);
  const body = looksHtml ? rawBody : rawBody.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`).join("");
  const dateValue = pick(record, ["published_at", "publishedat", "date", "published", "created_at", "createdat"]);
  const date = dateValue ? new Date(String(dateValue)) : null;
  const tagValue = pick(record, ["tags", "categories", "labels", "category"]);
  const tags = Array.isArray(tagValue)
    ? tagValue.map((tag) => (typeof tag === "object" && tag ? String((tag as { name?: unknown }).name ?? "") : String(tag)))
    : String(tagValue ?? "").split(/[,;|]/);
  const imageField = pick(record, ["image", "image_url", "cover", "cover_image"]);
  return {
    title: title.slice(0, 200),
    body,
    summary: String(pick(record, ["summary", "excerpt", "subtitle"]) ?? "").slice(0, 1000),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    tags: [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
    category: typeof record.category === "string" ? record.category.slice(0, 40) : null,
    images: (body.match(/<img\b/gi)?.length ?? 0) + (imageField ? 1 : 0),
  };
}

async function parseUpload(actor: Actor, uploadId: string) {
  const { row, body } = await readWorkspaceUpload(actor, uploadId);
  if (row.purpose !== "import") throw badRequest("INVALID_UPLOAD", "Upload the export file as an import.");
  const text = body.toString("utf8");
  let records: Record<string, unknown>[];
  if (row.contentType === "application/json") {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed) ? parsed : ((parsed as Record<string, unknown>).posts ?? (parsed as Record<string, unknown>).data ?? (parsed as Record<string, unknown>).entries ?? (parsed as Record<string, unknown>).changelogs);
    if (!Array.isArray(list)) throw badRequest("UNRECOGNISED_EXPORT", "We couldn't find a list of posts in that JSON file.");
    records = list.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  } else {
    records = parseCsv(text);
  }
  const posts = records.map(normalise).filter((post): post is ImportedPost => post !== null).slice(0, 1000);
  if (posts.length === 0) throw badRequest("UNRECOGNISED_EXPORT", "No posts with a title were found in that file.");
  return { row, posts };
}

async function conflictsFor(actor: Actor, posts: ImportedPost[]) {
  const slugs = [...new Set(posts.map((post) => slugify(post.title)))];
  const existing = await db
    .select({ slug: releases.slug })
    .from(releases)
    .where(and(eq(releases.workspaceId, actor.workspaceId), inArray(releases.slug, slugs), isNull(releases.deletedAt)));
  return existing.length;
}

function summarise(source: MigrationSource, fileName: string | undefined, posts: ImportedPost[], conflicts: number) {
  return {
    source,
    fileName,
    posts: posts.length,
    images: posts.reduce((total, post) => total + post.images, 0),
    tags: new Set(posts.flatMap((post) => post.tags)).size,
    conflicts,
  };
}

export async function previewImport(actor: Actor, input: { source: MigrationSource; uploadId: string }) {
  const { row, posts } = await parseUpload(actor, input.uploadId);
  const preview = summarise(input.source, row.originalName, posts, await conflictsFor(actor, posts));
  await db.insert(migrationImports).values({ workspaceId: actor.workspaceId, uploadId: row.id, source: input.source, status: "previewed", stats: preview, createdBy: actor.userId });
  return preview;
}

/**
 * Imports every post as a draft release. Nothing existing is overwritten:
 * conflicting slugs get a suffix, and the team reviews drafts before publishing.
 */
export async function runImport(actor: Actor, input: { source: MigrationSource; uploadId: string; preserveDates: boolean; preserveFormatting: boolean }) {
  const { row, posts } = await parseUpload(actor, input.uploadId);
  const conflicts = await conflictsFor(actor, posts);
  await db.transaction(async (tx) => {
    for (const post of posts) {
      const slug = await uniqueSlug(post.title, async (candidate) =>
        Boolean((await tx.select({ id: releases.id }).from(releases).where(and(eq(releases.workspaceId, actor.workspaceId), eq(releases.slug, candidate), isNull(releases.deletedAt))).limit(1))[0]),
      );
      const body = input.preserveFormatting ? sanitizeRichText(post.body) : `<p>${escapeHtml(htmlToPlainText(post.body))}</p>`;
      await tx.insert(releases).values({
        workspaceId: actor.workspaceId,
        title: post.title,
        slug,
        summary: post.summary || htmlToPlainText(post.body).slice(0, 200),
        body,
        category: post.category ?? "Feature",
        tags: post.tags,
        sourceRefs: [{ id: `import:${row.id}`, type: "manual", label: `Imported from ${input.source}` }],
        createdBy: actor.userId,
        ...(input.preserveDates && post.date ? { createdAt: post.date } : {}),
      });
    }
    await tx.insert(migrationImports).values({
      workspaceId: actor.workspaceId,
      uploadId: row.id,
      source: input.source,
      status: "imported",
      stats: { ...summarise(input.source, row.originalName, posts, conflicts), imported: posts.length },
      createdBy: actor.userId,
    });
    await recordActivity(tx, { workspaceId: actor.workspaceId, type: "integration", message: `Imported ${posts.length} posts from ${input.source} as drafts`, link: "/app/releases?status=draft", actorUserId: actor.userId, actorName: actor.name });
  });
  return { ...summarise(input.source, row.originalName, posts, conflicts), imported: posts.length, preservedDates: input.preserveDates, preservedFormatting: input.preserveFormatting };
}
