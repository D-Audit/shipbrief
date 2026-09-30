import { z } from "zod";
import { CHANNELS, IN_APP_FORMATS } from "../types/domain.js";

export const uuidParam = z.object({ id: z.uuid("Not a valid id.") });

export const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address.");
export const name = z.string().trim().min(1, "Enter a name.").max(120);
export const shortText = (max = 200) => z.string().trim().max(max);
export const richText = z.string().max(200_000);
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full http(s) URL.");

/** CTA links may be absolute URLs or app-relative paths (e.g. "/settings/appearance"). */
export const linkTarget = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value.startsWith("/") ? !value.startsWith("//") : /^https?:\/\//i.test(value), "Use a full URL or a path starting with /.");

export const channel = z.enum(CHANNELS);
export const channels = z.array(channel).max(CHANNELS.length).transform((value) => [...new Set(value)]);
export const tags = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((value) => [...new Set(value.map((tag) => tag.toLowerCase()))]);

export const cta = z.object({ label: shortText(60), url: linkTarget });

const variantContent = {
  title: shortText(200),
  summary: shortText(1000),
  body: richText,
  subject: shortText(200).optional(),
  previewText: shortText(300).optional(),
};

export const channelVariants = z
  .object({
    changelog: z.object({ channel: z.literal("changelog"), ...variantContent }).optional(),
    email: z.object({ channel: z.literal("email"), ...variantContent }).optional(),
    in_app: z.object({ channel: z.literal("in_app"), format: z.enum(IN_APP_FORMATS), ...variantContent }).optional(),
  })
  .strict();

export const booleanQuery = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");
