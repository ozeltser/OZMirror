/**
 * Feed Manager — fetches and parses RSS/Atom feeds.
 *
 * Caches the parsed feed in Redis for 15 minutes to avoid hammering sources.
 * Uses rss-parser which handles both RSS 2.0 and Atom 1.0 formats.
 */

import Parser from 'rss-parser';
import type { RedisClientType } from 'redis';

const CACHE_TTL_SECONDS = 900; // 15 minutes

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'OzMirror/1.0 (rss module)' },
  customFields: {
    item: [['media:content', 'mediaContent', { keepArray: false }]],
  },
});

export interface FeedItem {
  guid: string;
  title: string;
  link?: string;
  description?: string; // plain-text excerpt, HTML stripped
  pubDate?: string;     // ISO 8601
}

export interface FeedData {
  feedTitle: string;
  items: FeedItem[];
  fetchedAt: number;
}

/**
 * Fetch and parse a feed, with Redis caching.
 */
export async function getFeed(
  instanceId: string,
  feedUrl: string,
  maxItems: number,
  redis: RedisClientType | null
): Promise<FeedData> {
  const cacheKey = `rss:feed:${instanceId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as FeedData;
    } catch (err) {
      console.warn('[feed-manager] Cache read error:', err);
    }
  }

  const data = await fetchAndParse(feedUrl, maxItems);

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('[feed-manager] Cache write error:', err);
    }
  }

  return data;
}

/**
 * Invalidate the cached feed for a specific instance.
 */
export async function invalidateCache(
  instanceId: string,
  redis: RedisClientType | null
): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`rss:feed:${instanceId}`);
  } catch (err) {
    console.warn('[feed-manager] Cache invalidation error:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1$)/;

function validateFeedUrl(feedUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    throw new Error('Invalid feed URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Feed URL must use http or https');
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname.toLowerCase())) {
    throw new Error('Feed URL targets a private or reserved address');
  }
}

async function fetchAndParse(feedUrl: string, maxItems: number): Promise<FeedData> {
  validateFeedUrl(feedUrl);
  let feed: Awaited<ReturnType<typeof parser.parseURL>>;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (err) {
    console.error('[feed-manager] Failed to fetch/parse feed:', err);
    throw new Error('Failed to fetch or parse the RSS feed');
  }

  const items: FeedItem[] = (feed.items ?? []).slice(0, maxItems).map((item, i) => ({
    guid: item.guid ?? item.link ?? String(i),
    title: stripHtml(item.title ?? 'Untitled'),
    link: item.link,
    description: item.contentSnippet
      ? stripHtml(item.contentSnippet).slice(0, 200)
      : item.summary
        ? stripHtml(item.summary).slice(0, 200)
        : undefined,
    pubDate: (() => {
      if (!item.pubDate) return undefined;
      const d = new Date(item.pubDate);
      return !isNaN(d.getTime()) ? d.toISOString() : undefined;
    })(),
  }));

  return {
    feedTitle: stripHtml(feed.title ?? 'RSS Feed'),
    items,
    fetchedAt: Date.now(),
  };
}

function stripHtml(text: string): string {
  return text
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '') // handles > inside quoted attributes
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
