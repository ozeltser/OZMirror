/**
 * OzMirror System Stats Module — Express server entry point.
 *
 * Lifecycle:
 *  1. Start Express server
 *  2. Connect to Redis
 *  3. Register with Config Service (retries built-in)
 *  4. Start publishing system metrics to Redis pub/sub
 *  5. Gracefully shut down on SIGTERM/SIGINT
 */

import express from 'express';
import { connectRedis, startPublishing, disconnectRedis } from './redis-client';
import { registerModule } from './config-client';
import routes from './routes';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = '0.0.0.0';
const MODULE_ID = process.env.MODULE_ID ?? 'system_stats';

const app = express();

app.use(express.json());
app.use('/', routes);

const server = app.listen(PORT, HOST, async () => {
  console.log(`[server] System Stats module listening on ${HOST}:${PORT}`);

  try {
    await connectRedis();
    startPublishing();
  } catch (err) {
    console.error('[server] Failed to connect to Redis:', err);
  }

  const serviceUrl = `http://${MODULE_ID}-module:${PORT}`;
  registerModule(serviceUrl).catch((err) =>
    console.error('[server] Background registration error:', err)
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received — shutting down`);

  const forceTimer = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    try {
      await disconnectRedis();
    } catch (err) {
      console.error('[server] Error during Redis disconnect:', err);
      clearTimeout(forceTimer);
      process.exit(1);
    }
    clearTimeout(forceTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
