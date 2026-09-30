import { z } from "zod";

/** Output contracts for each AI task. Kept to plain types so they map cleanly to structured outputs. */

export const releaseDraftSchema = z.object({
  title: z.string().describe("Customer-facing release title, under 70 characters"),
  summary: z.string().describe("One or two sentences leading with the customer benefit"),
  bodyHtml: z.string().describe("Release body as simple HTML using only <p>, <ul>, <li>, <strong>, <em>"),
});

export const rewriteSchema = z.object({
  contentHtml: z.string().describe("The rewritten text as simple HTML using only <p>, <ul>, <li>, <strong>, <em>"),
  summary: z.string().describe("A 2-5 word label describing the change, e.g. 'Shortened version'"),
});

export const channelVariantSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string().describe("Channel-appropriate body as simple HTML"),
  subject: z.string().nullable().describe("Email subject line; null for non-email channels"),
  previewText: z.string().nullable().describe("Email inbox preview text; null for non-email channels"),
});

export const qualityReportSchema = z.object({
  score: z.number().int().describe("Overall readiness score from 0 to 100"),
  issues: z.array(
    z.object({
      id: z.string().describe("Short kebab-case identifier"),
      severity: z.enum(["info", "warning"]),
      title: z.string(),
      detail: z.string(),
      suggestion: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
});

export const clusterSchema = z.object({
  clusters: z.array(
    z.object({
      title: z.string().describe("2-4 word theme name"),
      topNeed: z.string().describe("The underlying customer need in one short sentence"),
      demand: z.enum(["low", "medium", "high"]),
      representativeQuotes: z.array(z.string()).describe("Up to 3 short quotes taken from the requests"),
      feedbackIds: z.array(z.string()).describe("Ids of the requests in this theme"),
    }),
  ),
});

export const changeSummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string(),
  category: z.enum(["Feature", "Improvement", "Fix"]),
});

export type ReleaseDraft = z.infer<typeof releaseDraftSchema>;
export type RewriteOutput = z.infer<typeof rewriteSchema>;
export type ChannelVariantOutput = z.infer<typeof channelVariantSchema>;
export type QualityReport = z.infer<typeof qualityReportSchema>;
export type ClusterOutput = z.infer<typeof clusterSchema>;
export type ChangeSummary = z.infer<typeof changeSummarySchema>;
