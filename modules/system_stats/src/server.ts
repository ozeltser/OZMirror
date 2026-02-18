import express from 'express';
import { connectRedis, publishStats, closeRedis } from './redis-client';
import { collectStats } from './stats-collector';
import routes from './routes';

const PORT = parseInt(process.env.PORT || '3002', 10);
const PUBLISH_INTERVAL_MS = parseInt(process.env.STATS_INTERVAL_MS || '5000', 10);

const app = express();
app.use(express.json());
app.use('/', routes);

let publishInterval: NodeJS.Timeout | null = null;

async function start() {
  await connectRedis();

  // Publish stats every 5 seconds
  publishInterval = setInterval(async () => {
    const stats = collectStats();
    await publishStats(stats);
  }, PUBLISH_INTERVAL_MS);

  app.listen(PORT, () => {
    console.log(`System Stats module listening on port ${PORT}`);
  });
}

async function shutdown() {
  console.log('Shutting down system stats module...');
  if (publishInterval) {
    clearInterval(publishInterval);
  }
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  console.error('Failed to start system stats module:', err);
  process.exit(1);
});
