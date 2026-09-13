import type { AIAction } from "@/types";

export const defaultAIStudioReleaseId = "rel_1";

export const suggestedAIStudioActions: AIAction[] = [
  {
    id: "shorter",
    label: "Make this shorter",
    instruction: "Make this shorter while keeping the customer benefit clear.",
  },
  {
    id: "friendlier",
    label: "Make it friendlier",
    instruction: "Make this friendlier and more conversational.",
  },
  {
    id: "benefits",
    label: "Extract benefits",
    instruction: "Extract the customer benefits from this draft.",
  },
  {
    id: "email",
    label: "Create email version",
    instruction: "Create an email version.",
    kind: "channel_variant",
    targetChannel: "email",
  },
  {
    id: "in-app",
    label: "Create in-app version",
    instruction: "Create an in-app version.",
    kind: "channel_variant",
    targetChannel: "in_app",
  },
];

export const aiGenerationSteps = [
  "Reading the release context",
  "Applying your brand voice",
  "Shaping a customer-friendly draft",
];
