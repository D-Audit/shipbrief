import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AIError, type AIProvider, type AIResult, type AITask } from "./types.js";

/**
 * Claude via the official SDK. Output is constrained to the task's zod schema
 * (structured outputs) and validated by the SDK before it reaches product code.
 * The SDK retries 408/409/429/5xx and connection errors (maxRetries: 2).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model = config.AI_MODEL;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, timeout: config.AI_TIMEOUT_MS, maxRetries: 2 });
  }

  async generate<T>(task: AITask<T>): Promise<AIResult<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: task.maxTokens ?? 16000,
        // Routine copywriting: medium effort keeps latency interactive without hurting quality.
        output_config: { effort: "medium", format: zodOutputFormat(task.schema as never) },
        // If a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: task.system,
        messages: [{ role: "user", content: task.prompt }],
      });
    } catch (error) {
      throw mapError(error);
    }

    if (response.stop_reason === "refusal") {
      throw new AIError("AI_REFUSED", "The AI declined this request. Try rephrasing the content.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AIError("AI_INVALID_RESPONSE", "The AI response was cut off. Try a shorter input.", 502);
    }
    const output = response.parsed_output as T | null;
    if (output == null) {
      throw new AIError("AI_INVALID_RESPONSE", "The AI returned a response we couldn't use. Please try again.", 502);
    }
    return {
      output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}

function mapError(error: unknown): AIError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    logger.error({ status: error.status }, "Anthropic credentials rejected");
    return new AIError("AI_NOT_CONFIGURED", "The AI provider rejected ShipBrief's credentials.", 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIError("AI_RATE_LIMITED", "The AI service is busy. Please try again in a moment.", 429);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIError("AI_TIMEOUT", "The AI took too long to respond. Please try again.", 504);
  }
  if (error instanceof Anthropic.BadRequestError) {
    logger.error({ err: error }, "Anthropic rejected the request");
    return new AIError("AI_UPSTREAM_ERROR", "The AI couldn't process this request.", 502);
  }
  if (error instanceof Anthropic.APIError) {
    logger.error({ status: error.status, err: error }, "Anthropic API error");
    return new AIError("AI_UPSTREAM_ERROR", "The AI service returned an error. Please try again.", 502);
  }
  logger.error({ err: error }, "AI request failed");
  return new AIError("AI_UPSTREAM_ERROR", "The AI request failed. Please try again.", 502);
}
