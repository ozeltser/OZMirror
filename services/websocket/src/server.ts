import { createServer, IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import { RedisBridge } from './redis-bridge';
import { logger } from './logger';

const PORT = parseInt(process.env.PORT || '8080', 10);
const API_KEY = process.env.API_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Comma-separated list of allowed CORS origins (e.g. "http://localhost,https://ozmirror.example.com").
// Defaults to localhost only; set explicitly in production.
const ALLOWED_CORS_ORIGINS: string[] = (process.env.ALLOWED_CORS_ORIGINS || 'http://localhost')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Both subscribe and publish are restricted to module-owned channels.
// System/internal channels must not be readable or writable by browser clients.
const ALLOWED_MODULE_CHANNELS =
  /^module:(clock|weather|calendar|rss|system_stats|now_playing|sticky_notes):.+$/;

// ── HTTP server ────────────────────────────────────────────────────────────
// Handle /health directly; all other requests are handled by Socket.io.
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: { origin: ALLOWED_CORS_ORIGINS, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

// ── Redis ──────────────────────────────────────────────────────────────────
const redisBridge = new RedisBridge(REDIS_URL, REDIS_PASSWORD);

// ── Auth middleware ────────────────────────────────────────────────────────
if (!API_KEY) {
  logger.error('API_KEY environment variable is not set — refusing to start');
  process.exit(1);
}

io.use((socket, next) => {
  const provided = socket.handshake.auth?.apiKey;
  let valid = false;
  if (typeof provided === 'string') {
    const a = Buffer.from(provided);
    const b = Buffer.from(API_KEY!);
    valid = a.length === b.length && timingSafeEqual(a, b);
  }
  if (!valid) {
    logger.warn(`Rejected connection from ${socket.handshake.address}: bad API key`);
    return next(new Error('Authentication error'));
  }
  next();
});

// ── Connection handling ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (${socket.handshake.address})`);

  // Per-socket map of channel → handler so we can remove the exact
  // handler on unsubscribe / disconnect without affecting other sockets.
  const socketHandlers = new Map<string, (message: unknown) => void>();

  socket.on('subscribe', async (channels: string | string[]) => {
    try {
      const list = Array.isArray(channels) ? channels : [channels];
      for (const channel of list) {
        if (!ALLOWED_MODULE_CHANNELS.test(channel)) {
          logger.warn(`Socket ${socket.id} attempted subscribe to disallowed channel: ${channel}`);
          continue;
        }
        if (socketHandlers.has(channel)) continue; // already subscribed

        const handler = (message: unknown) => {
          socket.emit('message', { channel, payload: message });
        };
        socketHandlers.set(channel, handler);
        await redisBridge.subscribe(channel, handler);
        logger.debug(`Socket ${socket.id} subscribed to ${channel}`);
      }
    } catch (err) {
      logger.error(`subscribe error on socket ${socket.id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  });

  socket.on('unsubscribe', async (channels: string | string[]) => {
    try {
      const list = Array.isArray(channels) ? channels : [channels];
      for (const channel of list) {
        const handler = socketHandlers.get(channel);
        if (handler) {
          await redisBridge.unsubscribe(channel, handler);
          socketHandlers.delete(channel);
          logger.debug(`Socket ${socket.id} unsubscribed from ${channel}`);
        }
      }
    } catch (err) {
      logger.error(`unsubscribe error on socket ${socket.id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  });

  socket.on('publish', async ({ channel, payload }: { channel: string; payload: unknown }) => {
    try {
      if (!ALLOWED_MODULE_CHANNELS.test(channel)) {
        logger.warn(`Socket ${socket.id} attempted publish to disallowed channel: ${channel}`);
        return;
      }
      await redisBridge.publish(channel, payload);
    } catch (err) {
      logger.error(`publish error on socket ${socket.id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  });

  socket.on('disconnect', async () => {
    try {
      logger.info(`Client disconnected: ${socket.id}`);
      await Promise.all(
        Array.from(socketHandlers).map(([channel, handler]) =>
          redisBridge.unsubscribe(channel, handler)
        )
      );
      socketHandlers.clear();
    } catch (err) {
      logger.error(`disconnect cleanup error on socket ${socket.id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  await redisBridge.connect();
  httpServer.listen(PORT, () => {
    logger.info(`WebSocket Bridge listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown() {
  logger.info('Shutting down...');

  // Force exit after 10 s if connections don't drain in time.
  const forceExit = setTimeout(() => {
    logger.warn('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // Disconnect Socket.io clients so httpServer.close() doesn't hang
  // waiting for long-lived WebSocket connections to finish naturally.
  io.disconnectSockets(true);

  httpServer.close(async () => {
    clearTimeout(forceExit);
    await redisBridge.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
