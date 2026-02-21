/**
 * Express routes for the Weather module.
 * Implements the standard OzMirror module API:
 *   GET  /health
 *   GET  /manifest
 *   GET  /data?instanceId=<id>
 *   POST /action
 */

import { Router, Request, Response } from 'express';
import { MANIFEST } from './manifest';
import { fetchInstanceConfig, DEFAULT_CONFIG } from './config-client';
import { setInstanceConfig, getCacheClient } from './redis-client';
import { getWeather, invalidateCache } from './weather-manager';

const router = Router();
const startTime = Date.now();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY ?? '';

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
  const instanceId =
    typeof req.query.instanceId === 'string' ? req.query.instanceId : 'weather_01';

  const config = await fetchInstanceConfig(instanceId).catch(() => DEFAULT_CONFIG);
  setInstanceConfig(instanceId, config);

  if (!WEATHER_API_KEY) {
    return res.status(503).json({
      error: 'WEATHER_API_KEY is not configured on this server',
    });
  }

  try {
    const weatherData = await getWeather(
      instanceId,
      config.city,
      config.units,
      WEATHER_API_KEY,
      getCacheClient()
    );
    return res.json({ instanceId, data: weatherData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[routes] /data error for instance %s:', instanceId, err);
    return res.status(502).json({ error: 'Failed to fetch weather data', detail: message });
  }
});

// ---------------------------------------------------------------------------
// POST /action
// ---------------------------------------------------------------------------
router.post('/action', async (req: Request, res: Response) => {
  const { instanceId, action } = req.body ?? {};

  if (typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" field' });
  }

  const id = typeof instanceId === 'string' ? instanceId : 'weather_01';

  if (action === 'refresh') {
    await invalidateCache(id, getCacheClient());
    return res.json({ success: true, message: `Cache invalidated for instance ${id}` });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
