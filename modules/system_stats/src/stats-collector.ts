/**
 * System metrics collection using Node.js built-in os and fs modules.
 * Works on Linux/Raspberry Pi without external dependencies.
 */

import os from 'os';
import fs from 'fs';

export interface CpuStats {
  usage: number;
  cores: number;
  model: string;
}

export interface MemoryStats {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface DiskStats {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  mountpoint: string;
}

export interface SystemStatsData {
  cpu: CpuStats;
  memory: MemoryStats;
  disk: DiskStats;
  uptime: number;
  platform: string;
}

interface CpuSample {
  idle: number;
  total: number;
}

let previousSample: CpuSample | null = null;

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

function getCpuUsage(): number {
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

function getMemoryStats(): MemoryStats {
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

function getDiskStats(mountpoint = '/'): DiskStats {
  try {
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
    return { total: 0, used: 0, free: 0, usagePercent: 0, mountpoint };
  }
}

/**
 * Collect a full system stats snapshot.
 */
export function collectStats(): SystemStatsData {
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
  };
}
