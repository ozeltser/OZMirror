import { describe, it, expect, vi, afterEach } from 'vitest';
import { inputHandler } from '../../core/InputHandler';

afterEach(() => {
  inputHandler.destroy();
});

describe('InputHandler — registration', () => {
  it('registers and calls handler on matching keydown', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('E', handler);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('is case-insensitive (upper E key string maps to lower e key event)', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('e', handler);  // lowercase registration

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returned unsubscribe function prevents further invocations', () => {
    inputHandler.init();
    const handler = vi.fn();
    const remove = inputHandler.register('E', handler);
    remove();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('second registration for same key overwrites first', () => {
    inputHandler.init();
    const first = vi.fn();
    const second = vi.fn();
    inputHandler.register('E', first);
    inputHandler.register('E', second);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});

describe('InputHandler — modifier keys', () => {
  it('Ctrl+S fires handler when ctrlKey is true', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('Ctrl+S', handler);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it('plain S does not trigger Ctrl+S handler', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('Ctrl+S', handler);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('Escape key fires ESC handler', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('ESCAPE', handler);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('InputHandler — input element guard', () => {
  it('ignores keydown events originating from an <input>', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('E', handler);

    const input = document.createElement('input');
    document.body.appendChild(input);
    // Event dispatched on the input element bubbles to document, but
    // e.target will be the input so the guard should suppress it.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    document.body.removeChild(input);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores keydown events from a <textarea>', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('E', handler);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    document.body.removeChild(textarea);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('InputHandler — lifecycle', () => {
  it('destroy clears all registered handlers', () => {
    inputHandler.init();
    const handler = vi.fn();
    inputHandler.register('E', handler);
    inputHandler.destroy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('can be re-initialised after destroy', () => {
    inputHandler.init();
    inputHandler.destroy();
    inputHandler.init();

    const handler = vi.fn();
    inputHandler.register('F', handler);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
