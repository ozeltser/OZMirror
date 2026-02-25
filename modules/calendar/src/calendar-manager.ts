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

// Matches IPv4 private/reserved hostnames. `::1` is intentionally excluded
// here because URL.hostname returns the bracketed form `[::1]` for IPv6
// literals, which is handled separately below.
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/;

/**
 * Reject URLs that point at private/reserved addresses (SSRF prevention).
 *
 * Covers:
 *  - IPv4 loopback / RFC 1918 / link-local / unspecified (via PRIVATE_HOST_RE)
 *  - IPv6 loopback [::1] and Unique Local Addresses [fc…]/[fd…]
 *    (URL.hostname includes the square brackets for IPv6 literals)
 *
 * Note: DNS-rebinding attacks (e.g. nip.io domains that resolve to 127.x)
 * cannot be mitigated with hostname string checks alone — that would require
 * resolving DNS before each request, which is out of scope here.
 *
 * Each module owns its own copy of this check because modules are isolated
 * Docker containers with no shared source tree.
 */
function validateICalUrl(icalUrl: string): void {
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
  if (PRIVATE_HOST_RE.test(hostname)) {
    throw new Error('iCal URL targets a private or reserved address');
  }
  // IPv6 literals: URL.hostname wraps them in brackets (e.g. "[::1]").
  // Covers: loopback [::1], unspecified [::], IPv4-mapped [::ffff:*], ULA [fc*]/[fd*]
  if (hostname.startsWith('[') &&
      (hostname === '[::1]' ||
       hostname === '[::]' ||
       hostname.startsWith('[::ffff:') ||
       hostname.startsWith('[fc') ||
       hostname.startsWith('[fd'))) {
    throw new Error('iCal URL targets a private or reserved address');
  }
}

async function fetchAndParse(
  icalUrl: string,
  lookaheadDays: number,
  maxEvents: number
): Promise<CalendarEvent[]> {
  validateICalUrl(icalUrl);

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
  // Strip common iCal encoding artifacts and excessive whitespace
  return text
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}
