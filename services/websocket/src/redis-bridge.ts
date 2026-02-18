import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

type MessageHandler = (message: any) => void;

export class RedisBridge {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  // Multiple sockets can subscribe to the same Redis channel; fan-out
  // is handled here so we only hold one Redis subscription per channel.
  private channelHandlers: Map<string, Set<MessageHandler>> = new Map();

  constructor(redisUrl: string, redisPassword?: string) {
    const clientOptions = {
      url: redisUrl,
      ...(redisPassword ? { password: redisPassword } : {})
    };

    this.publisher = createClient(clientOptions) as RedisClientType;
    // subscriber must be a separate connection (redis v4 pub/sub mode)
    this.subscriber = this.publisher.duplicate() as RedisClientType;

    this.publisher.on('error', (err) => logger.error('Redis publisher error:', err));
    this.subscriber.on('error', (err) => logger.error('Redis subscriber error:', err));
  }

  async connect(): Promise<void> {
    await this.publisher.connect();
    await this.subscriber.connect();
    logger.info('Redis bridge connected');
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());

      // One Redis subscription per channel; fan-out to all JS handlers.
      await this.subscriber.subscribe(channel, (message) => {
        const handlers = this.channelHandlers.get(channel);
        if (!handlers) return;
        let parsed: any;
        try { parsed = JSON.parse(message); } catch { parsed = message; }
        handlers.forEach((h) => h(parsed));
      });

      logger.info(`Subscribed to Redis channel: ${channel}`);
    }

    this.channelHandlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler: MessageHandler): Promise<void> {
    const handlers = this.channelHandlers.get(channel);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      await this.subscriber.unsubscribe(channel);
      this.channelHandlers.delete(channel);
      logger.info(`Unsubscribed from Redis channel: ${channel}`);
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    await this.publisher.publish(channel, payload);
    logger.debug(`Published to ${channel}`);
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
    logger.info('Redis bridge closed');
  }
}
