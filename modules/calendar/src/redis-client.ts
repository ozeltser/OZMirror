/**
 * Redis pub/sub client for the Calendar module.
 *
 * Maintains three Redis clients:
 *   publisher   — publishes module:calendar:events on the refresh interval
 *   cacheClient — GET/SET for calendar event cache (used by calendar-manager)
 *   subscriber  — subscribes to events:config:calendar; on config change:
 *                 invalidates cache, re-fetches with new config, and immediately
 *                 publishes to module:calendar:events so the browser updates live
 *
 * Publishes to module:calendar:events whenever events are refreshed.
 */

import { createClient, RedisClientType } from 'redis';
import { fetchInstanceConfig } from './config-client';
import type { CalendarConfig } from './config-client';
import { getEvents, invalidateCache } from './calendar-manager';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';

const CHANNEL = 'module:calendar:events';
const CONFIG_CHANGE_CHANNEL = 'events:config:calendar';

// Refresh interval: 15 minutes (matches cache TTL)
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

let publisher: RedisClientType | null = null;
let cacheClient: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Per-instance config map populated when /data is called
const instanceConfigs = new Map<string, CalendarConfig>();

export function setInstanceConfig(instanceId: string, config: CalendarConfig): void {
  instanceConfigs.set(instanceId, config);
}

export function getCacheClient(): RedisClientType | null {
  return cacheClient;
}

export async function connectRedis(): Promise<void> {
  const clientOptions = {
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
  };

  publisher = createClient(clientOptions) as RedisClientType;
  publisher.on('error', (err) => console.error('[redis-client] Publisher error:', err));
  await publisher.connect();

  cacheClient = createClient(clientOptions) as RedisClientType;
  cacheClient.on('error', (err) => console.error('[redis-client] Cache client error:', err));
  await cacheClient.connect();

  subscriber = createClient(clientOptions) as RedisClientType;
  subscriber.on('error', (err) => console.error('[redis-client] Subscriber error:', err));
  await subscriber.connect();
  await subscriber.subscribe(CONFIG_CHANGE_CHANNEL, async (message: string) => {
    try {
      const parsed = JSON.parse(message) as unknown;
      const instanceId = (parsed as Record<string, unknown>)?.instanceId;
      if (typeof instanceId !== 'string') {
        console.warn('[redis-client] Config-change message missing instanceId, ignoring');
        return;
      }

      // 1. Drop stale cache
      await invalidateCache(instanceId, cacheClient);

      // 2. Fetch the newly-saved config from the Config Service
      // fetchInstanceConfig never rejects — it returns DEFAULT_CONFIG on error
      const config = await fetchInstanceConfig(instanceId);
      setInstanceConfig(instanceId, config);

      // 3. Re-fetch events with new config and push to browser via WebSocket bridge
      if (config.icalUrl) {
        const events = await getEvents(
          instanceId,
          config.icalUrl,
          config.lookaheadDays,
          config.maxEvents,
          cacheClient
        );
        await publisher!.publish(
          CHANNEL,
          JSON.stringify({ instanceId, data: { events, fetchedAt: Date.now() } })
        );
        console.log(`[redis-client] Pushed updated events for ${instanceId} (config changed)`);
      }
    } catch (err) {
      console.error('[redis-client] Config-change handler error:', err);
    }
  });

  console.log('[redis-client] Connected to Redis');
}

/**
 * Start the periodic refresh loop.
 * Every REFRESH_INTERVAL_MS, re-fetches events for all known instances
 * and publishes updates to the Redis channel.
 */
export function startPublishing(): void {
  if (!publisher) {
    console.error('[redis-client] Not connected — cannot publish');
    return;
  }

  intervalHandle = setInterval(async () => {
    if (instanceConfigs.size === 0) return;

    for (const [instanceId, config] of instanceConfigs) {
      if (!config.icalUrl) continue;

      try {
        // Invalidate cache so getEvents re-fetches fresh data
        await invalidateCache(instanceId, cacheClient);

        const events = await getEvents(
          instanceId,
          config.icalUrl,
          config.lookaheadDays,
          config.maxEvents,
          cacheClient
        );

        const payload = JSON.stringify({
          instanceId,
          data: { events, fetchedAt: Date.now() },
        });

        await publisher!.publish(CHANNEL, payload);
        console.log(
          `[redis-client] Published ${events.length} events for instance ${instanceId}`
        );
      } catch (err) {
        console.error(`[redis-client] Error refreshing instance ${instanceId}:`, err);
      }
    }
  }, REFRESH_INTERVAL_MS);

  console.log(
    `[redis-client] Publishing to ${CHANNEL} every ${REFRESH_INTERVAL_MS / 60_000} min`
  );
}

export async function disconnectRedis(): Promise<void> {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (subscriber) {
    await subscriber.unsubscribe(CONFIG_CHANGE_CHANNEL);
    await subscriber.quit();
    subscriber = null;
  }
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
  if (cacheClient) {
    await cacheClient.quit();
    cacheClient = null;
  }
  console.log('[redis-client] Disconnected from Redis');
}
