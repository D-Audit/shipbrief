import type { Release } from "@/types";

/**
 * Turns a release's saved email variant into campaign-ready defaults. A
 * campaign remains independently editable after creation, while a future API
 * can use this same boundary to read the selected channel variant.
 */
export function getEmailCampaignDefaults(release: Release) {
  const variant = release.channelVariants?.email;

  return {
    subject:
      variant?.subject?.trim() ||
      variant?.title?.trim() ||
      `${release.title} is here`,
    previewText:
      variant?.previewText?.trim() ||
      variant?.summary.trim() ||
      release.summary,
    body: variant?.body || release.body,
    fromVariant: Boolean(variant),
  };
}
