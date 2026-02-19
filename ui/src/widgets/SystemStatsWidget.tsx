/**
 * SystemStatsWidget — displays CPU, memory, and disk usage with progress bars.
 * Updated in real-time via WebSocket, falls back to REST polling.
 */

import React, { useState, useCallback } from 'react';
import { useModuleData } from '../hooks/useModuleData';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './SystemStatsWidget.module.css';

interface CpuStats {
  usage: number;
  cores: number;
  model: string;
}

interface MemoryStats {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

interface DiskStats {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  mountpoint: string;
}

interface SystemStatsData {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskStats;
  uptime: number;
  platform: string;
}

interface SystemStatsWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    showCpu?: boolean;
    showMemory?: boolean;
    showDisk?: boolean;
    refreshInterval?: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function barColor(percent: number): string {
  if (percent >= 90) return 'var(--stats-bar-critical, #ef5350)';
  if (percent >= 70) return 'var(--stats-bar-warning, #ffa726)';
  return 'var(--stats-bar-ok, #66bb6a)';
}

const SystemStatsWidget: React.FC<SystemStatsWidgetProps> = ({ instanceId, config }) => {
  const showCpu = config.showCpu ?? true;
  const showMemory = config.showMemory ?? true;
  const showDisk = config.showDisk ?? true;

  const { data: restData, isLoading, error } = useModuleData<SystemStatsData>(
    'system_stats',
    instanceId,
    10_000
  );

  const [realtimeData, setRealtimeData] = useState<SystemStatsData | null>(null);

  const handleEvent = useCallback((data: SystemStatsData) => {
    setRealtimeData(data);
  }, []);

  useModuleEvents<SystemStatsData>('system_stats', instanceId, handleEvent, 'update');

  const display = realtimeData ?? restData;

  if (isLoading && !display) {
    return (
      <div className={styles.stats}>
        <span className={styles.loading}>Loading…</span>
      </div>
    );
  }

  if (error && !display) {
    return (
      <div className={styles.stats}>
        <span className={styles.error}>Stats unavailable</span>
      </div>
    );
  }

  return (
    <div className={styles.stats}>
      <div className={styles.header}>
        <span className={styles.title}>System</span>
        {display?.uptime !== undefined && (
          <span className={styles.uptime}>up {formatUptime(display.uptime)}</span>
        )}
      </div>

      {showCpu && display?.cpu && (
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.label}>CPU</span>
            <span className={styles.value}>{display.cpu.usage}%</span>
          </div>
          <div className={styles.bar}>
            <div
              className={styles.barFill}
              style={{ width: `${display.cpu.usage}%`, backgroundColor: barColor(display.cpu.usage) }}
            />
          </div>
          <div className={styles.detail}>{display.cpu.cores} cores</div>
        </div>
      )}

      {showMemory && display?.memory && (
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.label}>RAM</span>
            <span className={styles.value}>{display.memory.usagePercent}%</span>
          </div>
          <div className={styles.bar}>
            <div
              className={styles.barFill}
              style={{
                width: `${display.memory.usagePercent}%`,
                backgroundColor: barColor(display.memory.usagePercent),
              }}
            />
          </div>
          <div className={styles.detail}>
            {formatBytes(display.memory.used)} / {formatBytes(display.memory.total)}
          </div>
        </div>
      )}

      {showDisk && display?.disk && (
        <div className={styles.metric}>
          <div className={styles.metricHeader}>
            <span className={styles.label}>Disk</span>
            <span className={styles.value}>{display.disk.usagePercent}%</span>
          </div>
          <div className={styles.bar}>
            <div
              className={styles.barFill}
              style={{
                width: `${display.disk.usagePercent}%`,
                backgroundColor: barColor(display.disk.usagePercent),
              }}
            />
          </div>
          <div className={styles.detail}>
            {formatBytes(display.disk.used)} / {formatBytes(display.disk.total)}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemStatsWidget;
