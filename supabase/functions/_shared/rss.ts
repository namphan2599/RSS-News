import { XMLParser } from "fast-xml-parser";
import { cleanDescription } from "./html.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

export interface ParsedFeedItem {
  title: string;
  url: string;
  description: string;
  publishedAt: string | null;
  contentHash: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  items: ParsedFeedItem[];
}

type FeedNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true,
});

function getText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    const record = value as FeedNode;
    const text = record["#text"] ?? record["__cdata"];
    return getText(text);
  }

  return "";
}

function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function getRssLink(channel: FeedNode): string {
  return getText(firstValue(channel.link));
}

function getItemLink(item: FeedNode): string {
  const link = firstValue(item.link);

  if (link && typeof link === "object") {
    const record = link as FeedNode;
    return getText(record["@_href"] ?? record["#text"] ?? record);
  }

  return getText(link);
}

function getChannel(parsed: FeedNode): FeedNode {
  const rss = parsed.rss as FeedNode | undefined;
  const channel = firstValue(rss?.channel ?? parsed.channel);

  if (channel && typeof channel === "object") {
    return channel as FeedNode;
  }

  throw new Error("RSS feed is missing a channel");
}

export async function parseFeed(xml: string): Promise<ParsedFeed> {
  const parsed = parser.parse(xml) as FeedNode;
  const channel = getChannel(parsed);
  const title = getText(channel.title);
  const siteUrl = normalizeUrl(getRssLink(channel));
  const items = await Promise.all(
    asArray(channel.item).map(async (itemNode): Promise<ParsedFeedItem> => {
      const item = itemNode as FeedNode;
      const itemTitle = getText(item.title);
      const url = normalizeUrl(getItemLink(item));
      const rawDescription = getText(
        item.description ?? item["content:encoded"] ?? item.summary,
      );
      const description = cleanDescription(rawDescription);
      const publishedAt = parseDate(getText(item.pubDate ?? item.published));
      const contentHash = await buildContentHash(
        [itemTitle, url, description, publishedAt ?? ""].join("\n"),
      );

      return {
        contentHash,
        description,
        publishedAt,
        title: itemTitle,
        url,
      };
    }),
  );

  return {
    items,
    siteUrl,
    title,
  };
}
