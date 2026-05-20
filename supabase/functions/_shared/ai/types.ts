export type DigestInputItem = {
  id: string;
  feedTitle: string;
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
};

export type DigestSummary = {
  title: string;
  executiveSummary: string;
  sections: Array<{
    heading: string;
    bullets: Array<{
      title: string;
      summary: string;
      url: string;
      source: string;
    }>;
  }>;
  moreLinks?: Array<{
    title: string;
    url: string;
    source: string;
  }>;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  name: string;
  model: string;
  summarizeDailyDigest(input: {
    date: string;
    items: DigestInputItem[];
    maxItems: number;
    maxOutputTokens: number;
  }): Promise<{
    digest: DigestSummary;
    usage?: AiUsage;
    raw?: unknown;
  }>;
}
