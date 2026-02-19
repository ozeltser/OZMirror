import { Router, Request, Response } from 'express';
import { getTimeData } from './time-formatter';
import { requireApiKey } from './auth';

const router = Router();

const manifest = {
  id: 'clock',
  name: 'Clock',
  description: 'Displays current time and date',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'clock',
  defaultConfig: {
    format: 'HH:mm:ss',
    timezone: 'UTC',
    showDate: true,
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
  },
};

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', module: 'clock' });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(manifest);
});

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  return fallback;
}

router.get('/data', requireApiKey, (req: Request, res: Response) => {
  const format = asString(req.query.format, 'HH:mm:ss');
  const timezone = asString(req.query.timezone, 'UTC');
  const data = getTimeData(format, timezone);
  res.json(data);
});

export default router;
