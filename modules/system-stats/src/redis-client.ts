/**
 * Redis pub/sub client for the System Stats module.
 * Publishes system stats to module:system_stats:data every 5 seconds.
 */

import { createClient, RedisClientType } from 'redis';
import { collectStats } from './stats-collector';
import { SystemStatsConfig } from './config-client';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const CHANNEL = 'module:system_stats:data';

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const instanceConfigs = new Map<string, SystemStatsConfig>();

export function setInstanceConfig(instanceId: string, config: SystemStatsConfig): void {
  instanceConfigs.set(instanceId, config);
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
    if (instanceConfigs.size === 0) return;

    let stats;
    try {
      stats = await collectStats();
    } catch (err) {
      console.error('[redis-client] Failed to collect stats:', err);
      return;
    }

    for (const [instanceId] of instanceConfigs) {
      const payload = JSON.stringify({ instanceId, data: stats, timestamp: stats.timestamp });
      try {
        await publisher!.publish(CHANNEL, payload);
      } catch (err) {
        console.error('[redis-client] Publish error:', err);
      }
    }
  }, 5000);

  console.log(`[redis-client] Publishing to ${CHANNEL} every 5s`);
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

export function getPublisher(): RedisClientType | null {
  return publisher;
}
