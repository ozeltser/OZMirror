/**
 * System stats collector using the systeminformation library.
 * Returns CPU %, RAM, and disk usage for the host machine.
 */

import si from 'systeminformation';

export interface StatsData {
  cpu: { usage: number };
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  timestamp: number;
}

export async function collectStats(): Promise<StatsData> {
  const [load, mem, fsSizes] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ]);

  const primaryFs = fsSizes.find((fs) => fs.mount === '/') ?? fsSizes[0];

  return {
    cpu: {
      usage: Math.round(load.currentLoad * 10) / 10,
    },
    memory: {
      used: mem.used,
      total: mem.total,
    },
    disk: {
      used: primaryFs?.used ?? 0,
      total: primaryFs?.size ?? 0,
    },
    timestamp: Date.now(),
  };
}
