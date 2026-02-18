import { createClient, RedisClientType } from 'redis';

const CHANNEL = 'module:system_stats:update';

let client: RedisClientType | null = null;

export async function connectRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const password = process.env.REDIS_PASSWORD;

  client = createClient({
    url: redisUrl,
    password: password || undefined,
  }) as RedisClientType;

  client.on('error', (err) => console.error('Redis client error:', err));

  await client.connect();
  console.log('System Stats: Connected to Redis');
}

export async function publishStats(data: object): Promise<void> {
  if (!client) return;
  await client.publish(CHANNEL, JSON.stringify(data));
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
