/**
 * Single source of truth for the System Stats module manifest.
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'system_stats';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'System Stats',
  description: 'Real-time CPU, memory, and disk usage monitor',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'system_stats',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      refreshInterval: {
        type: 'number',
        description: 'How often to refresh stats (milliseconds)',
        default: 5000,
      },
      showDisk: {
        type: 'boolean',
        description: 'Show disk usage',
        default: true,
      },
    },
    required: ['refreshInterval', 'showDisk'],
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 6,
    defaultW: 3,
    defaultH: 3,
  },
};
