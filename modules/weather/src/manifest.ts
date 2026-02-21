/**
 * Single source of truth for the Weather module manifest.
 * Imported by config-client.ts (registration) and routes.ts (GET /manifest).
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'weather';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'Weather',
  description: 'Current weather conditions via OpenWeatherMap',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'weather',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name (e.g. "London") or "lat,lon" coordinates',
        default: 'London',
      },
      units: {
        type: 'string',
        description: 'Temperature units: "metric" (°C) or "imperial" (°F)',
        default: 'metric',
      },
      showFeelsLike: {
        type: 'boolean',
        description: 'Show "feels like" temperature',
        default: true,
      },
      showHumidity: {
        type: 'boolean',
        description: 'Show humidity percentage',
        default: true,
      },
      showWind: {
        type: 'boolean',
        description: 'Show wind speed',
        default: true,
      },
    },
    required: ['city', 'units'],
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 4,
    defaultW: 2,
    defaultH: 2,
  },
};
