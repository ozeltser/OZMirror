import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ModulePicker from '../../components/ModulePicker/ModulePicker';
import { useAppStore } from '../../store/appStore';
import type { RegisteredModule, LayoutData } from '../../types';

// ── API mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../api/config', () => ({
  fetchModules: vi.fn(),
  saveLayout: vi.fn().mockResolvedValue(undefined),
}));

import { fetchModules, saveLayout } from '../../api/config';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_MODULES: RegisteredModule[] = [
  {
    id: 'clock',
    name: 'Clock',
    status: 'online',
    serviceUrl: 'http://clock:3001',
    manifest: {
      id: 'clock',
      name: 'Clock',
      description: 'A clock',
      version: '1.0.0',
      author: 'OzMirror',
      defaultConfig: { format: 'HH:mm:ss' },
      gridConstraints: { defaultW: 4, defaultH: 3 },
    },
  },
  {
    id: 'weather',
    name: 'Weather',
    status: 'offline',
    serviceUrl: 'http://weather:3002',
    manifest: {
      id: 'weather',
      name: 'Weather',
      description: 'Weather widget',
      version: '1.0.0',
      author: 'OzMirror',
      defaultConfig: {},
    },
  },
];

const MOCK_LAYOUT: LayoutData = {
  activeProfile: 'default',
  layouts: {
    default: { grid: [], moduleConfigs: {} },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore(open = false) {
  useAppStore.setState({
    isModulePickerOpen: open,
    layout: MOCK_LAYOUT,
    isEditMode: false,
    modules: [],
    settings: null,
    isSettingsPanelOpen: false,
    wsConnected: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('ModulePicker — closed state', () => {
  beforeEach(() => {
    resetStore(false);
    vi.clearAllMocks();
  });

  it('renders nothing when isModulePickerOpen is false', () => {
    const { container } = render(<ModulePicker />);
    expect(container.firstChild).toBeNull();
  });

  it('does not call fetchModules when closed', () => {
    render(<ModulePicker />);
    expect(fetchModules).not.toHaveBeenCalled();
  });
});

describe('ModulePicker — open state', () => {
  beforeEach(() => {
    resetStore(true);
    vi.clearAllMocks();
  });

  it('shows loading indicator while fetching', () => {
    vi.mocked(fetchModules).mockReturnValue(new Promise(() => {})); // never resolves
    render(<ModulePicker />);
    expect(screen.getByText('Loading modules…')).toBeInTheDocument();
  });

  it('renders a list of modules after loading', async () => {
    vi.mocked(fetchModules).mockResolvedValue(MOCK_MODULES);
    render(<ModulePicker />);
    await waitFor(() => expect(screen.getByText('Clock')).toBeInTheDocument());
    expect(screen.getByText('Weather')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    vi.mocked(fetchModules).mockRejectedValue(new Error('network'));
    render(<ModulePicker />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load modules/)).toBeInTheDocument(),
    );
  });

  it('shows empty state when no modules are registered', async () => {
    vi.mocked(fetchModules).mockResolvedValue([]);
    render(<ModulePicker />);
    await waitFor(() =>
      expect(screen.getByText('No modules registered.')).toBeInTheDocument(),
    );
  });

  it('disables buttons for offline modules', async () => {
    vi.mocked(fetchModules).mockResolvedValue(MOCK_MODULES);
    render(<ModulePicker />);
    await waitFor(() => screen.getByText('Weather'));
    const weatherBtn = screen.getByText('Weather').closest('button')!;
    expect(weatherBtn).toBeDisabled();
  });

  it('enables buttons for online modules', async () => {
    vi.mocked(fetchModules).mockResolvedValue(MOCK_MODULES);
    render(<ModulePicker />);
    await waitFor(() => screen.getByText('Clock'));
    const clockBtn = screen.getByText('Clock').closest('button')!;
    expect(clockBtn).not.toBeDisabled();
  });
});

describe('ModulePicker — interactions', () => {
  beforeEach(() => {
    resetStore(true);
    vi.clearAllMocks();
  });

  it('clicking Close button closes the picker', async () => {
    vi.mocked(fetchModules).mockResolvedValue([]);
    render(<ModulePicker />);
    await waitFor(() => screen.getByText('No modules registered.'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(useAppStore.getState().isModulePickerOpen).toBe(false);
  });

  it('adding a module calls saveLayout and closes the picker', async () => {
    vi.mocked(fetchModules).mockResolvedValue(MOCK_MODULES);
    render(<ModulePicker />);
    await waitFor(() => screen.getByText('Clock'));
    fireEvent.click(screen.getByText('Clock').closest('button')!);

    await waitFor(() => expect(saveLayout).toHaveBeenCalledOnce());
    expect(useAppStore.getState().isModulePickerOpen).toBe(false);
  });

  it('adding a module appends an entry to the active profile grid', async () => {
    vi.mocked(fetchModules).mockResolvedValue(MOCK_MODULES);
    render(<ModulePicker />);
    await waitFor(() => screen.getByText('Clock'));
    fireEvent.click(screen.getByText('Clock').closest('button')!);

    await waitFor(() => expect(saveLayout).toHaveBeenCalledOnce());
    const updatedLayout = useAppStore.getState().layout!;
    const grid = updatedLayout.layouts['default'].grid;
    expect(grid.length).toBe(1);
    expect(grid[0].i).toMatch(/^clock_/);
  });
});
