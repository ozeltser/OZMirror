/**
 * Tests for the Weather module Express routes.
 * Mocks config-client, redis-client, manifest, and weather-manager to isolate route logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks (declared BEFORE importing the module under test) ─────────────────

vi.mock('../config-client', () => ({
  fetchInstanceConfig: vi.fn().mockResolvedValue({
    city: 'London',
    units: 'metric',
    showFeelsLike: true,
    showHumidity: true,
    showWind: true,
  }),
  DEFAULT_CONFIG: {
    city: 'London',
    units: 'metric',
    showFeelsLike: true,
    showHumidity: true,
    showWind: true,
  },
}));

vi.mock('../redis-client', () => ({
  setInstanceConfig: vi.fn(),
  getCacheClient: vi.fn().mockReturnValue(null),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'weather',
    name: 'Weather',
    description: 'Current weather conditions via OpenWeatherMap',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'weather',
    defaultConfig: { city: 'London', units: 'metric' },
    configSchema: { type: 'object', properties: { city: { type: 'string' } } },
    gridConstraints: { minW: 2, minH: 2, maxW: 6, maxH: 4, defaultW: 2, defaultH: 2 },
  },
}));

vi.mock('../weather-manager', () => ({
  getWeather: vi.fn().mockResolvedValue({
    city: 'London',
    country: 'GB',
    temp: 15,
    feelsLike: 13,
    humidity: 80,
    windSpeed: 5,
    condition: 'Clouds',
    description: 'Cloudy',
    icon: '04d',
    fetchedAt: Date.now(),
  }),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

// ── Module under test ────────────────────────────────────────────────────────

import { fetchInstanceConfig } from '../config-client';
import { getWeather, invalidateCache } from '../weather-manager';
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
    expect(body.id).toBe('weather');
    expect(body.name).toBe('Weather');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /data', () => {
  // WEATHER_API_KEY is set to 'test-weather-api-key' via vitest.config.ts
  // so the module-level const captures it at load time.

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInstanceConfig).mockResolvedValue({
      city: 'London',
      units: 'metric',
      showFeelsLike: true,
      showHumidity: true,
      showWind: true,
    });
    vi.mocked(getWeather).mockResolvedValue({
      city: 'London',
      country: 'GB',
      temp: 15,
      feelsLike: 13,
      humidity: 80,
      windSpeed: 5,
      condition: 'Clouds',
      description: 'Cloudy',
      icon: '04d',
      fetchedAt: Date.now(),
    });
  });

  it('returns weather data when API key is configured', async () => {
    const res = await request(app).get('/data?instanceId=weather_01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.instanceId).toBe('weather_01');
  });

  it('defaults instanceId to weather_01 when not provided', async () => {
    await request(app).get('/data');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('weather_01');
  });

  it('passes provided instanceId to config fetch', async () => {
    await request(app).get('/data?instanceId=my_weather');
    expect(fetchInstanceConfig).toHaveBeenCalledWith('my_weather');
  });

  it('falls back to DEFAULT_CONFIG when fetchInstanceConfig throws', async () => {
    vi.mocked(fetchInstanceConfig).mockRejectedValue(new Error('service down'));
    // DEFAULT_CONFIG has city: 'London' so getWeather is still called
    const res = await request(app).get('/data?instanceId=weather_01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('returns 502 when weather fetch fails', async () => {
    vi.mocked(getWeather).mockRejectedValue(new Error('API down'));
    const res = await request(app).get('/data?instanceId=weather_01');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Failed to fetch weather data/);
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
      .send({ instanceId: 'weather_01', action: 'refresh' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // getCacheClient() returns null in test environment — that's the second arg
    expect(invalidateCache).toHaveBeenCalledWith('weather_01', null);
  });

  it('refresh defaults instanceId to weather_01 when not provided', async () => {
    await request(app).post('/action').send({ action: 'refresh' });
    expect(invalidateCache).toHaveBeenCalledWith('weather_01', null);
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
