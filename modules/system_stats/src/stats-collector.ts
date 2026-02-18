import os from 'os';
import fs from 'fs';

export interface CpuStats {
  usage: number; // percentage 0-100
  cores: number;
  model: string;
}

export interface MemoryStats {
  total: number; // bytes
  used: number;  // bytes
  free: number;  // bytes
  usagePercent: number;
}

export interface DiskStats {
  total: number; // bytes
  used: number;  // bytes
  free: number;  // bytes
  usagePercent: number;
  mountpoint: string;
}

export interface SystemStats {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskStats;
  uptime: number; // seconds
  platform: string;
  timestamp: number;
}

// CPU usage calculation: measure diff between two samples
interface CpuSample {
  idle: number;
  total: number;
}

function getCpuSample(): CpuSample {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

let previousSample: CpuSample | null = null;

export function getCpuUsage(): number {
  const current = getCpuSample();

  if (!previousSample) {
    previousSample = current;
    return 0;
  }

  const idleDiff = current.idle - previousSample.idle;
  const totalDiff = current.total - previousSample.total;
  previousSample = current;

  if (totalDiff === 0) return 0;
  return Math.round(((totalDiff - idleDiff) / totalDiff) * 100 * 10) / 10;
}

export function getMemoryStats(): MemoryStats {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total,
    used,
    free,
    usagePercent: Math.round((used / total) * 100 * 10) / 10,
  };
}

export function getDiskStats(mountpoint = '/'): DiskStats {
  try {
    // Use /proc/mounts or statfs via df parsing for cross-platform
    // On Linux we can read /proc/mounts and use fs.statSync
    const stats = fs.statfsSync(mountpoint);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;

    return {
      total,
      used,
      free,
      usagePercent: total > 0 ? Math.round((used / total) * 100 * 10) / 10 : 0,
      mountpoint,
    };
  } catch {
    // Fallback if statfsSync not available (older Node versions)
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
      mountpoint,
    };
  }
}

export function collectStats(): SystemStats {
  const cpus = os.cpus();

  return {
    cpu: {
      usage: getCpuUsage(),
      cores: cpus.length,
      model: cpus[0]?.model ?? 'Unknown',
    },
    memory: getMemoryStats(),
    disk: getDiskStats('/'),
    uptime: Math.round(os.uptime()),
    platform: os.platform(),
    timestamp: Date.now(),
  };
}
