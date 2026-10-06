import type { Channel, ChannelVariant, InAppFormat } from "@/types";

export type StudioScope = "master" | Channel;

export type StudioDraft = Pick<
  ChannelVariant,
  "title" | "summary" | "body" | "subject" | "previewText"
> & {
  
  format?: InAppFormat;
};

export type AIGeneration = {
  id: string;
  status: "generating" | "success" | "error";
  kind: "rewrite" | "channel_variant";
  scope: StudioScope;
  prompt: string;
  summary?: string;
  contextSummary?: string;
  before: StudioDraft;
  proposal?: StudioDraft;
  error?: string;
  attempt: number;
};
