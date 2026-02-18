/**
 * Hook for subscribing to real-time module events via the WebSocket client.
 */

import { useEffect } from 'react';
import { wsClient } from '../core/WebSocketClient';

export function useModuleEvents<T = unknown>(
  moduleId: string,
  instanceId: string,
  onEvent: (payload: T) => void
): void {
  useEffect(() => {
    // Channel follows the OzMirror convention (docs/REDIS_CHANNELS.md):
    // module:<moduleId>:time  — whitelisted in the WebSocket Bridge
    const channel = `module:${moduleId}:time`;

    const unsubscribe = wsClient.subscribe(channel, (raw) => {
      const payload = raw as { instanceId: string; data: T };
      if (payload.instanceId === instanceId) {
        onEvent(payload.data);
      }
    });

    return unsubscribe;
  }, [moduleId, instanceId, onEvent]);
}
