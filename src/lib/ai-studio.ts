/** AI Studio UI configuration: the suggested actions and the progress copy shown while generating. */
import type { AIAction } from "@/types";

export const suggestedAIStudioActions: AIAction[] = [
  { id: "improve", label: "Improve", instruction: "Improve clarity and flow without changing the meaning." },
  { id: "shorter", label: "Shorten", instruction: "Make this shorter while keeping the customer benefit clear." },
  { id: "expand", label: "Expand", instruction: "Expand this with helpful context for customers." },
  { id: "simplify", label: "Simplify", instruction: "Simplify the wording so anyone can follow it." },
  { id: "friendlier", label: "Customer-friendly", instruction: "Make this friendlier and focused on what customers gain." },
  { id: "benefits", label: "Benefits", instruction: "Extract the customer benefits from this draft." },
  { id: "email", label: "Email version", instruction: "Create an email version.", kind: "channel_variant", targetChannel: "email" },
  { id: "in-app", label: "In-app version", instruction: "Create an in-app version.", kind: "channel_variant", targetChannel: "in_app" },
  { id: "translate", label: "Translate", instruction: "Translate this into Spanish." },
];

export const aiGenerationSteps = [
  "Reading the release context",
  "Applying your brand voice",
  "Shaping a customer-friendly draft",
];
