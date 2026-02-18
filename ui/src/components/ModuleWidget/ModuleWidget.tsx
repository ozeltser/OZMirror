/**
 * Generic module widget wrapper.
 * Renders the appropriate widget component based on moduleId,
 * and shows edit-mode controls when in edit mode.
 */

import React, { lazy, Suspense } from 'react';
import styles from './ModuleWidget.module.css';
import type { ModuleInstanceConfig } from '../../types';

// Lazy-load widget components by moduleId
const WIDGET_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<WidgetProps>>> = {
  clock: lazy(() => import('../../widgets/ClockWidget')),
};

interface WidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: Record<string, unknown>;
}

interface ModuleWidgetProps {
  instanceId: string;
  moduleConfig: ModuleInstanceConfig;
  isEditMode: boolean;
  onRemove?: (instanceId: string) => void;
}

const ModuleWidget: React.FC<ModuleWidgetProps> = ({
  instanceId,
  moduleConfig,
  isEditMode,
  onRemove,
}) => {
  const { moduleId, config } = moduleConfig;
  const Widget = WIDGET_MAP[moduleId];

  return (
    <div className={`${styles.wrapper} ${isEditMode ? styles.editMode : ''}`}>
      {Widget ? (
        <Suspense fallback={<div style={{ padding: 8, color: '#999' }}>Loading…</div>}>
          <Widget instanceId={instanceId} isEditMode={isEditMode} config={config} />
        </Suspense>
      ) : (
        <div style={{ padding: 8, color: '#ef5350', fontSize: '0.85rem' }}>
          Unknown module: {moduleId}
        </div>
      )}

      {isEditMode && (
        <>
          <div className={styles.editOverlay}>
            {onRemove && (
              <button className={styles.editBtn} onClick={() => onRemove(instanceId)} title="Remove">
                ✕
              </button>
            )}
          </div>
          <div className={styles.moduleLabel}>{moduleId}</div>
        </>
      )}
    </div>
  );
};

export default ModuleWidget;
