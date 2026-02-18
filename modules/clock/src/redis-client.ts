/**
 * Redis pub/sub client for the Clock module.
 * Publishes a time update to module:clock:time every second.
 * Channel naming follows the OzMirror convention documented in docs/REDIS_CHANNELS.md.
 */

import { createClient, RedisClientType } from 'redis';
import { buildTimeData } from './time-formatter';
import { ClockConfig, DEFAULT_CONFIG } from './config-client';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
// module:clock:time is in the WebSocket Bridge's allowed channel whitelist
const CHANNEL = 'module:clock:time';

let publisher: RedisClientType | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Mutable reference to the active config — updated externally.
let activeConfig: ClockConfig = { ...DEFAULT_CONFIG };

export function setActiveConfig(config: ClockConfig): void {
  activeConfig = config;
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

export function startPublishing(instanceId = 'clock_01'): void {
  if (!publisher) {
    console.error('[redis-client] Not connected — cannot publish');
    return;
  }

  intervalHandle = setInterval(async () => {
    const data = buildTimeData(activeConfig.format, activeConfig.timezone);
    const payload = JSON.stringify({ instanceId, data, timestamp: data.timestamp });
    try {
      await publisher!.publish(CHANNEL, payload);
    } catch (err) {
      console.error('[redis-client] Publish error:', err);
    }
  }, 1000);

  console.log(`[redis-client] Publishing to ${CHANNEL} every 1s`);
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
