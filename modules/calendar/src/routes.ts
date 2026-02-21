/**
 * Express routes for the Calendar module.
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
import { getEvents, invalidateCache } from './calendar-manager';

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
  const instanceId =
    typeof req.query.instanceId === 'string' ? req.query.instanceId : 'calendar_01';

  const config = await fetchInstanceConfig(instanceId).catch(() => DEFAULT_CONFIG);

  // Keep the per-instance config map in sync for the Redis publisher
  setInstanceConfig(instanceId, config);

  if (!config.icalUrl) {
    return res.json({
      instanceId,
      events: [],
      fetchedAt: Date.now(),
      message: 'No iCal URL configured. Set icalUrl in module config.',
    });
  }

  try {
    const events = await getEvents(
      instanceId,
      config.icalUrl,
      config.lookaheadDays,
      config.maxEvents,
      getCacheClient()
    );
    return res.json({ instanceId, events, fetchedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[routes] /data error for instance %s:', instanceId, err);
    return res.status(502).json({ error: 'Failed to fetch calendar data', detail: message });
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

  const id = typeof instanceId === 'string' ? instanceId : 'calendar_01';

  if (action === 'getEvents') {
    const config = await fetchInstanceConfig(id).catch(() => DEFAULT_CONFIG);
    setInstanceConfig(id, config);

    if (!config.icalUrl) {
      return res.json({ success: true, data: { instanceId: id, events: [], fetchedAt: Date.now() } });
    }

    try {
      const events = await getEvents(id, config.icalUrl, config.lookaheadDays, config.maxEvents, getCacheClient());
      return res.json({ success: true, data: { instanceId: id, events, fetchedAt: Date.now() } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(502).json({ success: false, error: message });
    }
  }

  if (action === 'refresh') {
    // Force a cache invalidation so the next /data call re-fetches
    await invalidateCache(id, getCacheClient());
    return res.json({ success: true, message: `Cache invalidated for instance ${id}` });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
