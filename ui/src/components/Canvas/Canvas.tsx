/**
 * Canvas — the main display area.
 * Uses react-grid-layout for drag-and-drop module placement.
 */

import React, { useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ModuleWidget from '../ModuleWidget/ModuleWidget';
import styles from './Canvas.module.css';
import type { LayoutProfile, GridItem } from '../../types';

interface CanvasProps {
  profile: LayoutProfile;
  isEditMode: boolean;
  onLayoutChange: (grid: GridItem[]) => void;
  onRemoveModule: (instanceId: string) => void;
  width: number;
}

const Canvas: React.FC<CanvasProps> = ({
  profile,
  isEditMode,
  onLayoutChange,
  onRemoveModule,
  width,
}) => {
  const layout: Layout[] = profile.grid.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
    isDraggable: isEditMode,
    isResizable: isEditMode,
  }));

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      const grid: GridItem[] = newLayout.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      }));
      onLayoutChange(grid);
    },
    [onLayoutChange]
  );

  return (
    <div className={styles.canvas}>
      <GridLayout
        layout={layout}
        cols={24}
        rowHeight={40}
        width={width}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        useCSSTransforms
      >
        {profile.grid.map((item) => {
          const moduleConfig = profile.moduleConfigs[item.i];
          if (!moduleConfig) return null;
          return (
            <div key={item.i}>
              <ModuleWidget
                instanceId={item.i}
                moduleConfig={moduleConfig}
                isEditMode={isEditMode}
                onRemove={onRemoveModule}
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
};

export default Canvas;
