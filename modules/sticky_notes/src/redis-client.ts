/**
 * Redis pub/sub client for the Sticky Notes module.
 * Publishes note CRUD events to module:sticky_notes:<event> channels.
 */

import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
const CHANNEL_PREFIX = 'module:sticky_notes';

let publisher: RedisClientType | null = null;

export async function connectRedis(): Promise<void> {
  publisher = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
  }) as RedisClientType;

  publisher.on('error', (err) => console.error('[redis-client] Error:', err));

  await publisher.connect();
  console.log('[redis-client] Connected to Redis');
}

/**
 * Publish a note event. Payload follows ModuleEventPayload convention:
 * { instanceId, data, timestamp }
 */
export async function publishNoteEvent(
  event: 'created' | 'updated' | 'deleted',
  instanceId: string,
  data: object
): Promise<void> {
  if (!publisher) return;
  const channel = `${CHANNEL_PREFIX}:${event}`;
  const payload = JSON.stringify({ instanceId, data, timestamp: Date.now() });
  try {
    await publisher.publish(channel, payload);
  } catch (err) {
    console.error('[redis-client] Publish error:', err);
  }
}

export async function disconnectRedis(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
    console.log('[redis-client] Disconnected from Redis');
  }
}
