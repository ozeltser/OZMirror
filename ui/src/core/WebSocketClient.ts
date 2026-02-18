/**
 * WebSocket client — bridges Socket.IO to the Redis pub/sub bridge service.
 * Supports multiple channel subscriptions with per-channel callbacks.
 */

import { io, Socket } from 'socket.io-client';
import type { WsMessage } from '../types';

type MessageHandler = (payload: unknown) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private connected = false;

  connect(apiKey: string): void {
    if (this.socket) return;

    this.socket = io('/ws', {
      transports: ['websocket', 'polling'],
      auth: { apiKey },
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[ws] Connected:', this.socket!.id);

      // Re-subscribe to all channels after reconnect
      const channels = Array.from(this.handlers.keys());
      if (channels.length > 0) {
        this.socket!.emit('subscribe', channels);
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[ws] Disconnected');
    });

    this.socket.on('message', (msg: WsMessage) => {
      const { channel, payload } = msg;
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        channelHandlers.forEach((h) => h(payload));
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[ws] Connection error:', err.message);
    });
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Tell server to subscribe if connected
    if (this.connected && this.socket) {
      this.socket.emit('subscribe', [channel]);
    }

    // Return unsubscribe function
    return () => {
      const set = this.handlers.get(channel);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.handlers.delete(channel);
          if (this.connected && this.socket) {
            this.socket.emit('unsubscribe', [channel]);
          }
        }
      }
    };
  }

  publish(channel: string, payload: unknown): void {
    if (this.connected && this.socket) {
      this.socket.emit('publish', { channel, payload });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
