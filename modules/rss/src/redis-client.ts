/**
 * Redis pub/sub client for the RSS module.
 *
 * Maintains a publisher (pub/sub) and a cache client (GET/SET).
 * Publishes to module:rss:data every 15 minutes.
 *
 * Published message shape:
 *   { instanceId: string, data: FeedData }
 */

import { createClient, RedisClientType } from 'redis';
import type { RssConfig } from './config-client';
import { getFeed, invalidateCache } from './feed-manager';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';

const CHANNEL = 'module:rss:data';

// Refresh interval: 15 minutes (matches cache TTL)
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

let publisher: RedisClientType | null = null;
let cacheClient: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Per-instance config map populated when /data is called
const instanceConfigs = new Map<string, RssConfig>();

export function setInstanceConfig(instanceId: string, config: RssConfig): void {
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

  console.log('[redis-client] Connected to Redis');
}

/**
 * Start the periodic refresh loop.
 * Every REFRESH_INTERVAL_MS, re-fetches feeds for all known instances
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
      if (!config.feedUrl) continue;

      try {
        await invalidateCache(instanceId, cacheClient);

        const feedData = await getFeed(
          instanceId,
          config.feedUrl,
          config.maxItems,
          cacheClient
        );

        const payload = JSON.stringify({ instanceId, data: feedData });
        await publisher!.publish(CHANNEL, payload);
        console.log(
          `[redis-client] Published ${feedData.items.length} items for instance ${instanceId}`
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
