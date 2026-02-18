export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface ModuleConfig {
  moduleId: string;
  config: Record<string, unknown>;
}

export interface LayoutProfile {
  grid: GridItem[];
  moduleConfigs: Record<string, ModuleConfig>;
}

export interface LayoutData {
  activeProfile: string;
  layouts: Record<string, LayoutProfile>;
}

export interface GlobalSettings {
  theme: 'dark' | 'light' | 'amoled';
  kiosk: boolean;
  cursorTimeout: number;
  fontScale: number;
  autoStart: boolean;
}

// Clock module types
export interface TimeData {
  time: string;
  date: string;
  timezone: string;
  timestamp: number;
}

// System stats types
export interface SystemStats {
  cpu: { usage: number; cores: number; model: string };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number; mountpoint: string };
  uptime: number;
  platform: string;
  timestamp: number;
}

// Sticky notes types
export interface Note {
  id: number;
  instance_id: string;
  content: string;
  color: string;
  font_size: number;
  created_at: string;
  updated_at: string;
}
