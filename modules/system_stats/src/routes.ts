/**
 * Express routes for the System Stats module.
 * Implements the standard OzMirror module API:
 *   GET  /health
 *   GET  /manifest
 *   GET  /data?instanceId=<id>
 *   POST /action
 */

import { Router, Request, Response } from 'express';
import { collectStats } from './stats-collector';
import { trackInstance } from './redis-client';
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
router.get('/data', (req: Request, res: Response) => {
  const instanceId = typeof req.query.instanceId === 'string'
    ? req.query.instanceId
    : 'system_stats_01';

  // Track this instance so Redis publisher includes it
  trackInstance(instanceId);

  const data = collectStats();
  res.json(data);
});

// ---------------------------------------------------------------------------
// POST /action
// ---------------------------------------------------------------------------
router.post('/action', (req: Request, res: Response) => {
  const { action } = req.body ?? {};

  if (typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" field' });
  }

  if (action === 'getStats') {
    const data = collectStats();
    return res.json({ success: true, data });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

export default router;
