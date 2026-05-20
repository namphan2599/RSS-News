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
    return parsedUrl.toString();
  } catch {
    return trimmedUrl.split("#", 1)[0] ?? trimmedUrl;
  }
}

export async function buildContentHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashBytes = [...new Uint8Array(hashBuffer)];

  return hashBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
