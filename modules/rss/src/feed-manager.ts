/**
 * Feed Manager — fetches and parses RSS/Atom feeds.
 *
 * Caches the parsed feed in Redis for 15 minutes to avoid hammering sources.
 * Uses rss-parser which handles both RSS 2.0 and Atom 1.0 formats.
 */

import Parser from 'rss-parser';
import type { RedisClientType } from 'redis';
import { lookup } from 'dns/promises';
import { isIPv4, isIPv6 } from 'net';

const CACHE_TTL_SECONDS = 900; // 15 minutes

const parser = new Parser({
  timeout: 10_000,
  maxRedirects: 0, // no redirects — prevent SSRF via redirect to internal host
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

/**
 * Check whether an IPv4 address falls within private/reserved ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||                            // 0.0.0.0/8  current network
    a === 127 ||                          // 127.0.0.0/8  loopback
    a === 10 ||                           // 10.0.0.0/8  private
    (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12  private
    (a === 192 && b === 168) ||           // 192.168.0.0/16  private
    (a === 169 && b === 254) ||           // 169.254.0.0/16  link-local
    (a === 100 && b >= 64 && b <= 127)    // 100.64.0.0/10  CGNAT/shared
  );
}

/**
 * Check whether a resolved IP address is private or reserved.
 * Handles IPv4, IPv6 loopback, ULA, link-local, and IPv4-mapped IPv6.
 */
function isPrivateIP(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIPv4(ip);

  if (isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // Unique Local Addresses (fc00::/7)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local (fe80::/10)
    if (lower.startsWith('fe80')) return true;
    // IPv4-mapped IPv6 (::ffff:x.x.x.x) — extract and check the IPv4 part
    const v4match = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4match) return isPrivateIPv4(v4match[1]);
  }

  return false;
}

/**
 * Reject URLs that point at private/reserved addresses (SSRF prevention).
 *
 * Two layers of defence:
 *  1. Hostname string check — fast-reject obvious literals (localhost, 127.x, etc.)
 *  2. DNS resolution check — resolve the hostname and verify the IP is not private.
 *     This catches bypass techniques such as decimal (2130706433), hex (0x7f000001),
 *     octal (017700000001) IP representations, and domains that resolve to internal IPs.
 */
async function validateFeedUrl(feedUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    throw new Error('Invalid feed URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Feed URL must use http or https');
  }
  const hostname = parsed.hostname.toLowerCase();

  // Fast-reject well-known private hostname patterns
  if (hostname === 'localhost') {
    throw new Error('Feed URL targets a private or reserved address');
  }
  // IPv6 literals: URL.hostname wraps them in brackets (e.g. "[::1]")
  if (hostname.startsWith('[') &&
      (hostname === '[::1]' || hostname === '[::]' ||
       hostname.startsWith('[::ffff:') ||
       hostname.startsWith('[fc') || hostname.startsWith('[fd'))) {
    throw new Error('Feed URL targets a private or reserved address');
  }

  // Resolve hostname to an IP and check against private ranges.
  // This is the primary SSRF defence — it catches decimal/hex/octal IP bypasses
  // as well as domains that resolve to internal addresses.
  let address: string;
  try {
    ({ address } = await lookup(hostname.replace(/^\[|\]$/g, '')));
  } catch {
    throw new Error('Could not resolve feed URL hostname');
  }
  if (isPrivateIP(address)) {
    throw new Error('Feed URL targets a private or reserved address');
  }
}

async function fetchAndParse(feedUrl: string, maxItems: number): Promise<FeedData> {
  await validateFeedUrl(feedUrl);
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
