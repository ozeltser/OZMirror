import type { LayoutData, GlobalSettings } from '../types';

const BASE_URL = import.meta.env.VITE_CONFIG_API_URL || '/api/config';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export async function getLayout(): Promise<LayoutData> {
  const res = await fetch(`${BASE_URL}/layout`);
  if (!res.ok) throw new Error(`Failed to fetch layout: ${res.status}`);
  return res.json();
}

export async function saveLayout(layout: LayoutData): Promise<void> {
  const res = await fetch(`${BASE_URL}/layout`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`Failed to save layout: ${res.status}`);
}

export async function getSettings(): Promise<GlobalSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

export async function saveSettings(settings: GlobalSettings): Promise<void> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to save settings: ${res.status}`);
}
