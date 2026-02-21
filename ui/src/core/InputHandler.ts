/**
 * Global keyboard shortcut handler.
 * Normalizes keyboard events into app actions.
 */

type KeyHandler = () => void;

const handlers: Map<string, KeyHandler> = new Map();

function getKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CTRL');
  if (e.shiftKey) parts.push('SHIFT');
  parts.push(e.key.toUpperCase());
  return parts.join('+');
}

function onKeydown(e: KeyboardEvent): void {
  // Don't intercept when user is typing in an input/textarea
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  const key = getKey(e);
  const handler = handlers.get(key);
  if (handler) {
    e.preventDefault();
    handler();
  }
}

export const inputHandler = {
  register(key: string, handler: KeyHandler): () => void {
    handlers.set(key.toUpperCase(), handler);
    return () => handlers.delete(key.toUpperCase());
  },

  init(): void {
    document.addEventListener('keydown', onKeydown);
  },

  destroy(): void {
    document.removeEventListener('keydown', onKeydown);
    handlers.clear();
  },
};
