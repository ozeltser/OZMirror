/**
 * Express routes for the System Stats module.
 *   GET  /health
 *   GET  /manifest
 *   GET  /data?instanceId=<id>
 *   POST /action
 */

import { Router, Request, Response, NextFunction } from 'express';
import { collectStats } from './stats-collector';
import { fetchInstanceConfig, DEFAULT_CONFIG, SystemStatsConfig } from './config-client';
import { setInstanceConfig } from './redis-client';
import { MANIFEST } from './manifest';
import { validateInstanceId } from './utils';

const router = Router();
const startTime = Date.now();

const API_KEY = process.env.API_KEY ?? '';

if (!API_KEY) {
  console.error('[routes] FATAL: API_KEY environment variable is not set — all authenticated requests will be rejected');
}

function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    res.status(401).json({ error: 'Server misconfiguration: API_KEY is not configured' });
    return;
  }
  const provided = req.headers['x-api-key'];
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

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

router.get('/data', authenticateApiKey, async (req: Request, res: Response) => {
  const { instanceId } = req.query;
  if (!validateInstanceId(instanceId)) {
    return res.status(400).json({ error: 'Missing or invalid instanceId' });
  }

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

router.post('/action', authenticateApiKey, async (req: Request, res: Response) => {
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
    if (!validateInstanceId(instanceId)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid instanceId' });
    }
    const config = await fetchInstanceConfig(instanceId).catch(() => DEFAULT_CONFIG);
    setInstanceConfig(instanceId, config);
    return res.json({ success: true });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
