import { config } from "../config/env.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { DevProvider } from "./dev.provider.js";
import { AIError, type AIProvider } from "./types.js";

class UnconfiguredProvider implements AIProvider {
  readonly name = "none";
  readonly model = "none";
  async generate(): Promise<never> {
    throw new AIError("AI_NOT_CONFIGURED", "AI features aren't configured for this workspace yet (set ANTHROPIC_API_KEY).", 503);
  }
}

function createProvider(): AIProvider {
  if (config.aiProvider === "anthropic") {
    return config.ANTHROPIC_API_KEY ? new AnthropicProvider(config.ANTHROPIC_API_KEY) : new UnconfiguredProvider();
  }
  if (config.aiProvider === "dev") return new DevProvider();
  return new UnconfiguredProvider();
}

export let aiProvider: AIProvider = createProvider();

/** Test hook: swap the provider (e.g. to simulate failures). */
export function setAIProvider(provider: AIProvider) {
  aiProvider = provider;
}

export * from "./types.js";
