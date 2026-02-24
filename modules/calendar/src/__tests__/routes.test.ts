/**
 * Tests for the Calendar module Express routes.
 * Mocks config-client, redis-client, manifest, and calendar-manager to isolate route logic.
 *
 * Note: vi.mock factories are hoisted to the top of the file by Vitest, so they cannot
 * reference variables defined in the test file. All values are inlined directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks (declared BEFORE importing the module under test) ─────────────────

vi.mock('../config-client', () => ({
  fetchInstanceConfig: vi.fn().mockResolvedValue({
    icalUrl: '',
    maxEvents: 5,
    lookaheadDays: 30,
    timeFormat: '24h',
    timezone: 'UTC',
  }),
  DEFAULT_CONFIG: {
    icalUrl: '',
    maxEvents: 5,
    lookaheadDays: 30,
    timeFormat: '24h',
    timezone: 'UTC',
  },
}));

vi.mock('../redis-client', () => ({
  setInstanceConfig: vi.fn(),
  getCacheClient: vi.fn().mockReturnValue(null),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'calendar',
    name: 'Calendar',
    description: 'Upcoming events from a public iCal (.ics) URL',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'calendar',
    defaultConfig: { icalUrl: '', maxEvents: 5, lookaheadDays: 30, timeFormat: '24h', timezone: 'UTC' },
    configSchema: { type: 'object', properties: { icalUrl: { type: 'string' } } },
    gridConstraints: { minW: 2, minH: 3, maxW: 8, maxH: 8, defaultW: 3, defaultH: 4 },
  },
}));

const MOCK_EVENTS = [
  {
    uid: 'event1',
    title: 'Team Standup',
    start: '2026-02-25T09:00:00Z',
    end: '2026-02-25T09:30:00Z',
    allDay: false,
    location: '',
    description: '',
  },
];

vi.mock('../calendar-manager', () => ({
  getEvents: vi.fn().mockResolvedValue([
    {
      uid: 'event1',
      title: 'Team Standup',
      start: '2026-02-25T09:00:00Z',
      end: '2026-02-25T09:30:00Z',
      allDay: false,
      location: '',
      description: '',
    },
  ]),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

// ── Module under test ────────────────────────────────────────────────────────

import { fetchInstanceConfig } from '../config-client';
import { setInstanceConfig } from '../redis-client';
import { getEvents, invalidateCache } from '../calendar-manager';
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
    expect(body.id).toBe('calendar');
    expect(body.name).toBe('Calendar');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      icalUrl: '',
      maxEvents: 5,
      lookaheadDays: 30,
      timeFormat: '24h',
      timezone: 'UTC',
    });
    vi.mocked(getEvents).mockResolvedValue(MOCK_EVENTS);
  });

  it('returns empty events array when no icalUrl is configured', async () => {
    const res = await request(app).get('/data?instanceId=calendar_01');
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.instanceId).toBe('calendar_01');
    expect(res.body).toHaveProperty('message');
  });

  it('returns events when icalUrl is configured', async () => {
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      icalUrl: 'https://calendar.example.com/feed.ics',
      maxEvents: 5,
      lookaheadDays: 30,
      timeFormat: '24h',
      timezone: 'UTC',
    });
    const res = await request(app).get('/data?instanceId=calendar_01');
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual(MOCK_EVENTS);
    expect(res.body).toHaveProperty('fetchedAt');
  });

  it('defaults instanceId to calendar_01 when not provided', async () => {
    await request(app).get('/data');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('calendar_01');
  });

  it('passes provided instanceId to config fetch', async () => {
    await request(app).get('/data?instanceId=my_cal');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('my_cal');
  });

  it('calls setInstanceConfig to keep the publish map in sync', async () => {
    await request(app).get('/data?instanceId=calendar_01');
    expect(setInstanceConfig).toHaveBeenCalledWith('calendar_01', expect.any(Object));
  });

  it('falls back to DEFAULT_CONFIG when fetchInstanceConfig throws', async () => {
    vi.mocked(fetchInstanceConfig).mockRejectedValue(new Error('service down'));
    const res = await request(app).get('/data?instanceId=calendar_01');
    // Falls back to DEFAULT_CONFIG which has no icalUrl → returns empty events
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });

  it('returns 502 when calendar fetch fails', async () => {
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      icalUrl: 'https://bad.example.com/feed.ics',
      maxEvents: 5,
      lookaheadDays: 30,
      timeFormat: '24h',
      timezone: 'UTC',
    });
    vi.mocked(getEvents).mockRejectedValue(new Error('iCal fetch failed'));
    const res = await request(app).get('/data?instanceId=calendar_01');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Failed to fetch calendar data/);
  });
});

describe('POST /action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      icalUrl: 'https://calendar.example.com/feed.ics',
      maxEvents: 5,
      lookaheadDays: 30,
      timeFormat: '24h',
      timezone: 'UTC',
    });
    vi.mocked(getEvents).mockResolvedValue(MOCK_EVENTS);
    vi.mocked(invalidateCache).mockResolvedValue(undefined);
  });

  it('getEvents action returns event list', async () => {
    const res = await request(app)
      .post('/action')
      .send({ instanceId: 'calendar_01', action: 'getEvents' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events).toEqual(MOCK_EVENTS);
  });

  it('getEvents returns empty events when no icalUrl', async () => {
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      icalUrl: '',
      maxEvents: 5,
      lookaheadDays: 30,
      timeFormat: '24h',
      timezone: 'UTC',
    });
    const res = await request(app)
      .post('/action')
      .send({ instanceId: 'calendar_01', action: 'getEvents' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events).toEqual([]);
  });

  it('refresh action invalidates cache and returns success', async () => {
    const res = await request(app)
      .post('/action')
      .send({ instanceId: 'calendar_01', action: 'refresh' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getCacheClient() returns null in test environment — that's the second arg
    expect(invalidateCache).toHaveBeenCalledWith('calendar_01', null);
  });

  it('refresh defaults instanceId to calendar_01 when not provided', async () => {
    await request(app).post('/action').send({ action: 'refresh' });
    expect(invalidateCache).toHaveBeenCalledWith('calendar_01', null);
  });

  it('unknown action returns 400', async () => {
    const res = await request(app).post('/action').send({ action: 'unknownAction' });
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
