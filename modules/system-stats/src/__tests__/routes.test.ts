/**
 * Tests for the System Stats module Express routes.
 * Mocks stats-collector, config-client, redis-client, manifest, and utils to isolate route logic.
 * This module uses API key authentication on /data and /action.
 *
 * Note: vi.mock factories are hoisted by Vitest — no top-level variables inside them.
 * API_KEY is pre-set via vitest.config.ts so the module-level const captures it at load time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// API_KEY is set to 'test-api-key-system-stats' via vitest.config.ts
const TEST_API_KEY = 'test-api-key-system-stats';

// ── Mocks (declared BEFORE importing the module under test) ─────────────────

vi.mock('../stats-collector', () => ({
  collectStats: vi.fn().mockResolvedValue({
    cpu: { usage: 23.5, cores: 4, model: 'ARM Cortex-A72' },
    memory: { total: 4096, used: 1024, free: 3072, usedPercent: 25 },
    disk: { total: 32000, used: 8000, free: 24000, usedPercent: 25, path: '/' },
    uptime: 86400,
    timestamp: 1234567890,
  }),
}));

vi.mock('../config-client', () => ({
  fetchInstanceConfig: vi.fn().mockResolvedValue({ refreshInterval: 5000, showDisk: true }),
  DEFAULT_CONFIG: { refreshInterval: 5000, showDisk: true },
}));

vi.mock('../redis-client', () => ({
  setInstanceConfig: vi.fn(),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'system_stats',
    name: 'System Stats',
    description: 'Real-time CPU, memory, and disk usage monitor',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'system_stats',
    defaultConfig: { refreshInterval: 5000, showDisk: true },
    configSchema: { type: 'object', properties: { refreshInterval: { type: 'number' } } },
    gridConstraints: { minW: 2, minH: 2, maxW: 8, maxH: 6, defaultW: 3, defaultH: 3 },
  },
}));

vi.mock('../utils', () => ({
  validateInstanceId: vi.fn((id: unknown): id is string =>
    typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)
  ),
}));

// ── Module under test ────────────────────────────────────────────────────────

import { collectStats } from '../stats-collector';
import { fetchInstanceConfig } from '../config-client';
import routes from '../routes';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', routes);

const MOCK_STATS = {
  cpu: { usage: 23.5, cores: 4, model: 'ARM Cortex-A72' },
  memory: { total: 4096, used: 1024, free: 3072, usedPercent: 25 },
  disk: { total: 32000, used: 8000, free: 24000, usedPercent: 25, path: '/' },
  uptime: 86400,
  timestamp: 1234567890,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with healthy status (no auth required)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('includes uptime as a number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('includes version string', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.version).toBe('string');
  });
});

describe('GET /manifest', () => {
  it('returns 200 with manifest object (no auth required)', async () => {
    const res = await request(app).get('/manifest');
    expect(res.status).toBe(200);
  });

  it('manifest has expected fields', async () => {
    const body = (await request(app).get('/manifest')).body;
    expect(body.id).toBe('system_stats');
    expect(body.name).toBe('System Stats');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /data (requires auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectStats).mockResolvedValue(MOCK_STATS);
    vi.mocked(fetchInstanceConfig).mockResolvedValue({ refreshInterval: 5000, showDisk: true });
  });

  it('returns 401 when no API key is provided', async () => {
    const res = await request(app).get('/data?instanceId=system_stats_01');
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong API key is provided', async () => {
    const res = await request(app)
      .get('/data?instanceId=system_stats_01')
      .set('X-API-Key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await request(app).get('/data').set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instanceId/);
  });

  it('returns 400 when instanceId contains invalid characters', async () => {
    const res = await request(app)
      .get('/data?instanceId=invalid%20id!')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(400);
  });

  it('returns system stats with valid auth and instanceId', async () => {
    const res = await request(app)
      .get('/data?instanceId=system_stats_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
  });

  it('returns 500 when stats collection fails', async () => {
    vi.mocked(collectStats).mockRejectedValue(new Error('hardware error'));
    const res = await request(app)
      .get('/data?instanceId=system_stats_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to collect system stats/);
  });
});

describe('POST /action (requires auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectStats).mockResolvedValue(MOCK_STATS);
    vi.mocked(fetchInstanceConfig).mockResolvedValue({ refreshInterval: 5000, showDisk: true });
  });

  it('returns 401 when no API key is provided', async () => {
    const res = await request(app).post('/action').send({ action: 'getStats' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong API key is provided', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', 'wrong-key')
      .send({ action: 'getStats' });
    expect(res.status).toBe(401);
  });

  it('getStats action returns system stats', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({ action: 'getStats' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('cpu');
    expect(res.body.data).toHaveProperty('memory');
  });

  it('setConfig action with valid instanceId returns success', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'system_stats_01', action: 'setConfig' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('setConfig action with missing instanceId returns 400', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({ action: 'setConfig' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('unknown action returns 400', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({ action: 'unknownAction' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Unknown action/);
  });

  it('missing action field returns 400', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('non-string action returns 400', async () => {
    const res = await request(app)
      .post('/action')
      .set('X-API-Key', TEST_API_KEY)
      .send({ action: 42 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
