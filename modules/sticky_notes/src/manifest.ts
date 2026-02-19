/**
 * Single source of truth for the Sticky Notes module manifest.
 */

import { DEFAULT_CONFIG } from './config-client';

const MODULE_ID = process.env.MODULE_ID ?? 'sticky_notes';

export const MANIFEST = {
  id: MODULE_ID,
  name: 'Sticky Notes',
  description: 'Editable sticky notes with color and font customization',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'sticky-note',
  defaultConfig: DEFAULT_CONFIG,
  configSchema: {
    type: 'object',
    properties: {
      defaultColor: { type: 'string', description: 'Default note color (hex)', default: '#ffeb3b' },
      defaultFontSize: { type: 'number', description: 'Default font size in px', default: 16 },
    },
    required: ['defaultColor', 'defaultFontSize'],
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 8,
    defaultW: 3,
    defaultH: 4,
  },
};
