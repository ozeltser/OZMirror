import { useState, useCallback } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-grid-layout/css/resizable.css';
import ClockWidget from '../widgets/ClockWidget';
import SystemStatsWidget from '../widgets/SystemStatsWidget';
import StickyNotesWidget from '../widgets/StickyNotesWidget';
import type { LayoutProfile } from '../types';
import styles from './ModuleGrid.module.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ModuleGridProps {
  profile: LayoutProfile;
  editMode: boolean;
  onLayoutChange?: (layout: Layout[]) => void;
}

function renderWidget(moduleId: string, instanceId: string, config: Record<string, unknown>) {
  switch (moduleId) {
    case 'clock':
      return (
        <ClockWidget
          instanceId={instanceId}
          config={config as { format?: string; timezone?: string; showDate?: boolean }}
        />
      );
    case 'system_stats':
      return (
        <SystemStatsWidget
          instanceId={instanceId}
          config={config as { showCpu?: boolean; showMemory?: boolean; showDisk?: boolean }}
        />
      );
    case 'sticky_notes':
      return (
        <StickyNotesWidget
          instanceId={instanceId}
          config={config as { defaultColor?: string; defaultFontSize?: number }}
        />
      );
    default:
      return (
        <div className={styles.unknownWidget}>
          <span>Unknown module: {moduleId}</span>
        </div>
      );
  }
}

export default function ModuleGrid({ profile, editMode, onLayoutChange }: ModuleGridProps) {
  const [currentLayout, setCurrentLayout] = useState<Layout[]>(
    profile.grid.map((item) => ({ ...item }))
  );

  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      setCurrentLayout(layout);
      onLayoutChange?.(layout);
    },
    [onLayoutChange]
  );

  const layouts = { lg: currentLayout };

  return (
    <ResponsiveGridLayout
      className={`${styles.grid} ${editMode ? styles.editMode : ''}`}
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={80}
      isDraggable={editMode}
      isResizable={editMode}
      onLayoutChange={handleLayoutChange}
      margin={[8, 8]}
    >
      {currentLayout.map((item) => {
        const moduleConfig = profile.moduleConfigs[item.i];
        if (!moduleConfig) return null;

        return (
          <div key={item.i} className={styles.moduleContainer}>
            {editMode && (
              <div className={styles.editOverlay}>
                <span className={styles.moduleLabel}>{moduleConfig.moduleId}</span>
                <span className={styles.dragHint}>⠿ Drag to move</span>
              </div>
            )}
            {renderWidget(moduleConfig.moduleId, item.i, moduleConfig.config)}
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
