import type { AppConfig } from "../config.ts";
import { createGeminiProvider } from "./providers/gemini.ts";
import type { AiProvider } from "./types.ts";

export function createAiProvider(config: AppConfig): AiProvider {
  if (config.aiProvider === "gemini") {
    return createGeminiProvider(config.geminiApiKey, config.geminiModel);
  }
  throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
}
