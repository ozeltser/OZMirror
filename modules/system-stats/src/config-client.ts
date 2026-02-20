/**
 * Config Service client for the System Stats module.
 */

import axios from 'axios';
import { MANIFEST } from './manifest';

const CONFIG_SERVICE_URL = process.env.CONFIG_SERVICE_URL ?? 'http://config-service:8000';
const API_KEY = process.env.API_KEY ?? '';
const MODULE_ID = process.env.MODULE_ID ?? 'system_stats';

export interface SystemStatsConfig {
  refreshInterval: number;
  showDisk: boolean;
}

export const DEFAULT_CONFIG: SystemStatsConfig = {
  refreshInterval: 5000,
  showDisk: true,
};

export async function registerModule(serviceUrl: string): Promise<void> {
  const body = {
    id: MODULE_ID,
    name: 'System Stats',
    serviceUrl,
    manifest: MANIFEST,
    status: 'online',
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await axios.post(`${CONFIG_SERVICE_URL}/api/config/modules/register`, body, {
        headers: { 'X-API-Key': API_KEY },
        timeout: 5000,
      });
      console.log('[config-client] Module registered successfully');
      return;
    } catch (err) {
      lastError = err;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[config-client] Registration attempt ${attempt} failed, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.error('[config-client] Module registration failed after 5 attempts:', lastError);
}

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function fetchInstanceConfig(instanceId: string): Promise<SystemStatsConfig> {
  if (!INSTANCE_ID_PATTERN.test(instanceId)) {
    console.warn(`[config-client] Invalid instanceId rejected: ${instanceId}`);
    return DEFAULT_CONFIG;
  }
  try {
    const { data } = await axios.get<SystemStatsConfig>(
      `${CONFIG_SERVICE_URL}/api/config/modules/${encodeURIComponent(MODULE_ID)}/config/${encodeURIComponent(instanceId)}`,
      { timeout: 3000 }
    );
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return DEFAULT_CONFIG;
  }
}
