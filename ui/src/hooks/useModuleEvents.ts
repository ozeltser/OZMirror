/**
 * Hook for subscribing to real-time module events via the WebSocket client.
 */

import { useEffect } from 'react';
import { wsClient } from '../core/WebSocketClient';

export function useModuleEvents<T = unknown>(
  moduleId: string,
  instanceId: string,
  onEvent: (payload: T) => void,
  event = 'time'
): void {
  useEffect(() => {
    // Channel follows the OzMirror convention (docs/REDIS_CHANNELS.md):
    // module:<moduleId>:<event>  — whitelisted in the WebSocket Bridge
    const channel = `module:${moduleId}:${event}`;

    const unsubscribe = wsClient.subscribe(channel, (raw) => {
      if (
        raw !== null &&
        typeof raw === 'object' &&
        'instanceId' in raw &&
        'data' in raw &&
        (raw as { instanceId: unknown }).instanceId === instanceId
      ) {
        onEvent((raw as { instanceId: string; data: T }).data);
      }
    });

    return unsubscribe;
  }, [moduleId, instanceId, onEvent, event]);
}
