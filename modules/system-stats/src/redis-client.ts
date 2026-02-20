/**
 * Redis pub/sub client for the System Stats module.
 * Publishes system stats to module:system_stats:data at the minimum
 * refreshInterval configured across all registered instances.
 */

import { createClient, RedisClientType } from 'redis';
import { collectStats } from './stats-collector';
import { SystemStatsConfig, DEFAULT_CONFIG } from './config-client';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const CHANNEL = 'module:system_stats:data';

// Cap on registered instances to prevent DoS via memory exhaustion.
const MAX_INSTANCES = 50;

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = DEFAULT_CONFIG.refreshInterval;

const instanceConfigs = new Map<string, SystemStatsConfig>();

function restartPublishing(intervalMs: number): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (!publisher) return;

  currentIntervalMs = intervalMs;
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
  }, intervalMs);

  console.log(`[redis-client] Publishing to ${CHANNEL} every ${intervalMs}ms`);
}

export function setInstanceConfig(instanceId: string, config: SystemStatsConfig): void {
  if (instanceConfigs.size >= MAX_INSTANCES && !instanceConfigs.has(instanceId)) {
    console.warn(
      `[redis-client] Max instances (${MAX_INSTANCES}) reached; ignoring instanceId: ${instanceId}`
    );
    return;
  }

  instanceConfigs.set(instanceId, config);

  // Use the minimum refreshInterval across all registered instances.
  const minInterval = Math.min(...[...instanceConfigs.values()].map((c) => c.refreshInterval));
  if (minInterval !== currentIntervalMs) {
    restartPublishing(minInterval);
  }
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
  restartPublishing(DEFAULT_CONFIG.refreshInterval);
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
