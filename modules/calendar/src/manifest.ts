/**
 * Single source of truth for the Calendar module manifest.
 * Imported by config-client.ts (registration) and routes.ts (GET /manifest).
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'calendar';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'Calendar',
  description: 'Upcoming events from a public iCal (.ics) URL',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'calendar',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      icalUrl: {
        type: 'string',
        description: 'Public iCal (.ics) URL (e.g. Google Calendar export link)',
        default: '',
      },
      maxEvents: {
        type: 'number',
        description: 'Maximum number of upcoming events to display',
        default: 5,
      },
      lookaheadDays: {
        type: 'number',
        description: 'How many days ahead to look for events',
        default: 30,
      },
      timeFormat: {
        type: 'string',
        description: 'Time display format: "12h" or "24h"',
        default: '24h',
      },
      timezone: {
        type: 'string',
        description: 'IANA timezone for displaying event times',
        default: 'UTC',
      },
    },
    required: ['icalUrl', 'maxEvents', 'lookaheadDays', 'timeFormat', 'timezone'],
  },
  gridConstraints: {
    minW: 2,
    minH: 3,
    maxW: 8,
    maxH: 8,
    defaultW: 3,
    defaultH: 4,
  },
};
