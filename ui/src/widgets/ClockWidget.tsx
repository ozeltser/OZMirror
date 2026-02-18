import { useState, useEffect } from 'react';
import { useWebSocketChannel } from '../hooks/useWebSocket';
import { getClockData } from '../api/modulesApi';
import type { TimeData } from '../types';
import styles from './ClockWidget.module.css';

interface ClockWidgetProps {
  instanceId: string;
  config?: {
    format?: string;
    timezone?: string;
    showDate?: boolean;
  };
}

export default function ClockWidget({ instanceId: _instanceId, config = {} }: ClockWidgetProps) {
  const format = config.format ?? 'HH:mm:ss';
  const timezone = config.timezone ?? 'UTC';
  const showDate = config.showDate ?? true;

  const [data, setData] = useState<TimeData | null>(null);

  // Initial fetch
  useEffect(() => {
    getClockData(format, timezone)
      .then(setData)
      .catch(console.error);
  }, [format, timezone]);

  // Real-time updates via WebSocket
  useWebSocketChannel('module:clock:time', (payload) => {
    setData(payload as TimeData);
  });

  if (!data) {
    return <div className={styles.widget}><span className={styles.loading}>--:--:--</span></div>;
  }

  return (
    <div className={styles.widget}>
      <div className={styles.time}>{data.time}</div>
      {showDate && <div className={styles.date}>{data.date}</div>}
      <div className={styles.timezone}>{data.timezone}</div>
    </div>
  );
}
