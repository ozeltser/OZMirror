import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModuleWidget from '../../components/ModuleWidget/ModuleWidget';

// Lazy widgets and modal are mocked so we don't need real widget implementations.
vi.mock('../../widgets/ClockWidget', () => ({
  default: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="clock-widget">{instanceId}</div>
  ),
}));

vi.mock('../../components/ModuleSettingsModal/ModuleSettingsModal', () => ({
  default: ({ instanceId, onClose }: { instanceId: string; onClose: () => void }) => (
    <div data-testid="settings-modal" data-instance={instanceId}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const CLOCK_CONFIG = {
  moduleId: 'clock',
  config: { format: 'HH:mm:ss', timezone: 'UTC', showDate: true },
};

describe('ModuleWidget — unknown module', () => {
  it('renders a fallback message for an unregistered moduleId', () => {
    render(
      <ModuleWidget
        instanceId="x_01"
        moduleConfig={{ moduleId: 'nonexistent', config: {} }}
        isEditMode={false}
      />,
    );
    expect(screen.getByText(/Unknown module: nonexistent/)).toBeInTheDocument();
  });
});

describe('ModuleWidget — known module (clock)', () => {
  it('renders the clock widget via lazy loading', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={false} />,
    );
    expect(await screen.findByTestId('clock-widget')).toBeInTheDocument();
  });

  it('passes instanceId to the widget', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={false} />,
    );
    const widget = await screen.findByTestId('clock-widget');
    expect(widget.textContent).toBe('clock_01');
  });
});

describe('ModuleWidget — view mode', () => {
  it('does not render edit controls when isEditMode is false', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={false} />,
    );
    await screen.findByTestId('clock-widget'); // wait for lazy load
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
  });
});

describe('ModuleWidget — edit mode', () => {
  it('shows Settings and Remove buttons in edit mode', async () => {
    render(
      <ModuleWidget
        instanceId="clock_01"
        moduleConfig={CLOCK_CONFIG}
        isEditMode={true}
        onRemove={vi.fn()}
      />,
    );
    await screen.findByTestId('clock-widget');
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
    expect(screen.getByTitle('Remove')).toBeInTheDocument();
  });

  it('shows module label in edit mode', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={true} />,
    );
    await screen.findByTestId('clock-widget');
    expect(screen.getByText('clock')).toBeInTheDocument();
  });

  it('calls onRemove with instanceId when Remove is clicked', async () => {
    const onRemove = vi.fn();
    render(
      <ModuleWidget
        instanceId="clock_01"
        moduleConfig={CLOCK_CONFIG}
        isEditMode={true}
        onRemove={onRemove}
      />,
    );
    await screen.findByTestId('clock-widget');
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalledWith('clock_01');
  });

  it('opens settings modal when Settings button is clicked', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={true} />,
    );
    await screen.findByTestId('clock-widget');
    fireEvent.click(screen.getByTitle('Settings'));
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByTestId('settings-modal').dataset.instance).toBe('clock_01');
  });

  it('closes settings modal when Close is clicked inside it', async () => {
    render(
      <ModuleWidget instanceId="clock_01" moduleConfig={CLOCK_CONFIG} isEditMode={true} />,
    );
    await screen.findByTestId('clock-widget');
    fireEvent.click(screen.getByTitle('Settings'));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });
});
