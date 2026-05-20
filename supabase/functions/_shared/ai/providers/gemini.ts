import { buildDigestPrompt } from "../prompt.ts";
import type { AiProvider, DigestSummary } from "../types.ts";

function parseJson(text: string): DigestSummary {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(trimmed) as DigestSummary;
  if (!parsed.title || !parsed.executiveSummary || !Array.isArray(parsed.sections)) {
    throw new Error("Gemini response did not match digest schema");
  }
  return parsed;
}

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: "gemini",
    model,
    async summarizeDailyDigest(input) {
      const prompt = buildDigestPrompt(input.date, input.items.slice(0, input.maxItems));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: input.maxOutputTokens,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${body}`);
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error("Gemini response did not include text content");
      }

      return {
        digest: parseJson(text),
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount,
          outputTokens: json.usageMetadata?.candidatesTokenCount,
        },
        raw: json,
      };
    },
  };
}
