/**
 * Redis pub/sub client for the Sticky Notes module.
 * Publishes note updates to module:sticky_notes:data when notes change.
 */

import { createClient, RedisClientType } from 'redis';
import { Note } from './db';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
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

export async function publishNotesUpdate(instanceId: string, notes: Note[]): Promise<void> {
  if (!publisher) return;
  const payload = JSON.stringify({
    instanceId,
    data: { notes },
    timestamp: Date.now(),
  });
  const channel = `module:sticky_notes:data:${instanceId}`;
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
