import { XMLParser } from "npm:fast-xml-parser@4.4.1";
import { cleanDescription } from "./html.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

export interface ParsedFeedItem {
  feedId: string;
  guid: string | null;
  title: string;
  url: string;
  normalizedUrl: string;
  description: string;
  publishedAt: string | null;
  contentHash: string;
}

export interface ParsedFeed {
  feedTitle: string | null;
  siteUrl: string | null;
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

function normalizeBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function getAtomLink(node: FeedNode): string {
  const links = asArray(node.link);
  const alternateLink =
    links.find((link) => {
      if (!link || typeof link !== "object") {
        return false;
      }

      const rel = getText((link as FeedNode)["@_rel"]);
      return rel === "" || rel === "alternate";
    }) ?? links[0];

  if (alternateLink && typeof alternateLink === "object") {
    const record = alternateLink as FeedNode;
    return getText(record["@_href"] ?? record["#text"] ?? record);
  }

  return getText(alternateLink);
}

function getChannel(parsed: FeedNode): FeedNode | null {
  const rss = parsed.rss as FeedNode | undefined;
  const channel = firstValue(rss?.channel ?? parsed.channel);

  if (channel && typeof channel === "object") {
    return channel as FeedNode;
  }

  return null;
}

function getAtomFeed(parsed: FeedNode): FeedNode | null {
  const feed = firstValue(parsed.feed);

  if (feed && typeof feed === "object") {
    return feed as FeedNode;
  }

  return null;
}

async function buildItem(params: {
  feedId: string;
  feedUrl: string;
  title: string;
  guid: string | null;
  itemUrl: string;
  rawDescription: string;
  publishedAt: string | null;
  descriptionMaxChars: number;
}): Promise<ParsedFeedItem | null> {
  const title = normalizeBlank(params.title);
  const rawUrl = normalizeBlank(params.itemUrl) ?? normalizeBlank(params.feedUrl);

  if (!title || !rawUrl) {
    return null;
  }

  const url = resolveUrl(rawUrl, params.feedUrl);
  const normalizedUrl = normalizeUrl(url);
  const description = cleanDescription(
    params.rawDescription,
    params.descriptionMaxChars,
  );
  const contentHash = await buildContentHash({
    feedId: params.feedId,
    guid: params.guid,
    publishedAt: params.publishedAt,
    title,
    url,
  });

  return {
    title,
    contentHash,
    description,
    feedId: params.feedId,
    guid: params.guid,
    normalizedUrl,
    publishedAt: params.publishedAt,
    url,
  };
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

async function parseRssFeed(
  channel: FeedNode,
  feedId: string,
  feedUrl: string,
  descriptionMaxChars: number,
): Promise<ParsedFeed> {
  const feedTitle = normalizeBlank(getText(channel.title));
  const rssLink = normalizeBlank(getRssLink(channel));
  const itemResults = await Promise.all(
    asArray(channel.item).map(async (itemNode): Promise<ParsedFeedItem | null> => {
      if (!itemNode || typeof itemNode !== "object") {
        return null;
      }

      const item = itemNode as FeedNode;
      return buildItem({
        descriptionMaxChars,
        feedId,
        feedUrl,
        guid: normalizeBlank(getText(item.guid)),
        itemUrl: getItemLink(item),
        publishedAt: parseDate(getText(item.pubDate ?? item.published)),
        rawDescription: getText(
          item.description ?? item["content:encoded"] ?? item.summary,
        ),
        title: getText(item.title),
      });
    }),
  );

  return {
    feedTitle,
    items: itemResults.filter((item): item is ParsedFeedItem => item !== null),
    siteUrl: rssLink ? normalizeUrl(rssLink) : null,
  };
}

async function parseAtomFeed(
  feed: FeedNode,
  feedId: string,
  feedUrl: string,
  descriptionMaxChars: number,
): Promise<ParsedFeed> {
  const feedTitle = normalizeBlank(getText(feed.title));
  const atomLink = normalizeBlank(getAtomLink(feed));
  const itemResults = await Promise.all(
    asArray(feed.entry).map(async (entryNode): Promise<ParsedFeedItem | null> => {
      if (!entryNode || typeof entryNode !== "object") {
        return null;
      }

      const entry = entryNode as FeedNode;
      return buildItem({
        descriptionMaxChars,
        feedId,
        feedUrl,
        guid: normalizeBlank(getText(entry.id)),
        itemUrl: getAtomLink(entry),
        publishedAt: parseDate(getText(entry.published ?? entry.updated)),
        rawDescription: getText(entry.summary ?? entry.content),
        title: getText(entry.title),
      });
    }),
  );

  return {
    feedTitle,
    items: itemResults.filter((item): item is ParsedFeedItem => item !== null),
    siteUrl: atomLink ? normalizeUrl(atomLink) : null,
  };
}

export async function parseFeed(
  xml: string,
  feedId: string,
  feedUrl: string,
  descriptionMaxChars: number,
): Promise<ParsedFeed> {
  const parsed = parser.parse(xml) as FeedNode;
  const channel = getChannel(parsed);

  if (channel) {
    return parseRssFeed(channel, feedId, feedUrl, descriptionMaxChars);
  }

  const atomFeed = getAtomFeed(parsed);

  if (atomFeed) {
    return parseAtomFeed(atomFeed, feedId, feedUrl, descriptionMaxChars);
  }

  throw new Error("Feed is missing an RSS channel or Atom feed");
}
