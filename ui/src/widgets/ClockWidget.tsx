/**
 * ClockWidget — displays time and date, updated in real-time via WebSocket.
 * Falls back to REST polling if WebSocket is unavailable.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './ClockWidget.module.css';

interface ClockData {
  time: string;
  date: string;
  timezone: string;
  timestamp: number;
}

interface ClockWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    format?: string;
    timezone?: string;
    showDate?: boolean;
  };
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ instanceId, config }) => {
  const showDate = config.showDate ?? true;

  // REST fetch for initial data (polls every 60s as fallback)
  const { data: restData, isLoading, error } = useModuleData<ClockData>('clock', instanceId, 60_000);

  // Real-time override via WebSocket
  const [realtimeData, setRealtimeData] = useState<ClockData | null>(null);

  const handleEvent = useCallback((data: ClockData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<ClockData>('clock', instanceId, handleEvent);

  const display = realtimeData ?? restData;

  if (isLoading && !display) {
    return (
      <div className={styles.clock}>
        <span className={styles.loading}>Loading…</span>
      </div>
    );
  }

  if (error && !display) {
    return (
      <div className={styles.clock}>
        <span className={styles.error}>Clock unavailable</span>
      </div>
    );
  }

  return (
    <div className={styles.clock}>
      <div className={styles.time}>{display?.time ?? '--:--:--'}</div>
      {showDate && display?.date && (
        <div className={styles.date}>{display.date}</div>
      )}
      {display?.timezone && display.timezone !== 'UTC' && (
        <div className={styles.timezone}>{display.timezone}</div>
      )}
    </div>
  );
};

export default ClockWidget;
