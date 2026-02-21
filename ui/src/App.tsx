/**
 * Root application component.
 * Handles initial data loading, theming, keyboard shortcuts, and layout rendering.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Canvas from './components/Canvas/Canvas';
import EditToolbar from './components/EditToolbar/EditToolbar';
import ModulePicker from './components/ModulePicker/ModulePicker';
import SettingsPanel from './components/SettingsPanel/SettingsPanel';
import { useLayout } from './hooks/useLayout';
import { useConfig } from './hooks/useConfig';
import { useAppStore } from './store/appStore';
import { wsClient } from './core/WebSocketClient';
import { inputHandler } from './core/InputHandler';
import { applyTheme } from './utils/theme';
import type { GridItem } from './types';

const App: React.FC = () => {
  const { layout, isLoading: layoutLoading, persistLayout, switchProfile } = useLayout();
  const { settings } = useConfig();
  const { isEditMode, toggleEditMode, setWsConnected, toggleSettingsPanel } = useAppStore();

  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resize listener
  useEffect(() => {
    const onResize = () => setCanvasWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // WebSocket connection — the Nginx gateway injects the API key server-side,
  // so the browser connects without credentials.
  useEffect(() => {
    wsClient.connect();

    const unsubStatus = wsClient.onStatusChange(setWsConnected);

    return () => {
      unsubStatus();
      wsClient.disconnect();
    };
  }, [setWsConnected]);

  // Keyboard shortcuts
  useEffect(() => {
    inputHandler.init();
    const removeE = inputHandler.register('E', toggleEditMode);
    const removeEsc = inputHandler.register('ESCAPE', () =>
      useAppStore.getState().setEditMode(false)
    );
    const removeF = inputHandler.register('F', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
    const removeCtrlComma = inputHandler.register('Ctrl+,', toggleSettingsPanel);
    const removeCtrlS = inputHandler.register('Ctrl+S', () => {
      const currentLayout = useAppStore.getState().layout;
      if (currentLayout) persistLayout(currentLayout);
    });
    return () => {
      removeE();
      removeEsc();
      removeF();
      removeCtrlComma();
      removeCtrlS();
      inputHandler.destroy();
    };
  }, [toggleEditMode, toggleSettingsPanel, persistLayout]);

  // Apply theme from settings
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
  }, [settings]);

  // Debounced layout persistence on drag/resize
  const handleLayoutChange = useCallback(
    (grid: GridItem[]) => {
      if (!layout) return;
      const activeProfile = layout.activeProfile;
      const updatedLayout = {
        ...layout,
        layouts: {
          ...layout.layouts,
          [activeProfile]: {
            ...layout.layouts[activeProfile],
            grid,
          },
        },
      };
      // Debounce saves to avoid hammering the API during drag
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        persistLayout(updatedLayout);
      }, 800);
    },
    [layout, persistLayout]
  );

  const handleRemoveModule = useCallback(
    (instanceId: string) => {
      if (!layout) return;
      const activeProfile = layout.activeProfile;
      const current = layout.layouts[activeProfile];
      const updatedLayout = {
        ...layout,
        layouts: {
          ...layout.layouts,
          [activeProfile]: {
            grid: current.grid.filter((g) => g.i !== instanceId),
            moduleConfigs: Object.fromEntries(
              Object.entries(current.moduleConfigs).filter(([k]) => k !== instanceId)
            ),
          },
        },
      };
      persistLayout(updatedLayout);
    },
    [layout, persistLayout]
  );

  if (layoutLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--color-text-secondary, #9e9e9e)',
          background: 'var(--color-bg, #0d0d0d)',
        }}
      >
        Loading OzMirror…
      </div>
    );
  }

  if (!layout) {
    return (
      <div style={{ padding: 24, color: '#ef5350' }}>
        Failed to load layout. Check Config Service.
      </div>
    );
  }

  const activeProfile = layout.layouts[layout.activeProfile];
  if (!activeProfile) {
    // Fallback to "default" if possible; otherwise show error with Settings accessible
    const fallback = layout.layouts['default'];
    if (fallback && layout.activeProfile !== 'default') {
      switchProfile('default');
    }
    return (
      <>
        <div style={{ padding: 24, color: '#ef5350' }}>
          Active profile "{layout.activeProfile}" not found.
          {fallback ? ' Reverting to default profile…' : ' Open Settings (Ctrl+,) to select a profile.'}
        </div>
        <SettingsPanel />
      </>
    );
  }

  return (
    <>
      <Canvas
        profile={activeProfile}
        isEditMode={isEditMode}
        onLayoutChange={handleLayoutChange}
        onRemoveModule={handleRemoveModule}
        width={canvasWidth}
      />
      <EditToolbar />
      <ModulePicker />
      <SettingsPanel />
      {!isEditMode && (
        <button
          onClick={toggleEditMode}
          title="Toggle edit mode (E)"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: 'rgba(26,26,26,0.85)',
            border: '1px solid var(--color-border, #2a2a2a)',
            borderRadius: '50%',
            color: 'var(--color-text, #e0e0e0)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            height: 44,
            width: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          ✏️
        </button>
      )}
    </>
  );
};

export default App;
