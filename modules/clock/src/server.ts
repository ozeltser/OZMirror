import express from 'express';
import { connectRedis, publishTimeUpdate, closeRedis } from './redis-client';
import { getTimeData } from './time-formatter';
import { logger } from './logger';
import routes from './routes';

const PORT = parseInt(process.env.PORT || '3001', 10);
const FORMAT = process.env.CLOCK_FORMAT || 'HH:mm:ss';
const TIMEZONE = process.env.TZ || 'UTC';

const app = express();
app.use(express.json());
app.use('/', routes);

let publishInterval: NodeJS.Timeout | null = null;

async function start() {
  await connectRedis();

  // Publish time update every second
  publishInterval = setInterval(async () => {
    const data = getTimeData(FORMAT, TIMEZONE);
    await publishTimeUpdate(data);
  }, 1000);

  app.listen(PORT, () => {
    logger.info(`Clock module listening on port ${PORT}`);
  });
}

async function shutdown() {
  logger.info('Shutting down clock module...');
  if (publishInterval) {
    clearInterval(publishInterval);
  }
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  logger.error('Failed to start clock module', err);
  process.exit(1);
});
