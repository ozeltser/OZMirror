/**
 * Weather Manager — fetches current conditions from OpenWeatherMap.
 *
 * Caches the API response in Redis for 10 minutes to stay well within
 * the free-tier rate limits (60 calls/minute, ~1000 calls/day).
 */

import axios from 'axios';
import type { RedisClientType } from 'redis';

const CACHE_TTL_SECONDS = 600; // 10 minutes

const OWM_BASE = 'https://api.openweathermap.org/data/2.5/weather';

export interface WeatherData {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;   // m/s for metric, mph for imperial
  condition: string;   // "Clear", "Clouds", "Rain", etc.
  description: string; // "clear sky", "overcast clouds", etc.
  icon: string;        // OpenWeatherMap icon code, e.g. "01d"
  fetchedAt: number;
}

/**
 * Fetch current weather for the given city/coords.
 * Checks Redis cache first; on miss, calls OpenWeatherMap and stores result.
 */
export async function getWeather(
  instanceId: string,
  city: string,
  units: 'metric' | 'imperial',
  apiKey: string,
  redis: RedisClientType | null
): Promise<WeatherData> {
  const cacheKey = `weather:data:${instanceId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as WeatherData;
    } catch (err) {
      console.warn('[weather-manager] Cache read error:', err);
    }
  }

  const data = await fetchFromOWM(city, units, apiKey);

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('[weather-manager] Cache write error:', err);
    }
  }

  return data;
}

/**
 * Invalidate the cached weather for a specific instance.
 * Called when instance config changes so the next request re-fetches.
 */
export async function invalidateCache(
  instanceId: string,
  redis: RedisClientType | null
): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`weather:data:${instanceId}`);
  } catch (err) {
    console.warn('[weather-manager] Cache invalidation error:', err);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface OWMResponse {
  name: string;
  sys: { country: string };
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: Array<{ main: string; description: string; icon: string }>;
}

async function fetchFromOWM(
  city: string,
  units: 'metric' | 'imperial',
  apiKey: string
): Promise<WeatherData> {
  if (!apiKey) {
    throw new Error('WEATHER_API_KEY is not configured');
  }

  // Support both "City Name" and "lat,lon" formats
  const params: Record<string, string> = { units, appid: apiKey };
  const latLon = city.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (latLon) {
    params['lat'] = latLon[1];
    params['lon'] = latLon[2];
  } else {
    params['q'] = city;
  }

  let response: OWMResponse;
  try {
    const res = await axios.get<OWMResponse>(OWM_BASE, {
      params,
      timeout: 10_000,
      headers: { 'User-Agent': 'OzMirror/1.0 (weather module)' },
    });
    response = res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new Error(`City not found: "${city}"`);
    }
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      throw new Error('Invalid OpenWeatherMap API key');
    }
    throw new Error('Failed to fetch weather data');
  }

  const weatherEntry = response.weather[0] ?? { main: 'Unknown', description: 'unknown', icon: '01d' };

  return {
    city: response.name,
    country: response.sys.country,
    temp: Math.round(response.main.temp * 10) / 10,
    feelsLike: Math.round(response.main.feels_like * 10) / 10,
    humidity: response.main.humidity,
    windSpeed: Math.round(response.wind.speed * 10) / 10,
    condition: weatherEntry.main,
    description: weatherEntry.description,
    icon: weatherEntry.icon,
    fetchedAt: Date.now(),
  };
}
