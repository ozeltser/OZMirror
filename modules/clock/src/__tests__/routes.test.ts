/**
 * Tests for the Clock module Express routes.
 * Mocks config-client, redis-client, and manifest to isolate route logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks (declared BEFORE importing the module under test) ─────────────────

vi.mock('../config-client', () => ({
  fetchInstanceConfig: vi.fn().mockResolvedValue({
    format: 'HH:mm:ss',
    timezone: 'UTC',
    showDate: true,
  }),
  DEFAULT_CONFIG: { format: 'HH:mm:ss', timezone: 'UTC', showDate: true },
}));

vi.mock('../redis-client', () => ({
  setInstanceConfig: vi.fn(),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'clock',
    name: 'Clock',
    description: 'Digital clock with configurable format and timezone support',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'clock',
    defaultConfig: { format: 'HH:mm:ss', timezone: 'UTC', showDate: true },
    configSchema: {
      type: 'object',
      properties: {
        format: { type: 'string' },
        timezone: { type: 'string' },
        showDate: { type: 'boolean' },
      },
      required: ['format', 'timezone', 'showDate'],
    },
    gridConstraints: { minW: 2, minH: 2, maxW: 8, maxH: 4, defaultW: 4, defaultH: 3 },
  },
}));

// ── Module under test (imported AFTER mocks are registered) ─────────────────

import { fetchInstanceConfig } from '../config-client';
import { setInstanceConfig } from '../redis-client';
import routes from '../routes';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', routes);

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
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
  it('returns 200 with manifest object', async () => {
    const res = await request(app).get('/manifest');
    expect(res.status).toBe(200);
  });

  it('manifest has expected fields', async () => {
    const body = (await request(app).get('/manifest')).body;
    expect(body.id).toBe('clock');
    expect(body.name).toBe('Clock');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      format: 'HH:mm:ss',
      timezone: 'UTC',
      showDate: true,
    });
  });

  it('returns 200 with time data shape', async () => {
    const res = await request(app).get('/data?instanceId=clock_01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('time');
    expect(res.body).toHaveProperty('date');
    expect(res.body).toHaveProperty('timezone', 'UTC');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('defaults instanceId to clock_01 when not provided', async () => {
    const res = await request(app).get('/data');
    expect(res.status).toBe(200);
    expect(fetchInstanceConfig).toHaveBeenCalledWith('clock_01');
  });

  it('passes provided instanceId to config fetch', async () => {
    await request(app).get('/data?instanceId=my_clock');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('my_clock');
  });

  it('calls setInstanceConfig to update the publish map', async () => {
    await request(app).get('/data?instanceId=clock_01');
    expect(setInstanceConfig).toHaveBeenCalledWith(
      'clock_01',
      expect.objectContaining({ format: 'HH:mm:ss', timezone: 'UTC' }),
    );
  });

  it('falls back to DEFAULT_CONFIG when fetchInstanceConfig throws', async () => {
    vi.mocked(fetchInstanceConfig).mockRejectedValue(new Error('service down'));
    const res = await request(app).get('/data?instanceId=clock_01');
    // Still returns 200 — route catches the error and uses DEFAULT_CONFIG
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('time');
  });
});

describe('POST /action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      format: 'HH:mm:ss',
      timezone: 'UTC',
      showDate: true,
    });
  });

  it('getTime returns success with time data', async () => {
    const res = await request(app)
      .post('/action')
      .send({ instanceId: 'clock_01', action: 'getTime' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('time');
  });

  it('unknown action returns 400', async () => {
    const res = await request(app)
      .post('/action')
      .send({ action: 'unknownAction' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Unknown action/);
  });

  it('missing action field returns 400', async () => {
    const res = await request(app).post('/action').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('non-string action returns 400', async () => {
    const res = await request(app).post('/action').send({ action: 42 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
