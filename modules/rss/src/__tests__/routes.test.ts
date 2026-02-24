/**
 * Tests for the RSS module Express routes.
 * Mocks config-client, redis-client, manifest, and feed-manager to isolate route logic.
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
    feedUrl: '',
    maxItems: 10,
    showDescription: true,
  }),
  DEFAULT_CONFIG: {
    feedUrl: '',
    maxItems: 10,
    showDescription: true,
  },
}));

vi.mock('../redis-client', () => ({
  setInstanceConfig: vi.fn(),
  getCacheClient: vi.fn().mockReturnValue(null),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'rss',
    name: 'RSS Feed',
    description: 'Headlines from any RSS or Atom feed',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'rss',
    defaultConfig: { feedUrl: '', maxItems: 10, showDescription: true },
    configSchema: { type: 'object', properties: { feedUrl: { type: 'string' } } },
    gridConstraints: { minW: 2, minH: 3, maxW: 8, maxH: 10, defaultW: 3, defaultH: 4 },
  },
}));

vi.mock('../feed-manager', () => ({
  getFeed: vi.fn().mockResolvedValue({
    feedTitle: 'Test Feed',
    items: [
      { title: 'Article 1', link: 'https://example.com/1', pubDate: '2026-02-24', description: 'Desc 1' },
      { title: 'Article 2', link: 'https://example.com/2', pubDate: '2026-02-23', description: 'Desc 2' },
    ],
    fetchedAt: 1234567890,
  }),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

// ── Module under test ────────────────────────────────────────────────────────

import { fetchInstanceConfig } from '../config-client';
import { setInstanceConfig } from '../redis-client';
import { getFeed, invalidateCache } from '../feed-manager';
import routes from '../routes';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', routes);

const MOCK_FEED = {
  feedTitle: 'Test Feed',
  items: [
    { title: 'Article 1', link: 'https://example.com/1', pubDate: '2026-02-24', description: 'Desc 1' },
    { title: 'Article 2', link: 'https://example.com/2', pubDate: '2026-02-23', description: 'Desc 2' },
  ],
  fetchedAt: 1234567890,
};

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
    expect(body.id).toBe('rss');
    expect(body.name).toBe('RSS Feed');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({ feedUrl: '', maxItems: 10, showDescription: true });
    vi.mocked(getFeed).mockResolvedValue(MOCK_FEED);
  });

  it('returns empty items when no feedUrl is configured', async () => {
    const res = await request(app).get('/data?instanceId=rss_01');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.instanceId).toBe('rss_01');
    expect(res.body).toHaveProperty('message');
  });

  it('returns feed data when feedUrl is configured', async () => {
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      feedUrl: 'https://feeds.example.com/rss',
      maxItems: 10,
      showDescription: true,
    });
    const res = await request(app).get('/data?instanceId=rss_01');
    expect(res.status).toBe(200);
    expect(res.body.data.feedTitle).toBe('Test Feed');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.instanceId).toBe('rss_01');
  });

  it('defaults instanceId to rss_01 when not provided', async () => {
    await request(app).get('/data');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('rss_01');
  });

  it('passes provided instanceId to config fetch', async () => {
    await request(app).get('/data?instanceId=my_rss');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('my_rss');
  });

  it('calls setInstanceConfig to keep the publish map in sync', async () => {
    await request(app).get('/data?instanceId=rss_01');
    expect(setInstanceConfig).toHaveBeenCalledWith('rss_01', expect.any(Object));
  });

  it('falls back to DEFAULT_CONFIG when fetchInstanceConfig throws', async () => {
    vi.mocked(fetchInstanceConfig).mockRejectedValue(new Error('service down'));
    // Falls back to DEFAULT_CONFIG which has no feedUrl → returns empty items
    const res = await request(app).get('/data?instanceId=rss_01');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('returns 502 when feed fetch fails', async () => {
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      feedUrl: 'https://bad.example.com/rss',
      maxItems: 10,
      showDescription: true,
    });
    vi.mocked(getFeed).mockRejectedValue(new Error('fetch error'));
    const res = await request(app).get('/data?instanceId=rss_01');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Failed to fetch feed data/);
  });
});

describe('POST /action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invalidateCache).mockResolvedValue(undefined);
  });

  it('refresh action invalidates cache and returns success', async () => {
    const res = await request(app)
      .post('/action')
      .send({ instanceId: 'rss_01', action: 'refresh' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getCacheClient() returns null in test environment — that's the second arg
    expect(invalidateCache).toHaveBeenCalledWith('rss_01', null);
  });

  it('refresh defaults instanceId to rss_01 when not provided', async () => {
    await request(app).post('/action').send({ action: 'refresh' });
    expect(invalidateCache).toHaveBeenCalledWith('rss_01', null);
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
