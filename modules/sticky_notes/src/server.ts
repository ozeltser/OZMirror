import express from 'express';
import { connectRedis, closeRedis } from './redis-client';
import { closeDb } from './database';
import routes from './routes';

const PORT = parseInt(process.env.PORT || '3003', 10);

const app = express();
app.use(express.json());
app.use('/', routes);

async function start() {
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Sticky Notes module listening on port ${PORT}`);
  });
}

async function shutdown() {
  console.log('Shutting down sticky notes module...');
  await closeRedis();
  closeDb();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  console.error('Failed to start sticky notes module:', err);
  process.exit(1);
});
