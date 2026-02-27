/**
 * Calendar Manager — iCal fetch, parse, and Redis caching.
 *
 * Fetches a public iCal (.ics) URL, parses VEVENT records (including
 * recurring events via RRULE), filters to the configured lookahead window,
 * and caches the result in Redis for 15 minutes to avoid hammering the source.
 */

import axios from 'axios';
import * as ical from 'node-ical';
import type { RedisClientType } from 'redis';
import { lookup } from 'dns/promises';
import { isIPv4, isIPv6 } from 'net';

const CACHE_TTL_SECONDS = 900; // 15 minutes

export interface CalendarEvent {
  uid: string;
  title: string;
  start: string;  // ISO 8601
  end: string;    // ISO 8601
  allDay: boolean;
  location?: string;
  description?: string;
}

/**
 * Fetch and parse upcoming events for one instance.
 *
 * Checks Redis cache first. On miss (or if no redis client provided),
 * fetches the iCal URL and parses it.
 *
 * @param instanceId    - Widget instance ID (used as cache key)
 * @param icalUrl       - Public iCal URL to fetch
 * @param lookaheadDays - How many days ahead to include
 * @param maxEvents     - Maximum number of events to return
 * @param redis         - Optional Redis client for caching
 */
export async function getEvents(
  instanceId: string,
  icalUrl: string,
  lookaheadDays: number,
  maxEvents: number,
  redis: RedisClientType | null
): Promise<CalendarEvent[]> {
  const cacheKey = `calendar:events:${instanceId}`;

  // Try cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CalendarEvent[];
      }
    } catch (err) {
      console.warn('[calendar-manager] Cache read error:', err);
    }
  }

  // Fetch and parse
  const events = await fetchAndParse(icalUrl, lookaheadDays, maxEvents);

  // Store in cache
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(events), { EX: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('[calendar-manager] Cache write error:', err);
    }
  }

  return events;
}

/**
 * Invalidate the cache for a specific instance.
 * Called when config changes so the next request re-fetches.
 */
export async function invalidateCache(
  instanceId: string,
  redis: RedisClientType | null
): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`calendar:events:${instanceId}`);
  } catch (err) {
    console.warn('[calendar-manager] Cache invalidation error:', err);
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
 *  1. Hostname string check — fast-reject obvious literals (localhost, [::1], etc.)
 *  2. DNS resolution check — resolve the hostname and verify the IP is not private.
 *     This catches bypass techniques such as decimal (2130706433), hex (0x7f000001),
 *     octal (017700000001) IP representations, and domains that resolve to internal IPs.
 *
 * Each module owns its own copy of this check because modules are isolated
 * Docker containers with no shared source tree.
 */
async function validateICalUrl(icalUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(icalUrl);
  } catch {
    throw new Error('Invalid iCal URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('iCal URL must use http or https');
  }
  const hostname = parsed.hostname.toLowerCase();

  // Fast-reject well-known private hostname patterns
  if (hostname === 'localhost') {
    throw new Error('iCal URL targets a private or reserved address');
  }
  // IPv6 literals: URL.hostname wraps them in brackets (e.g. "[::1]")
  if (hostname.startsWith('[') &&
      (hostname === '[::1]' || hostname === '[::]' ||
       hostname.startsWith('[::ffff:') ||
       hostname.startsWith('[fc') || hostname.startsWith('[fd'))) {
    throw new Error('iCal URL targets a private or reserved address');
  }

  // Resolve hostname to an IP and check against private ranges.
  // This is the primary SSRF defence — it catches decimal/hex/octal IP bypasses
  // as well as domains that resolve to internal addresses.
  let address: string;
  try {
    ({ address } = await lookup(hostname.replace(/[\[\]]/g, '')));
  } catch {
    throw new Error('Could not resolve iCal URL hostname');
  }
  if (isPrivateIP(address)) {
    throw new Error('iCal URL targets a private or reserved address');
  }
}

async function fetchAndParse(
  icalUrl: string,
  lookaheadDays: number,
  maxEvents: number
): Promise<CalendarEvent[]> {
  await validateICalUrl(icalUrl);

  // Fetch the raw iCal text
  let icalText: string;
  try {
    const response = await axios.get<string>(icalUrl, {
      timeout: 10_000,
      maxRedirects: 0, // no redirects — prevent SSRF via redirect to internal host
      responseType: 'text',
      headers: { 'User-Agent': 'OzMirror/1.0 (calendar module)' },
    });
    icalText = response.data;
  } catch (err) {
    console.error('[calendar-manager] Failed to fetch iCal URL:', err);
    throw new Error('Failed to fetch calendar feed');
  }

  // Parse with node-ical (sync parse from string)
  let parsed: ical.CalendarResponse;
  try {
    parsed = ical.sync.parseICS(icalText);
  } catch (err) {
    console.error('[calendar-manager] Failed to parse iCal data:', err);
    throw new Error('Failed to parse calendar feed');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  const events: CalendarEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];

    // Only process VEVENT components
    if (component.type !== 'VEVENT') continue;

    const event = component as ical.VEvent;

    // Handle recurring events expanded by node-ical
    if (event.rrule) {
      const occurrences = expandRecurring(event, now, cutoff);
      events.push(...occurrences);
    } else {
      const entry = extractEvent(event);
      if (entry && isInWindow(entry, now, cutoff)) {
        events.push(entry);
      }
    }
  }

  // Sort by start time ascending and cap
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events.slice(0, maxEvents);
}

function extractEvent(event: ical.VEvent): CalendarEvent | null {
  const start = event.start;
  const end = event.end ?? event.start;

  if (!start) return null;

  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);

  // Detect all-day events: node-ical sets datetype='date' for DATE values
  const allDay = (event as unknown as { datetype?: string }).datetype === 'date';

  return {
    uid: event.uid ?? String(Math.random()),
    title: sanitizeText(event.summary ?? 'Untitled'),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    allDay,
    location: event.location ? sanitizeText(event.location) : undefined,
    description: event.description ? sanitizeText(event.description).slice(0, 200) : undefined,
  };
}

function expandRecurring(
  event: ical.VEvent,
  windowStart: Date,
  windowEnd: Date
): CalendarEvent[] {
  const results: CalendarEvent[] = [];

  try {
    const rule = event.rrule;
    if (!rule) return results;

    // Get occurrences within the window
    const occurrences = rule.between(windowStart, windowEnd, true);

    for (const occ of occurrences) {
      const duration =
        event.end && event.start
          ? (event.end instanceof Date ? event.end : new Date(event.end)).getTime() -
            (event.start instanceof Date ? event.start : new Date(event.start)).getTime()
          : 0;

      const endDate = new Date(occ.getTime() + duration);

      results.push({
        uid: `${event.uid ?? 'recurring'}_${occ.toISOString()}`,
        title: sanitizeText(event.summary ?? 'Untitled'),
        start: occ.toISOString(),
        end: endDate.toISOString(),
        allDay: (event as unknown as { datetype?: string }).datetype === 'date',
        location: event.location ? sanitizeText(event.location) : undefined,
        description: event.description ? sanitizeText(event.description).slice(0, 200) : undefined,
      });
    }
  } catch (err) {
    console.warn('[calendar-manager] Error expanding recurring event:', err);
  }

  return results;
}

function isInWindow(event: CalendarEvent, now: Date, cutoff: Date): boolean {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);
  // Include events that haven't ended yet and start before the cutoff
  return eventEnd >= now && eventStart <= cutoff;
}

function sanitizeText(text: string): string {
  // Strip HTML tags first (iCal descriptions can contain HTML)
  return text
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Strip common iCal encoding artifacts
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}
