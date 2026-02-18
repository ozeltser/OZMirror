import type { Note, SystemStats, TimeData } from '../types';

const MODULES_BASE = import.meta.env.VITE_MODULES_API_URL || '/api/modules';

// ─── Clock ────────────────────────────────────────────────────────────────────

export async function getClockData(format = 'HH:mm:ss', timezone = 'UTC'): Promise<TimeData> {
  const params = new URLSearchParams({ format, timezone });
  const res = await fetch(`${MODULES_BASE}/clock/data?${params}`);
  if (!res.ok) throw new Error(`Clock API error: ${res.status}`);
  return res.json();
}

// ─── System Stats ─────────────────────────────────────────────────────────────

export async function getSystemStats(): Promise<SystemStats> {
  const res = await fetch(`${MODULES_BASE}/system_stats/data`);
  if (!res.ok) throw new Error(`System Stats API error: ${res.status}`);
  return res.json();
}

// ─── Sticky Notes ─────────────────────────────────────────────────────────────

export async function getNotes(instanceId: string): Promise<Note[]> {
  const res = await fetch(`${MODULES_BASE}/sticky_notes/notes?instanceId=${encodeURIComponent(instanceId)}`);
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json();
}

export async function createNote(
  instanceId: string,
  data: { content?: string; color?: string; font_size?: number }
): Promise<Note> {
  const res = await fetch(`${MODULES_BASE}/sticky_notes/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instance_id: instanceId, ...data }),
  });
  if (!res.ok) throw new Error(`Create note error: ${res.status}`);
  return res.json();
}

export async function updateNote(
  id: number,
  data: { content?: string; color?: string; font_size?: number }
): Promise<Note> {
  const res = await fetch(`${MODULES_BASE}/sticky_notes/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Update note error: ${res.status}`);
  return res.json();
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`${MODULES_BASE}/sticky_notes/notes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete note error: ${res.status}`);
}
