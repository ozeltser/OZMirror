/**
 * Express routes for the System Stats module.
 *   GET  /health
 *   GET  /manifest
 *   GET  /data?instanceId=<id>
 *   POST /action
 */

import { Router, Request, Response } from 'express';
import { collectStats } from './stats-collector';
import { fetchInstanceConfig, DEFAULT_CONFIG, SystemStatsConfig } from './config-client';
import { setInstanceConfig } from './redis-client';
import { MANIFEST } from './manifest';

const router = Router();
const startTime = Date.now();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0',
  });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(MANIFEST);
});

router.get('/data', async (req: Request, res: Response) => {
  const instanceId =
    typeof req.query.instanceId === 'string' ? req.query.instanceId : 'system_stats_01';

  let config: SystemStatsConfig;
  try {
    config = await fetchInstanceConfig(instanceId);
  } catch {
    config = DEFAULT_CONFIG;
  }

  setInstanceConfig(instanceId, config);

  try {
    const stats = await collectStats();
    res.json(stats);
  } catch (err) {
    console.error('[routes] Failed to collect stats:', err);
    res.status(500).json({ error: 'Failed to collect system stats' });
  }
});

router.post('/action', async (req: Request, res: Response) => {
  const { instanceId, action } = req.body ?? {};

  if (typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" field' });
  }

  if (action === 'getStats') {
    try {
      const stats = await collectStats();
      return res.json({ success: true, data: stats });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to collect stats' });
    }
  }

  if (action === 'setConfig') {
    const id = typeof instanceId === 'string' ? instanceId : 'system_stats_01';
    const config = await fetchInstanceConfig(id).catch(() => DEFAULT_CONFIG);
    setInstanceConfig(id, config);
    return res.json({ success: true });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
