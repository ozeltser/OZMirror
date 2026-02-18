import { Router, Request, Response } from 'express';
import { getTimeData } from './time-formatter';

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

router.get('/data', (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'HH:mm:ss';
  const timezone = (req.query.timezone as string) || 'UTC';
  const data = getTimeData(format, timezone);
  res.json(data);
});

export default router;
