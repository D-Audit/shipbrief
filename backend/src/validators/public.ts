import { z } from "zod";
import { email, shortText, tags } from "./common.js";

export const workspaceParam = z.object({ workspace: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,60}$/, "Workspace not found.") });
export const releaseParam = workspaceParam.extend({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/, "Update not found.") });
export const widgetParam = z.object({ key: z.string().trim().regex(/^sb_[a-z0-9]{1,12}_[0-9a-f]{8}$/, "Widget not found.") });
export const widgetReleaseParam = widgetParam.extend({ releaseId: z.uuid() });

export const publicListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(40).optional(),
  category: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const publicCommentSchema = z.object({
  author: shortText(80).optional(),
  body: shortText(1000).min(1, "Write a comment before posting it."),
});

export const publicFeedbackSchema = z.object({
  title: shortText(200).min(3, "Give your request a short title."),
  description: shortText(5000).default(""),
  email: email.optional().or(z.literal("").transform(() => undefined)),
  name: shortText(80).optional(),
  tags: tags.optional(),
  /** Honeypot: humans never see or fill this field. */
  website: z.string().max(0, "Submission rejected.").optional(),
});

export const viewSchema = z.object({ slug: z.string().trim().toLowerCase().max(100).nullable().optional() });
export const subscribeSchema = z.object({ email, source: z.enum(["changelog", "widget"]).default("changelog") });
export const subscribeConfirmQuery = z.object({ token: z.string().max(600).default("") });
export const unsubscribeQuery = z.object({ c: z.string().max(40).default(""), t: z.string().max(64).default("") });
export const widgetListQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

export const contactSchema = z
  .object({
    externalId: shortText(200).optional(),
    email: email.optional(),
    name: shortText(120).optional(),
    plan: shortText(40).optional(),
    tags: tags.optional(),
    signedUpAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => value.externalId || value.email, "Provide an externalId or an email.");

/** A signed-in user of the customer's product, sent by the widget with the HMAC their server computed. */
export const widgetIdentifySchema = z.object({
  user: z.object({
    id: z.coerce.string().trim().min(1, "user.id is required.").max(200),
    email: email.optional().or(z.literal("").transform(() => undefined)),
    name: shortText(120).optional(),
    plan: shortText(40).optional(),
    tags: tags.optional(),
    signedUpAt: z.iso.datetime({ offset: true }).optional(),
  }),
  userHash: z.string().trim().regex(/^[0-9a-f]{64}$/i, "userHash must be the hex HMAC-SHA256 of user.id."),
});
export const widgetSubscriptionSchema = z.object({ subscribed: z.boolean() });
