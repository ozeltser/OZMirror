import { Router, Request, Response } from 'express';
import { collectStats } from './stats-collector';

const router = Router();

const manifest = {
  id: 'system_stats',
  name: 'System Stats',
  description: 'Displays CPU, RAM, and disk usage in real-time',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'chart-bar',
  defaultConfig: {
    refreshInterval: 5000,
    showCpu: true,
    showMemory: true,
    showDisk: true,
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 6,
  },
};

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', module: 'system_stats' });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(manifest);
});

router.get('/data', (_req: Request, res: Response) => {
  const stats = collectStats();
  res.json(stats);
});

export default router;
