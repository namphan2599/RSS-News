import { buildDigestPrompt } from "../prompt.ts";
import type { AiProvider, DigestSummary } from "../types.ts";

function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Gemini response field ${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`Gemini response field ${path} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Gemini response field ${path} must not be empty`);
  }
  return trimmed;
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Gemini response field ${path} must be an array`);
  }
  return value;
}

export function parseGeminiDigestJson(text: string): DigestSummary {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "")
    .trim();
  const parsed = assertRecord(JSON.parse(trimmed), "root");
  const sections = readArray(parsed.sections, "sections").map(
    (sectionValue, sectionIndex) => {
      const sectionPath = `sections[${sectionIndex}]`;
      const section = assertRecord(sectionValue, sectionPath);
      const bullets = readArray(section.bullets, `${sectionPath}.bullets`).map(
        (bulletValue, bulletIndex) => {
          const bulletPath = `${sectionPath}.bullets[${bulletIndex}]`;
          const bullet = assertRecord(bulletValue, bulletPath);
          return {
            title: readString(bullet.title, `${bulletPath}.title`),
            summary: readString(bullet.summary, `${bulletPath}.summary`),
            url: readString(bullet.url, `${bulletPath}.url`),
            source: readString(bullet.source, `${bulletPath}.source`),
          };
        },
      );

      return {
        heading: readString(section.heading, `${sectionPath}.heading`),
        bullets,
      };
    },
  );

  const digest: DigestSummary = {
    title: readString(parsed.title, "title"),
    executiveSummary: readString(parsed.executiveSummary, "executiveSummary"),
    sections,
  };

  if (parsed.moreLinks !== undefined) {
    digest.moreLinks = readArray(parsed.moreLinks, "moreLinks").map(
      (linkValue, linkIndex) => {
        const linkPath = `moreLinks[${linkIndex}]`;
        const link = assertRecord(linkValue, linkPath);
        return {
          title: readString(link.title, `${linkPath}.title`),
          url: readString(link.url, `${linkPath}.url`),
          source: readString(link.source, `${linkPath}.source`),
        };
      },
    );
  }

  return digest;
}

export function createGeminiProvider(
  apiKey: string,
  model: string,
): AiProvider {
  return {
    name: "gemini",
    model,
    async summarizeDailyDigest(input) {
      const prompt = buildDigestPrompt(
        input.date,
        input.items.slice(0, input.maxItems),
      );
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
        digest: parseGeminiDigestJson(text),
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount,
          outputTokens: json.usageMetadata?.candidatesTokenCount,
        },
        raw: json,
      };
    },
  };
}
