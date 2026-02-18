/**
 * Axios client for the OzMirror Configuration Service.
 * All write operations include the API key header.
 */

import axios from 'axios';
import type { LayoutData, GlobalSettings, RegisteredModule, Theme } from '../types';

const BASE_URL = '/api/config';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

const client = axios.create({ baseURL: BASE_URL });

// Attach API key to mutating requests
client.interceptors.request.use((config) => {
  const method = (config.method ?? '').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && API_KEY) {
    config.headers['X-API-Key'] = API_KEY;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export async function fetchLayout(): Promise<LayoutData> {
  const { data } = await client.get<LayoutData>('/layout');
  return data;
}

export async function saveLayout(layout: LayoutData): Promise<void> {
  await client.put('/layout', layout);
}

export async function fetchProfiles(): Promise<string[]> {
  const { data } = await client.get<string[]>('/layout/profiles');
  return data;
}

export async function createProfile(name: string, copyFrom = 'default'): Promise<void> {
  await client.post('/layout/profiles', { name, copyFrom });
}

export async function deleteProfile(name: string): Promise<void> {
  await client.delete(`/layout/profiles/${name}`);
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function fetchModules(): Promise<RegisteredModule[]> {
  const { data } = await client.get<RegisteredModule[]>('/modules');
  return data;
}

export async function fetchModule(id: string): Promise<RegisteredModule> {
  const { data } = await client.get<RegisteredModule>(`/modules/${id}`);
  return data;
}

export async function fetchInstanceConfig(
  moduleId: string,
  instanceId: string
): Promise<Record<string, unknown>> {
  const { data } = await client.get<Record<string, unknown>>(
    `/modules/${moduleId}/config/${instanceId}`
  );
  return data;
}

export async function updateInstanceConfig(
  moduleId: string,
  instanceId: string,
  config: Record<string, unknown>
): Promise<void> {
  await client.put(`/modules/${moduleId}/config/${instanceId}`, config);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<GlobalSettings> {
  const { data } = await client.get<GlobalSettings>('/settings');
  return data;
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  await client.put('/settings', settings);
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export async function fetchThemes(): Promise<Theme[]> {
  const { data } = await client.get<Theme[]>('/themes');
  return data;
}

export async function createTheme(theme: Theme): Promise<void> {
  await client.post('/themes', theme);
}
