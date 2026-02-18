// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

export interface GridItem {
  i: string;   // instance ID, e.g. "clock_01"
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface ModuleInstanceConfig {
  moduleId: string;
  config: Record<string, unknown>;
}

export interface LayoutProfile {
  grid: GridItem[];
  moduleConfigs: Record<string, ModuleInstanceConfig>;
}

export interface LayoutData {
  activeProfile: string;
  layouts: Record<string, LayoutProfile>;
}

// ---------------------------------------------------------------------------
// Module registry types
// ---------------------------------------------------------------------------

export interface GridConstraints {
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  defaultW?: number;
  defaultH?: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  defaultConfig: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  gridConstraints?: GridConstraints;
}

export interface RegisteredModule {
  id: string;
  name: string;
  serviceUrl: string;
  manifest: ModuleManifest;
  status: 'online' | 'offline' | 'error';
}

// ---------------------------------------------------------------------------
// Settings / themes
// ---------------------------------------------------------------------------

export interface GlobalSettings {
  theme: string;
  kiosk: boolean;
  cursorTimeout: number;
  fontScale: number;
  autoStart: boolean;
}

export interface Theme {
  id: string;
  name: string;
  variables: Record<string, string>;
}

// ---------------------------------------------------------------------------
// WebSocket events
// ---------------------------------------------------------------------------

export interface WsMessage<T = unknown> {
  channel: string;
  payload: T;
}

export interface ModuleEventPayload<D = unknown> {
  instanceId: string;
  data: D;
  timestamp: number;
}

export interface SystemEventPayload {
  action: string;
  [key: string]: unknown;
}
