/**
 * Express routes for the Clock module.
 * Implements the standard OzMirror module API:
 *   GET  /health
 *   GET  /manifest
 *   GET  /data?instanceId=<id>
 *   POST /action
 */

import { Router, Request, Response } from 'express';
import { buildTimeData } from './time-formatter';
import { fetchInstanceConfig, DEFAULT_CONFIG, ClockConfig } from './config-client';
import { setActiveConfig } from './redis-client';
import { MANIFEST } from './manifest';

const router = Router();

const startTime = Date.now();

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0',
  });
});

// ---------------------------------------------------------------------------
// GET /manifest
// ---------------------------------------------------------------------------
router.get('/manifest', (_req: Request, res: Response) => {
  res.json(MANIFEST);
});

// ---------------------------------------------------------------------------
// GET /data?instanceId=<id>
// ---------------------------------------------------------------------------
router.get('/data', async (req: Request, res: Response) => {
  const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : 'clock_01';

  let config: ClockConfig;
  try {
    config = await fetchInstanceConfig(instanceId);
  } catch {
    config = DEFAULT_CONFIG;
  }

  // Keep the in-memory config in sync for the Redis publisher.
  setActiveConfig(config);

  const data = buildTimeData(config.format, config.timezone);
  res.json(data);
});

// ---------------------------------------------------------------------------
// POST /action
// ---------------------------------------------------------------------------
router.post('/action', async (req: Request, res: Response) => {
  const { instanceId, action } = req.body ?? {};

  if (typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" field' });
  }

  if (action === 'getTime') {
    const id = typeof instanceId === 'string' ? instanceId : 'clock_01';
    const config = await fetchInstanceConfig(id).catch(() => DEFAULT_CONFIG);
    const data = buildTimeData(config.format, config.timezone);
    return res.json({ success: true, data });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
