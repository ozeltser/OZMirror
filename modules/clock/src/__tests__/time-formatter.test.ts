import { describe, it, expect } from 'vitest';
import { formatTime, formatDate, buildTimeData } from '../time-formatter';

// Pin a specific moment for deterministic tests:
// 2024-03-15 14:05:09 UTC  (a Friday)
const FIXED_DATE = new Date('2024-03-15T14:05:09Z');

describe('formatTime', () => {
  it('formats HH:mm:ss in 24h', () => {
    expect(formatTime(FIXED_DATE, 'HH:mm:ss', 'UTC')).toBe('14:05:09');
  });

  it('formats HH:mm without seconds', () => {
    expect(formatTime(FIXED_DATE, 'HH:mm', 'UTC')).toBe('14:05');
  });

  it('formats hh:mm A in 12h with AM/PM', () => {
    expect(formatTime(FIXED_DATE, 'hh:mm A', 'UTC')).toBe('02:05 PM');
  });

  it('formats midnight as 12:00 AM in 12h', () => {
    const midnight = new Date('2024-03-15T00:00:00Z');
    const result = formatTime(midnight, 'hh:mm A', 'UTC');
    expect(result).toBe('12:00 AM');
  });

  it('formats noon as 12:00 PM in 12h', () => {
    const noon = new Date('2024-03-15T12:00:00Z');
    const result = formatTime(noon, 'hh:mm A', 'UTC');
    expect(result).toBe('12:00 PM');
  });

  it('respects timezone offset — America/New_York is UTC-4 in mid-March (EDT)', () => {
    // DST started March 10 2024, so New York is EDT (UTC-4) on March 15.
    // 14:05 UTC → 10:05 EDT
    const result = formatTime(FIXED_DATE, 'HH:mm', 'America/New_York');
    expect(result).toBe('10:05');
  });

  it('respects positive timezone — Asia/Tokyo is UTC+9', () => {
    // 14:05 UTC → 23:05 Asia/Tokyo
    const result = formatTime(FIXED_DATE, 'HH:mm', 'Asia/Tokyo');
    expect(result).toBe('23:05');
  });

  it('returns format string unchanged when no tokens match', () => {
    const result = formatTime(FIXED_DATE, 'no tokens here', 'UTC');
    expect(result).toBe('no tokens here');
  });
});

describe('formatDate', () => {
  it('returns a non-empty date string', () => {
    const result = formatDate(FIXED_DATE, 'UTC');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the year', () => {
    const result = formatDate(FIXED_DATE, 'UTC');
    expect(result).toContain('2024');
  });

  it('includes the day of week', () => {
    // 2024-03-15 is a Friday
    const result = formatDate(FIXED_DATE, 'UTC');
    expect(result).toContain('Friday');
  });

  it('includes the month name', () => {
    const result = formatDate(FIXED_DATE, 'UTC');
    expect(result).toContain('March');
  });
});

describe('buildTimeData', () => {
  it('returns an object with all required fields', () => {
    const data = buildTimeData('HH:mm:ss', 'UTC');
    expect(data).toHaveProperty('time');
    expect(data).toHaveProperty('date');
    expect(data).toHaveProperty('timezone');
    expect(data).toHaveProperty('timestamp');
  });

  it('timestamp is a positive number', () => {
    const data = buildTimeData('HH:mm:ss', 'UTC');
    expect(typeof data.timestamp).toBe('number');
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it('timezone field matches the input timezone', () => {
    const data = buildTimeData('HH:mm', 'Europe/London');
    expect(data.timezone).toBe('Europe/London');
  });

  it('time field is a non-empty string', () => {
    const data = buildTimeData('HH:mm:ss', 'UTC');
    expect(typeof data.time).toBe('string');
    expect(data.time.length).toBeGreaterThan(0);
  });
});
