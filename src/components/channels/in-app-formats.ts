import type { InAppFormat } from "@/types";

export const inAppFormatOptions: ReadonlyArray<{
  value: InAppFormat;
  label: string;
  description: string;
}> = [
  {
    value: "feed",
    label: "Feed item",
    description: "A durable update in the What's New feed.",
  },
  {
    value: "banner",
    label: "Banner",
    description: "A wide, lightweight announcement at the top of a screen.",
  },
  {
    value: "modal",
    label: "Modal",
    description: "A focused announcement that gives the update more room.",
  },
  {
    value: "toast",
    label: "Toast",
    description: "A compact, temporary notification.",
  },
  {
    value: "contextual",
    label: "Contextual tip",
    description: "A small callout anchored near a relevant product action.",
  },
];

export function getInAppFormatLabel(format: InAppFormat) {
  return inAppFormatOptions.find((option) => option.value === format)?.label ?? "Feed item";
}
