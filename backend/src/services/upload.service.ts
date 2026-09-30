import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { uploads } from "../database/schema.js";
import { storage } from "../integrations/storage/index.js";
import { badRequest, notFound } from "../utils/errors.js";
import type { Actor } from "../utils/http.js";

export type UploadPurpose = "logo" | "favicon" | "media" | "import";

const LIMITS: Record<UploadPurpose, number> = { logo: 2 * 1024 * 1024, favicon: 512 * 1024, media: 10 * 1024 * 1024, import: 5 * 1024 * 1024 };
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(LIMITS));

const IMAGE_TYPES: Record<UploadPurpose, string[]> = {
  logo: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  favicon: ["image/png", "image/x-icon", "image/svg+xml"],
  media: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  import: ["text/csv", "application/json"],
};
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/x-icon": "ico", "image/svg+xml": "svg", "text/csv": "csv", "application/json": "json" };

/** Detects the real type from the bytes — the client's filename and MIME type are never trusted. */
export function sniffContentType(buffer: Buffer, originalName: string): string | null {
  const hex = buffer.subarray(0, 12).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("47494638")) return "image/gif";
  if (hex.startsWith("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (hex.startsWith("00000100")) return "image/x-icon";
  if (hex.startsWith("504b0304")) return "application/zip";

  const text = buffer.toString("utf8");
  if (text.includes("�")) return null; // not valid UTF-8 text
  const head = text.trimStart().slice(0, 500).toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  if (/\.json$/i.test(originalName) || head.startsWith("{") || head.startsWith("[")) {
    try {
      JSON.parse(text);
      return "application/json";
    } catch {
      return null;
    }
  }
  if (/\.csv$/i.test(originalName)) return "text/csv";
  return null;
}

/** SVGs can carry script. Only static, self-contained SVGs are accepted. */
function assertSafeSvg(buffer: Buffer) {
  const text = buffer.toString("utf8").toLowerCase();
  if (/<script|<foreignobject|<!entity|<!doctype|\son\w+\s*=|javascript:|data:text\/html|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)/.test(text)) {
    throw badRequest("UNSAFE_FILE", "This SVG contains scripts or external references. Export a plain SVG or use PNG.");
  }
}

export async function storeUpload(actor: Actor, input: { purpose: UploadPurpose; buffer: Buffer; originalName: string }) {
  if (input.buffer.length === 0) throw badRequest("EMPTY_FILE", "The file is empty.");
  if (input.buffer.length > LIMITS[input.purpose]) {
    throw badRequest("FILE_TOO_LARGE", `That file is too large. The limit is ${Math.round(LIMITS[input.purpose] / 1024)} KB.`);
  }
  const contentType = sniffContentType(input.buffer, input.originalName);
  if (contentType === "application/zip") throw badRequest("UNSUPPORTED_FILE", "ZIP archives aren't supported yet. Upload the CSV or JSON export directly.");
  if (!contentType || !IMAGE_TYPES[input.purpose].includes(contentType)) {
    throw badRequest("UNSUPPORTED_FILE", `Upload one of: ${IMAGE_TYPES[input.purpose].map((type) => EXTENSIONS[type]).join(", ")}.`);
  }
  if (contentType === "image/svg+xml") assertSafeSvg(input.buffer);

  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const key = `${actor.workspaceId}/${input.purpose}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
  await storage.put(key, input.buffer, contentType);
  const safeName = input.originalName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";
  const [row] = await db
    .insert(uploads)
    .values({ workspaceId: actor.workspaceId, uploadedBy: actor.userId, purpose: input.purpose, storageKey: key, contentType, sizeBytes: input.buffer.length, originalName: safeName, sha256 })
    .returning();
  return { id: row!.id, url: storage.url(key), contentType, size: row!.sizeBytes, name: safeName };
}

/** Serves a locally stored file by key. Imports are private and never served publicly. */
export async function readPublicFile(key: string) {
  const [row] = await db.select().from(uploads).where(eq(uploads.storageKey, key)).limit(1);
  if (!row || row.purpose === "import") throw notFound("FILE_NOT_FOUND", "File not found.");
  const body = await storage.get(key);
  if (!body) throw notFound("FILE_NOT_FOUND", "File not found.");
  return { body, contentType: row.contentType };
}

export async function readWorkspaceUpload(actor: Actor, id: string) {
  const [row] = await db.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.workspaceId, actor.workspaceId))).limit(1);
  if (!row) throw notFound("UPLOAD_NOT_FOUND", "That file is no longer available. Upload it again.");
  const body = await storage.get(row.storageKey);
  if (!body) throw notFound("UPLOAD_NOT_FOUND", "That file is no longer available. Upload it again.");
  return { row, body };
}
