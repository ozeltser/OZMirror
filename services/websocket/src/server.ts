import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RedisBridge } from './redis-bridge';
import { logger } from './logger';

const PORT = parseInt(process.env.PORT || '8080', 10);
const API_KEY = process.env.API_KEY;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Publish is restricted to module-owned channels; system channels are
// backend-only and must not be writable by browser clients.
const ALLOWED_PUBLISH_CHANNELS =
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
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

// ── Redis ──────────────────────────────────────────────────────────────────
const redisBridge = new RedisBridge(REDIS_URL, REDIS_PASSWORD);

// ── Auth middleware ────────────────────────────────────────────────────────
io.use((socket, next) => {
  if (!API_KEY) {
    // No key configured — allow connections (dev mode)
    return next();
  }
  const provided = socket.handshake.auth?.apiKey;
  if (provided !== API_KEY) {
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
  const socketHandlers = new Map<string, (message: any) => void>();

  socket.on('subscribe', async (channels: string | string[]) => {
    const list = Array.isArray(channels) ? channels : [channels];
    for (const channel of list) {
      if (socketHandlers.has(channel)) continue; // already subscribed

      const handler = (message: any) => {
        socket.emit('message', { channel, payload: message });
      };
      socketHandlers.set(channel, handler);
      await redisBridge.subscribe(channel, handler);
      logger.debug(`Socket ${socket.id} subscribed to ${channel}`);
    }
  });

  socket.on('unsubscribe', async (channels: string | string[]) => {
    const list = Array.isArray(channels) ? channels : [channels];
    for (const channel of list) {
      const handler = socketHandlers.get(channel);
      if (handler) {
        await redisBridge.unsubscribe(channel, handler);
        socketHandlers.delete(channel);
        logger.debug(`Socket ${socket.id} unsubscribed from ${channel}`);
      }
    }
  });

  socket.on('publish', async ({ channel, payload }: { channel: string; payload: any }) => {
    if (!ALLOWED_PUBLISH_CHANNELS.test(channel)) {
      logger.warn(`Socket ${socket.id} attempted publish to disallowed channel: ${channel}`);
      return;
    }
    await redisBridge.publish(channel, payload);
  });

  socket.on('disconnect', async () => {
    logger.info(`Client disconnected: ${socket.id}`);
    for (const [channel, handler] of socketHandlers) {
      await redisBridge.unsubscribe(channel, handler);
    }
    socketHandlers.clear();
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
  httpServer.close(async () => {
    await redisBridge.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
