/**
 * Canvas — the main display area.
 * Uses react-grid-layout ResponsiveGridLayout for drag-and-drop module placement
 * with breakpoint support (lg/md/sm).
 */

import React, { useCallback } from 'react';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ModuleWidget from '../ModuleWidget/ModuleWidget';
import styles from './Canvas.module.css';
import type { LayoutProfile, GridItem } from '../../types';

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768 };
const COLS = { lg: 24, md: 16, sm: 8 };

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

  // Use the same layout for all breakpoints; react-grid-layout reflows items automatically.
  const layouts: Layouts = { lg: layout, md: layout, sm: layout };

  const handleLayoutChange = useCallback(
    (currentLayout: Layout[]) => {
      const grid: GridItem[] = currentLayout.map((l) => ({
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
      <ResponsiveGridLayout
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
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
      </ResponsiveGridLayout>
    </div>
  );
};

export default Canvas;
