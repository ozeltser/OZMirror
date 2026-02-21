/**
 * CalendarWidget — displays upcoming events from a configured iCal feed.
 * Updated in real-time via WebSocket; falls back to REST polling every 15 min.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './CalendarWidget.module.css';

interface CalendarEvent {
  uid: string;
  title: string;
  start: string;  // ISO 8601
  end: string;    // ISO 8601
  allDay: boolean;
  location?: string;
  description?: string;
}

interface CalendarData {
  instanceId: string;
  events: CalendarEvent[];
  fetchedAt: number;
  message?: string;
}

interface CalendarWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    timeFormat?: '12h' | '24h';
    timezone?: string;
    maxEvents?: number;
  };
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ instanceId, config }) => {
  const timeFormat = config.timeFormat ?? '24h';
  const timezone = config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: restData, isLoading, error } = useModuleData<CalendarData>(
    'calendar',
    instanceId,
    900_000  // poll every 15 min as fallback
  );

  const [realtimeData, setRealtimeData] = useState<CalendarData | null>(null);

  const handleEvent = useCallback((data: CalendarData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<CalendarData>('calendar', instanceId, handleEvent);

  const display = realtimeData ?? restData;

  if (isLoading && !display) {
    return (
      <div className={styles.calendar}>
        <span className={styles.loading}>Loading calendar…</span>
      </div>
    );
  }

  if (error && !display) {
    return (
      <div className={styles.calendar}>
        <span className={styles.error}>Calendar unavailable</span>
      </div>
    );
  }

  const events = display?.events ?? [];

  if (display?.message && events.length === 0) {
    return (
      <div className={styles.calendar}>
        <span className={styles.empty}>{display.message}</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.calendar}>
        <span className={styles.empty}>No upcoming events</span>
      </div>
    );
  }

  return (
    <div className={styles.calendar}>
      <ul className={styles.eventList}>
        {events.map((event) => (
          <li key={event.uid} className={styles.eventItem}>
            <div className={styles.eventDate}>
              {formatEventDate(event, timezone)}
            </div>
            <div className={styles.eventTime}>
              {event.allDay ? 'All day' : formatEventTime(event.start, timeFormat, timezone)}
            </div>
            <div className={styles.eventTitle}>{event.title}</div>
            {event.location && (
              <div className={styles.eventLocation}>{event.location}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatEventDate(event: CalendarEvent, timezone: string): string {
  const start = new Date(event.start);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const startDay = start.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' });
  const todayStr = today.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' });
  const tomorrowStr = tomorrow.toLocaleDateString('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' });

  if (startDay === todayStr) return 'Today';
  if (startDay === tomorrowStr) return 'Tomorrow';

  return start.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventTime(isoString: string, timeFormat: '12h' | '24h', timezone: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  });
}

export default CalendarWidget;
