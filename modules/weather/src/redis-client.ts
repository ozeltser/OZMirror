/**
 * Redis pub/sub client for the Weather module.
 *
 * Maintains a publisher (pub/sub) and a cache client (GET/SET).
 * Publishes to module:weather:data every 10 minutes.
 *
 * Published message shape:
 *   { instanceId: string, data: WeatherData }
 */

import { createClient, RedisClientType } from 'redis';
import type { WeatherConfig } from './config-client';
import { getWeather, invalidateCache } from './weather-manager';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY ?? '';

const CHANNEL = 'module:weather:data';

// Refresh interval: 10 minutes (matches cache TTL)
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let publisher: RedisClientType | null = null;
let cacheClient: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setTimeout> | null = null;

// Per-instance config map; entries carry a lastSeenAt timestamp for TTL pruning
const instanceConfigs = new Map<string, { config: WeatherConfig; lastSeenAt: number }>();

export function setInstanceConfig(instanceId: string, config: WeatherConfig): void {
  instanceConfigs.set(instanceId, { config, lastSeenAt: Date.now() });
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
 * Every REFRESH_INTERVAL_MS, re-fetches weather for all known instances
 * and publishes updates to the Redis channel.
 */
export function startPublishing(): void {
  if (!publisher) {
    console.error('[redis-client] Not connected — cannot publish');
    return;
  }

  const tick = async () => {
    // Prune instances not seen within the last 2 refresh intervals
    const cutoff = Date.now() - 2 * REFRESH_INTERVAL_MS;
    for (const [id, entry] of instanceConfigs) {
      if (entry.lastSeenAt < cutoff) {
        instanceConfigs.delete(id);
        console.log(`[redis-client] Pruned stale instance ${id}`);
      }
    }

    for (const [instanceId, { config }] of instanceConfigs) {
      try {
        await invalidateCache(instanceId, cacheClient);

        const weatherData = await getWeather(
          instanceId,
          config.city,
          config.units,
          WEATHER_API_KEY,
          cacheClient
        );

        const payload = JSON.stringify({ instanceId, data: weatherData });
        await publisher!.publish(CHANNEL, payload);
        console.log(`[redis-client] Published weather for instance ${instanceId}`);
      } catch (err) {
        console.error(`[redis-client] Error refreshing instance ${instanceId}:`, err);
      }
    }

    intervalHandle = setTimeout(tick, REFRESH_INTERVAL_MS);
  };

  intervalHandle = setTimeout(tick, REFRESH_INTERVAL_MS);

  console.log(
    `[redis-client] Publishing to ${CHANNEL} every ${REFRESH_INTERVAL_MS / 60_000} min`
  );
}

export async function disconnectRedis(): Promise<void> {
  if (intervalHandle !== null) {
    clearTimeout(intervalHandle);
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
