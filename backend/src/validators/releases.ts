import { z } from "zod";
import { RELEASE_STATUSES } from "../types/domain.js";
import { channels, channelVariants, cta, httpUrl, linkTarget, richText, shortText, tags } from "./common.js";

const sourceRef = z.object({
  id: shortText(100),
  type: z.enum(["github", "linear", "gitlab", "jira", "manual"]),
  label: shortText(200),
  // Rendered as a link in the editor, so only http(s) URLs are accepted (no javascript: etc.).
  url: z.union([httpUrl, z.literal("")]).transform((value) => value || undefined).optional(),
});

const media = z.object({
  id: shortText(100),
  type: z.enum(["image", "video"]),
  url: linkTarget,
  alt: shortText(300).optional(),
  caption: shortText(300).optional(),
  posterUrl: linkTarget.optional(),
});

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes for the URL slug.")
  .max(80);

/**
 * Editable release fields. Anything not listed here (status, counters,
 * publishedBy, timestamps…) is stripped, so clients can send back the whole
 * release object without being able to mass-assign server-owned fields.
 */
const editable = {
  title: shortText(200).min(1, "Give the release a title."),
  summary: shortText(1000),
  body: richText,
  channels,
  category: shortText(40).min(1),
  tags,
  audienceId: z.uuid().nullable(),
  sourceRefs: z.array(sourceRef).max(50),
  cta: cta.nullable(),
  media: z.array(media).max(20),
  channelVariants,
  seo: z.object({ title: shortText(200).optional(), description: shortText(400).optional() }).nullable(),
  featured: z.boolean(),
  slug,
};

const editableSchema = z.object(editable);

/** Omitted fields fall back to service defaults (title "Untitled release", channels ["changelog"], …). */
export const createReleaseSchema = editableSchema.partial();
export const updateReleaseSchema = editableSchema.partial().extend({ changeNote: shortText(200).optional() });

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof updateReleaseSchema>;

export const listReleasesQuery = z.object({
  status: z.enum(RELEASE_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(40).optional(),
  tag: z.string().trim().max(40).optional(),
  channel: z.enum(["changelog", "email", "in_app"]).optional(),
  sort: z.enum(["updated", "newest", "oldest", "published"]).default("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

export const scheduleSchema = z.object({ scheduledAt: z.iso.datetime({ offset: true, message: "Choose a valid schedule date." }) });
export const requestChangesSchema = z.object({ note: z.string().trim().max(1000).optional() });
export const restoreVersionParams = z.object({ id: z.uuid(), versionId: z.uuid() });
