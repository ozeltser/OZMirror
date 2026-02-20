/**
 * SystemStatsWidget — displays CPU, memory, and disk usage.
 * Updated in real-time via WebSocket; falls back to REST polling.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './SystemStatsWidget.module.css';

interface StatsData {
  cpu: { usage: number };
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  timestamp: number;
}

interface SystemStatsWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    showDisk?: boolean;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function usagePercent(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

interface GaugeBarProps {
  percent: number;
  label: string;
  detail: string;
}

const GaugeBar: React.FC<GaugeBarProps> = ({ percent, label, detail }) => (
  <div className={styles.gauge}>
    <div className={styles.gaugeHeader}>
      <span className={styles.gaugeLabel}>{label}</span>
      <span className={styles.gaugeDetail}>{detail}</span>
    </div>
    <div className={styles.barTrack}>
      <div
        className={styles.barFill}
        style={{ width: `${Math.min(percent, 100)}%` }}
        data-warn={percent > 80 ? 'true' : 'false'}
      />
    </div>
    <span className={styles.gaugePercent}>{percent}%</span>
  </div>
);

const SystemStatsWidget: React.FC<SystemStatsWidgetProps> = ({ instanceId, config }) => {
  const showDisk = config.showDisk ?? true;

  const { data: restData, isLoading, error } = useModuleData<StatsData>(
    'system_stats',
    instanceId,
    10_000
  );

  const [realtimeData, setRealtimeData] = useState<StatsData | null>(null);

  const handleEvent = useCallback((data: StatsData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<StatsData>('system_stats', instanceId, handleEvent, `data:${instanceId}`);

  const display = realtimeData ?? restData;

  if (isLoading && !display) {
    return (
      <div className={styles.container}>
        <span className={styles.loading}>Loading…</span>
      </div>
    );
  }

  if (error && !display) {
    return (
      <div className={styles.container}>
        <span className={styles.error}>Stats unavailable</span>
      </div>
    );
  }

  const cpuPercent = display?.cpu.usage ?? 0;
  const memPercent = display
    ? usagePercent(display.memory.used, display.memory.total)
    : 0;
  const diskPercent = display
    ? usagePercent(display.disk.used, display.disk.total)
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.title}>System Stats</div>

      <GaugeBar
        label="CPU"
        percent={cpuPercent}
        detail={`${cpuPercent.toFixed(1)}%`}
      />

      <GaugeBar
        label="RAM"
        percent={memPercent}
        detail={
          display
            ? `${formatBytes(display.memory.used)} / ${formatBytes(display.memory.total)}`
            : '—'
        }
      />

      {showDisk && (
        <GaugeBar
          label="Disk"
          percent={diskPercent}
          detail={
            display
              ? `${formatBytes(display.disk.used)} / ${formatBytes(display.disk.total)}`
              : '—'
          }
        />
      )}
    </div>
  );
};

export default SystemStatsWidget;
