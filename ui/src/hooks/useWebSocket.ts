import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';
const API_KEY = import.meta.env.VITE_API_KEY || '';

let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(WS_URL, {
      auth: { apiKey: API_KEY },
      transports: ['websocket', 'polling'],
    });
  }
  return sharedSocket;
}

export function useWebSocketChannel(
  channel: string,
  onMessage: (payload: unknown) => void
): void {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const socket = getSocket();
    socketRefCount++;

    const messageHandler = (msg: { channel: string; payload: unknown }) => {
      if (msg.channel === channel) {
        handlerRef.current(msg.payload);
      }
    };

    socket.on('message', messageHandler);
    socket.emit('subscribe', [channel]);

    return () => {
      socket.off('message', messageHandler);
      socket.emit('unsubscribe', [channel]);
      socketRefCount--;
      if (socketRefCount === 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, [channel]);
}
