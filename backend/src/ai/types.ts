import type { z } from "zod";

/**
 * Every AI feature in ShipBrief is a named task with a typed output schema.
 * Providers only know how to turn (system, prompt, schema) into a validated
 * object; the product logic lives in `services/ai.service.ts`.
 */
export type AIOperation =
  | "generate_release"
  | "rewrite"
  | "channel_variant"
  | "quality_check"
  | "cluster_feedback"
  | "summarize_changes";

export type AITask<T> = {
  operation: AIOperation;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Structured input, used by the deterministic dev provider and stored (truncated) in generation history. */
  input: Record<string, unknown>;
  maxTokens?: number;
};

export type AIResult<T> = {
  output: T;
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
};

export class AIError extends Error {
  constructor(
    readonly code: "AI_NOT_CONFIGURED" | "AI_RATE_LIMITED" | "AI_TIMEOUT" | "AI_REFUSED" | "AI_INVALID_RESPONSE" | "AI_UPSTREAM_ERROR",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate<T>(task: AITask<T>): Promise<AIResult<T>>;
}
