/**
 * Single source of truth for the RSS module manifest.
 * Imported by config-client.ts (registration) and routes.ts (GET /manifest).
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'rss';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'RSS Feed',
  description: 'Headlines from any RSS or Atom feed',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'rss',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      feedUrl: {
        type: 'string',
        description: 'RSS or Atom feed URL',
        default: '',
      },
      maxItems: {
        type: 'number',
        description: 'Maximum number of headlines to display',
        default: 10,
      },
      showDescription: {
        type: 'boolean',
        description: 'Show article description/summary below the title',
        default: true,
      },
    },
    required: ['feedUrl', 'maxItems'],
  },
  gridConstraints: {
    minW: 2,
    minH: 3,
    maxW: 8,
    maxH: 10,
    defaultW: 3,
    defaultH: 4,
  },
};
