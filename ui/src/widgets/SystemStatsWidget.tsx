import { useState, useEffect } from 'react';
import { useWebSocketChannel } from '../hooks/useWebSocket';
import { getSystemStats } from '../api/modulesApi';
import type { SystemStats } from '../types';
import styles from './SystemStatsWidget.module.css';

interface SystemStatsWidgetProps {
  instanceId: string;
  config?: {
    showCpu?: boolean;
    showMemory?: boolean;
    showDisk?: boolean;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function UsageBar({ percent, label, detail }: { percent: number; label: string; detail: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const colorClass =
    clamped > 90 ? styles.critical : clamped > 70 ? styles.warning : styles.normal;

  return (
    <div className={styles.statRow}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{detail}</span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default function SystemStatsWidget({
  instanceId: _instanceId,
  config = {},
}: SystemStatsWidgetProps) {
  const showCpu = config.showCpu ?? true;
  const showMemory = config.showMemory ?? true;
  const showDisk = config.showDisk ?? true;

  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    getSystemStats().then(setStats).catch(console.error);
  }, []);

  useWebSocketChannel('module:system_stats:update', (payload) => {
    setStats(payload as SystemStats);
  });

  if (!stats) {
    return (
      <div className={styles.widget}>
        <span className={styles.loading}>Loading stats...</span>
      </div>
    );
  }

  return (
    <div className={styles.widget}>
      <div className={styles.title}>System Stats</div>
      <div className={styles.stats}>
        {showCpu && (
          <UsageBar
            label="CPU"
            percent={stats.cpu.usage}
            detail={`${stats.cpu.usage}% · ${stats.cpu.cores} cores`}
          />
        )}
        {showMemory && (
          <UsageBar
            label="RAM"
            percent={stats.memory.usagePercent}
            detail={`${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`}
          />
        )}
        {showDisk && (
          <UsageBar
            label="Disk"
            percent={stats.disk.usagePercent}
            detail={`${formatBytes(stats.disk.used)} / ${formatBytes(stats.disk.total)}`}
          />
        )}
      </div>
      <div className={styles.uptime}>
        Uptime: {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
      </div>
    </div>
  );
}
