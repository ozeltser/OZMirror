/**
 * Time formatting utilities for the Clock module.
 * Uses Intl.DateTimeFormat for locale-aware formatting.
 */

export interface TimeData {
  time: string;
  date: string;
  timezone: string;
  timestamp: number;
}

/**
 * Format a Date object according to a format string and timezone.
 * Supported tokens: HH (24h hours), hh (12h hours), mm (minutes),
 * ss (seconds), A (AM/PM).
 */
export function formatTime(date: Date, format: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const partsMap: Record<string, string> = {};
  for (const p of parts) {
    partsMap[p.type] = p.value;
  }

  const hour24 = partsMap['hour'] ?? '00';
  const minute = partsMap['minute'] ?? '00';
  const second = partsMap['second'] ?? '00';
  const hourInt = parseInt(hour24, 10);
  const hour12Raw = hourInt % 12 || 12;
  const hour12 = String(hour12Raw).padStart(2, '0');
  const ampm = hourInt < 12 ? 'AM' : 'PM';

  return format
    .replaceAll('HH', hour24)
    .replaceAll('hh', hour12)
    .replaceAll('mm', minute)
    .replaceAll('ss', second)
    .replaceAll('A', ampm);
}

/**
 * Format a Date object as a readable date string in the given timezone.
 */
export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Build a TimeData snapshot from the current moment.
 */
export function buildTimeData(format: string, timezone: string): TimeData {
  const now = new Date();
  return {
    time: formatTime(now, format, timezone),
    date: formatDate(now, timezone),
    timezone,
    timestamp: now.getTime(),
  };
}
