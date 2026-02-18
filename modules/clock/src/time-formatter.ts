export interface TimeData {
  time: string;
  date: string;
  timezone: string;
  timestamp: number;
}

export function formatTime(format: string, timezone: string): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { timeZone: timezone };

  if (format === 'HH:mm:ss') {
    return new Intl.DateTimeFormat('en-GB', {
      ...opts,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
  }

  if (format === 'HH:mm') {
    return new Intl.DateTimeFormat('en-GB', {
      ...opts,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  }

  if (format === 'h:mm:ss A') {
    return new Intl.DateTimeFormat('en-US', {
      ...opts,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);
  }

  if (format === 'h:mm A') {
    return new Intl.DateTimeFormat('en-US', {
      ...opts,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);
  }

  // Default: HH:mm:ss
  return new Intl.DateTimeFormat('en-GB', {
    ...opts,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

export function formatDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

export function getTimeData(format: string, timezone: string): TimeData {
  return {
    time: formatTime(format, timezone),
    date: formatDate(timezone),
    timezone,
    timestamp: Date.now(),
  };
}
