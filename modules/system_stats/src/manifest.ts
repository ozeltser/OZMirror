/**
 * Single source of truth for the System Stats module manifest.
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'system_stats';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'System Stats',
  description: 'Real-time CPU, RAM, and disk usage monitoring',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'chart-bar',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      refreshInterval: { type: 'number', description: 'Stats publish interval in ms', default: 5000 },
      showCpu: { type: 'boolean', description: 'Show CPU usage', default: true },
      showMemory: { type: 'boolean', description: 'Show memory usage', default: true },
      showDisk: { type: 'boolean', description: 'Show disk usage', default: true },
    },
    required: ['refreshInterval', 'showCpu', 'showMemory', 'showDisk'],
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 6,
    maxH: 6,
    defaultW: 3,
    defaultH: 3,
  },
};
