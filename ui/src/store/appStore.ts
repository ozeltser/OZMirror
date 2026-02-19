/**
 * Zustand store for global UI state.
 * Server state (layout, modules, settings) lives in React Query / API calls.
 */

import { create } from 'zustand';
import type { LayoutData, GlobalSettings, RegisteredModule } from '../types';

interface AppState {
  // Edit mode
  isEditMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (enabled: boolean) => void;

  // Layout
  layout: LayoutData | null;
  setLayout: (layout: LayoutData) => void;

  // Registered modules
  modules: RegisteredModule[];
  setModules: (modules: RegisteredModule[]) => void;

  // Settings
  settings: GlobalSettings | null;
  setSettings: (settings: GlobalSettings) => void;

  // Module picker panel
  isModulePickerOpen: boolean;
  toggleModulePicker: () => void;

  // Settings panel
  isSettingsPanelOpen: boolean;
  toggleSettingsPanel: () => void;
  closeSettingsPanel: () => void;

  // WebSocket connected
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isEditMode: false,
  toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode })),
  setEditMode: (enabled) => set({ isEditMode: enabled }),

  layout: null,
  setLayout: (layout) => set({ layout }),

  modules: [],
  setModules: (modules) => set({ modules }),

  settings: null,
  setSettings: (settings) => set({ settings }),

  isModulePickerOpen: false,
  toggleModulePicker: () => set((s) => ({ isModulePickerOpen: !s.isModulePickerOpen })),

  isSettingsPanelOpen: false,
  toggleSettingsPanel: () => set((s) => ({ isSettingsPanelOpen: !s.isSettingsPanelOpen })),
  closeSettingsPanel: () => set({ isSettingsPanelOpen: false }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
