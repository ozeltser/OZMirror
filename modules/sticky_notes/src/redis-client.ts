import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

const CHANNEL_PREFIX = 'module:sticky_notes';

let client: RedisClientType | null = null;

export async function connectRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const password = process.env.REDIS_PASSWORD;

  client = createClient({
    url: redisUrl,
    password: password || undefined,
  }) as RedisClientType;

  client.on('error', (err) => logger.error('Redis client error', err));

  await client.connect();
  logger.info('Connected to Redis');
}

export async function publishNoteEvent(
  event: 'created' | 'updated' | 'deleted',
  instanceId: string,
  data: object
): Promise<void> {
  if (!client) return;
  const channel = `${CHANNEL_PREFIX}:${event}`;
  await client.publish(
    channel,
    JSON.stringify({ instanceId, event, data, timestamp: Date.now() })
  );
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
