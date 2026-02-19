/**
 * Single source of truth for the Clock module manifest.
 * Imported by both config-client.ts (registration) and routes.ts (GET /manifest).
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'clock';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'Clock',
  description: 'Digital clock with configurable format and timezone support',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'clock',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', description: 'Time format string (HH:mm:ss, HH:mm, hh:mm A)', default: 'HH:mm:ss' },
      timezone: { type: 'string', description: 'IANA timezone name', default: 'UTC' },
      showDate: { type: 'boolean', description: 'Show date below time', default: true },
    },
    required: ['format', 'timezone', 'showDate'],
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 4,
    defaultW: 4,
    defaultH: 3,
  },
};
