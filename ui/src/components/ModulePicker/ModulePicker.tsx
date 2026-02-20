/**
 * ModulePicker — slide-in drawer for adding modules to the canvas.
 * Fetches registered modules from the Config Service and lets the user
 * click one to add a new instance to the active layout profile.
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { fetchModules, saveLayout } from '../../api/config';
import type { RegisteredModule } from '../../types';
import styles from './ModulePicker.module.css';

const MODULE_ICONS: Record<string, string> = {
  clock: '🕐',
  weather: '🌤',
  calendar: '📅',
  rss: '📰',
  system_stats: '📊',
  now_playing: '🎵',
  sticky_notes: '📝',
};

const ModulePicker: React.FC = () => {
  const { isModulePickerOpen, toggleModulePicker, layout, setLayout } = useAppStore();
  const [modules, setModules] = useState<RegisteredModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isModulePickerOpen) return;
    setLoading(true);
    setError(null);
    fetchModules()
      .then(setModules)
      .catch(() => setError('Could not load modules. Is the Config Service running?'))
      .finally(() => setLoading(false));
  }, [isModulePickerOpen]);

  const handleAdd = async (mod: RegisteredModule) => {
    if (!layout) return;
    const instanceId = `${mod.id}_${Date.now()}`;
    const { defaultW = 4, defaultH = 3 } = mod.manifest?.gridConstraints ?? {};
    const activeProfile = layout.activeProfile;
    const current = layout.layouts[activeProfile];
    const updatedLayout = {
      ...layout,
      layouts: {
        ...layout.layouts,
        [activeProfile]: {
          grid: [
            ...current.grid,
            { i: instanceId, x: 0, y: Infinity, w: defaultW, h: defaultH },
          ],
          moduleConfigs: {
            ...current.moduleConfigs,
            [instanceId]: {
              moduleId: mod.id,
              config: mod.manifest?.defaultConfig ?? {},
            },
          },
        },
      },
    };
    setLayout(updatedLayout);
    toggleModulePicker();
    try {
      await saveLayout(updatedLayout);
    } catch {
      console.error('[ModulePicker] Failed to persist layout after adding module');
    }
  };

  if (!isModulePickerOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={toggleModulePicker} />
      <div className={styles.drawer} role="dialog" aria-label="Add Module">
        <div className={styles.header}>
          <span>Add Module</span>
          <button className={styles.closeBtn} onClick={toggleModulePicker} aria-label="Close">
            ✕
          </button>
        </div>

        {loading && <div className={styles.statusText}>Loading modules…</div>}
        {error && <div className={styles.statusText} style={{ color: '#ef5350' }}>{error}</div>}

        {!loading && !error && (
          <div className={styles.list}>
            {modules.length === 0 ? (
              <div className={styles.statusText}>No modules registered.</div>
            ) : (
              modules.map((mod) => (
                <button
                  key={mod.id}
                  className={styles.moduleCard}
                  onClick={() => handleAdd(mod)}
                  disabled={mod.status !== 'online'}
                  title={mod.status !== 'online' ? `Module is ${mod.status}` : `Add ${mod.name}`}
                >
                  <span className={styles.icon}>{MODULE_ICONS[mod.id] ?? '📦'}</span>
                  <span className={styles.name}>{mod.name}</span>
                  <span
                    className={styles.status}
                    data-online={mod.status === 'online' ? 'true' : 'false'}
                  >
                    {mod.status}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ModulePicker;
