const TRACKING_PARAMS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
]);

function isTrackingParam(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.startsWith("utm_") || TRACKING_PARAMS.has(lowerName);
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/(\?|$)/, "$1");
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeUrl(url: string): string {
  const trimmedUrl = url.trim();

  try {
    const parsedUrl = new URL(trimmedUrl);
    parsedUrl.hash = "";

    const keys: string[] = [];
    parsedUrl.searchParams.forEach((_value, key) => keys.push(key));

    for (const key of keys) {
      if (isTrackingParam(key)) {
        parsedUrl.searchParams.delete(key);
      }
    }

    parsedUrl.searchParams.sort();
    return removeTrailingSlash(parsedUrl.toString());
  } catch {
    return removeTrailingSlash(trimmedUrl.split("#", 1)[0] ?? trimmedUrl);
  }
}

export interface ContentHashInput {
  feedId: string;
  guid?: string | null;
  url: string;
  title: string;
  publishedAt?: string | null;
}

export async function buildContentHash(input: ContentHashInput): Promise<string> {
  const content = [
    input.feedId,
    input.guid?.trim() || normalizeUrl(input.url),
    normalizeTitle(input.title),
    input.publishedAt ?? "",
  ].join("|");
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashBytes = [...new Uint8Array(hashBuffer)];

  return hashBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
