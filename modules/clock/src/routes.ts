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
  res.json({
    id: process.env.MODULE_ID ?? 'clock',
    name: 'Clock',
    description: 'Digital clock with configurable format and timezone support',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'clock',
    defaultConfig: DEFAULT_CONFIG,
    configSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', default: 'HH:mm:ss' },
        timezone: { type: 'string', default: 'UTC' },
        showDate: { type: 'boolean', default: true },
      },
      required: ['format', 'timezone', 'showDate'],
    },
    gridConstraints: { minW: 2, minH: 2, maxW: 8, maxH: 4, defaultW: 4, defaultH: 3 },
  });
});

// ---------------------------------------------------------------------------
// GET /data?instanceId=<id>
// ---------------------------------------------------------------------------
router.get('/data', async (req: Request, res: Response) => {
  const instanceId = (req.query.instanceId as string) ?? 'clock_01';

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
  const { instanceId, action, payload } = req.body as {
    instanceId: string;
    action: string;
    payload: Record<string, unknown>;
  };

  if (action === 'getTime') {
    const config = await fetchInstanceConfig(instanceId ?? 'clock_01').catch(() => DEFAULT_CONFIG);
    const data = buildTimeData(config.format, config.timezone);
    return res.json({ success: true, data });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
