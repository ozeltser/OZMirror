import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/appStore';
import type { LayoutData, GlobalSettings } from '../../types';

const BLANK_LAYOUT: LayoutData = {
  activeProfile: 'default',
  layouts: { default: { grid: [], moduleConfigs: {} } },
};

const BLANK_SETTINGS: GlobalSettings = {
  theme: 'dark',
  kiosk: false,
  cursorTimeout: 3000,
  fontScale: 1.0,
  autoStart: false,
};

function resetStore() {
  useAppStore.setState({
    isEditMode: false,
    layout: null,
    modules: [],
    settings: null,
    isModulePickerOpen: false,
    isSettingsPanelOpen: false,
    wsConnected: false,
  });
}

describe('appStore — edit mode', () => {
  beforeEach(resetStore);

  it('isEditMode starts false', () => {
    expect(useAppStore.getState().isEditMode).toBe(false);
  });

  it('toggleEditMode flips value', () => {
    useAppStore.getState().toggleEditMode();
    expect(useAppStore.getState().isEditMode).toBe(true);
    useAppStore.getState().toggleEditMode();
    expect(useAppStore.getState().isEditMode).toBe(false);
  });

  it('setEditMode(true) enables edit mode', () => {
    useAppStore.getState().setEditMode(true);
    expect(useAppStore.getState().isEditMode).toBe(true);
  });

  it('setEditMode(false) disables edit mode', () => {
    useAppStore.getState().setEditMode(true);
    useAppStore.getState().setEditMode(false);
    expect(useAppStore.getState().isEditMode).toBe(false);
  });
});

describe('appStore — layout', () => {
  beforeEach(resetStore);

  it('layout starts null', () => {
    expect(useAppStore.getState().layout).toBeNull();
  });

  it('setLayout stores the layout', () => {
    useAppStore.getState().setLayout(BLANK_LAYOUT);
    expect(useAppStore.getState().layout).toEqual(BLANK_LAYOUT);
  });

  it('setLayout replaces an existing layout', () => {
    useAppStore.getState().setLayout(BLANK_LAYOUT);
    const updated: LayoutData = { ...BLANK_LAYOUT, activeProfile: 'night' };
    useAppStore.getState().setLayout(updated);
    expect(useAppStore.getState().layout?.activeProfile).toBe('night');
  });
});

describe('appStore — settings', () => {
  beforeEach(resetStore);

  it('settings starts null', () => {
    expect(useAppStore.getState().settings).toBeNull();
  });

  it('setSettings stores settings', () => {
    useAppStore.getState().setSettings(BLANK_SETTINGS);
    expect(useAppStore.getState().settings?.theme).toBe('dark');
  });
});

describe('appStore — module picker', () => {
  beforeEach(resetStore);

  it('isModulePickerOpen starts false', () => {
    expect(useAppStore.getState().isModulePickerOpen).toBe(false);
  });

  it('toggleModulePicker opens picker', () => {
    useAppStore.getState().toggleModulePicker();
    expect(useAppStore.getState().isModulePickerOpen).toBe(true);
  });

  it('toggleModulePicker closes picker', () => {
    useAppStore.setState({ isModulePickerOpen: true });
    useAppStore.getState().toggleModulePicker();
    expect(useAppStore.getState().isModulePickerOpen).toBe(false);
  });
});

describe('appStore — settings panel', () => {
  beforeEach(resetStore);

  it('isSettingsPanelOpen starts false', () => {
    expect(useAppStore.getState().isSettingsPanelOpen).toBe(false);
  });

  it('toggleSettingsPanel opens panel', () => {
    useAppStore.getState().toggleSettingsPanel();
    expect(useAppStore.getState().isSettingsPanelOpen).toBe(true);
  });

  it('closeSettingsPanel closes panel from open state', () => {
    useAppStore.setState({ isSettingsPanelOpen: true });
    useAppStore.getState().closeSettingsPanel();
    expect(useAppStore.getState().isSettingsPanelOpen).toBe(false);
  });
});

describe('appStore — WebSocket status', () => {
  beforeEach(resetStore);

  it('wsConnected starts false', () => {
    expect(useAppStore.getState().wsConnected).toBe(false);
  });

  it('setWsConnected(true) marks connected', () => {
    useAppStore.getState().setWsConnected(true);
    expect(useAppStore.getState().wsConnected).toBe(true);
  });

  it('setWsConnected(false) marks disconnected', () => {
    useAppStore.getState().setWsConnected(true);
    useAppStore.getState().setWsConnected(false);
    expect(useAppStore.getState().wsConnected).toBe(false);
  });
});
