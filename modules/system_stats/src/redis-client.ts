/**
 * Redis pub/sub client for the System Stats module.
 * Publishes system metrics to module:system_stats:update at a configurable interval.
 */

import { createClient, RedisClientType } from 'redis';
import { collectStats } from './stats-collector';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const CHANNEL = 'module:system_stats:update';
const PUBLISH_INTERVAL_MS = parseInt(process.env.STATS_INTERVAL_MS ?? '5000', 10);

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Track active instances so each gets its own payload with correct instanceId.
const activeInstances = new Set<string>();

export function trackInstance(instanceId: string): void {
  activeInstances.add(instanceId);
}

export async function connectRedis(): Promise<void> {
  publisher = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
  }) as RedisClientType;

  publisher.on('error', (err) => console.error('[redis-client] Error:', err));

  await publisher.connect();
  console.log('[redis-client] Connected to Redis');
}

export function startPublishing(): void {
  if (!publisher) {
    console.error('[redis-client] Not connected — cannot publish');
    return;
  }

  intervalHandle = setInterval(async () => {
    // If no instances tracked yet, publish a default one so the widget works
    // out of the box before any REST call registers an instance.
    const instances = activeInstances.size > 0 ? activeInstances : new Set(['system_stats_01']);
    const stats = collectStats();

    for (const instanceId of instances) {
      const payload = JSON.stringify({ instanceId, data: stats, timestamp: Date.now() });
      try {
        await publisher!.publish(CHANNEL, payload);
      } catch (err) {
        console.error('[redis-client] Publish error:', err);
      }
    }
  }, PUBLISH_INTERVAL_MS);

  console.log(`[redis-client] Publishing to ${CHANNEL} every ${PUBLISH_INTERVAL_MS}ms`);
}

export async function disconnectRedis(): Promise<void> {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (publisher) {
    await publisher.quit();
    publisher = null;
    console.log('[redis-client] Disconnected from Redis');
  }
}
