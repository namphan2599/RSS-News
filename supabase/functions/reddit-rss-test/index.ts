type HandlerDeps = {
  fetch: typeof fetch;
};

const defaultRedditRssUrl = "https://www.reddit.com/r/programming/.rss";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function validateUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https");
  }
  return parsed.toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRedditRssTestHandler(deps: HandlerDeps) {
  return async (request: Request): Promise<Response> => {
    let url: string;
    try {
      const requestUrl = new URL(request.url);
      url = validateUrl(requestUrl.searchParams.get("url") ?? defaultRedditRssUrl);
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, 400);
    }

    try {
      const response = await deps.fetch(url, {
        headers: {
          "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "User-Agent": "Mozilla/5.0 (compatible; RSS News Summary/0.1; +https://example.com)",
        },
      });
      const body = await response.text();

      return jsonResponse({
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        url,
        bodyPreview: body.slice(0, 500),
      }, response.ok ? 200 : 502);
    } catch (error) {
      return jsonResponse({ error: errorMessage(error), ok: false, url }, 502);
    }
  };
}

export const handler = createRedditRssTestHandler({ fetch });

if (import.meta.main) {
  Deno.serve(handler);
}
