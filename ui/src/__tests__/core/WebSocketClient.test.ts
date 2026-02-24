/**
 * Tests for WebSocketClient.
 * socket.io-client is mocked so no real network connections are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── socket.io-client mock ────────────────────────────────────────────────────

// Shared state that the mock socket and tests can both access.
const socketEventHandlers: Record<string, (...args: unknown[]) => void> = {};

const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketEventHandlers[event] = handler;
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
  id: 'mock-socket-id',
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { io } from 'socket.io-client';

// Import AFTER mocking — each test file gets a fresh module graph in Vitest.
import { wsClient } from '../../core/WebSocketClient';

// ── Helpers ──────────────────────────────────────────────────────────────────

function simulateConnect() {
  socketEventHandlers['connect']?.();
}

function simulateDisconnect() {
  socketEventHandlers['disconnect']?.();
}

function simulateMessage(channel: string, payload: unknown) {
  socketEventHandlers['message']?.({ channel, payload });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WebSocketClient — connect', () => {
  afterEach(() => {
    wsClient.reset();
    vi.clearAllMocks();
    // Clear handlers map so tests don't bleed.
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  it('creates socket via io() on first connect()', () => {
    wsClient.connect();
    expect(io).toHaveBeenCalledOnce();
  });

  it('does not create a second socket on repeated connect()', () => {
    wsClient.connect();
    wsClient.connect();
    expect(io).toHaveBeenCalledOnce();
  });

  it('registers connect, disconnect, message, and connect_error listeners', () => {
    wsClient.connect();
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });
});

describe('WebSocketClient — connection status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  afterEach(() => {
    wsClient.reset();
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  it('isConnected() is false before connect()', () => {
    expect(wsClient.isConnected()).toBe(false);
  });

  it('onStatusChange calls handler immediately with current state (false)', () => {
    const handler = vi.fn();
    const unsub = wsClient.onStatusChange(handler);
    expect(handler).toHaveBeenCalledWith(false);
    unsub();
  });

  it('onStatusChange notifies handler when connected event fires', () => {
    const handler = vi.fn();
    const unsub = wsClient.onStatusChange(handler);
    wsClient.connect();
    simulateConnect();
    expect(handler).toHaveBeenCalledWith(true);
    unsub();
  });

  it('onStatusChange notifies handler when disconnect event fires', () => {
    const handler = vi.fn();
    wsClient.connect();
    simulateConnect();
    const unsub = wsClient.onStatusChange(handler);
    simulateDisconnect();
    expect(handler).toHaveBeenCalledWith(false);
    unsub();
  });

  it('unsubscribing from onStatusChange stops further notifications', () => {
    const handler = vi.fn();
    const unsub = wsClient.onStatusChange(handler);
    handler.mockClear();
    unsub();
    wsClient.connect();
    simulateConnect();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('WebSocketClient — subscribe / unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
    wsClient.connect();
    simulateConnect();
  });

  afterEach(() => {
    wsClient.reset();
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  it('subscribe emits subscribe event to socket', () => {
    const unsub = wsClient.subscribe('module:clock:time', vi.fn());
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', ['module:clock:time']);
    unsub();
  });

  it('message handler invokes subscriber callback with payload', () => {
    const handler = vi.fn();
    const unsub = wsClient.subscribe('module:clock:time', handler);
    simulateMessage('module:clock:time', { time: '12:00:00' });
    expect(handler).toHaveBeenCalledWith({ time: '12:00:00' });
    unsub();
  });

  it('message on a different channel does not invoke subscriber', () => {
    const handler = vi.fn();
    const unsub = wsClient.subscribe('module:clock:time', handler);
    simulateMessage('module:weather:update', { temp: 20 });
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it('unsubscribe prevents handler from being called', () => {
    const handler = vi.fn();
    const unsub = wsClient.subscribe('module:clock:time', handler);
    unsub();
    simulateMessage('module:clock:time', { time: '12:00:00' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe emits unsubscribe when last subscriber on channel leaves', () => {
    const handler = vi.fn();
    const unsub = wsClient.subscribe('module:clock:time', handler);
    mockSocket.emit.mockClear();
    unsub();
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', ['module:clock:time']);
  });

  it('multiple subscribers on same channel all receive messages', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = wsClient.subscribe('module:clock:time', h1);
    const u2 = wsClient.subscribe('module:clock:time', h2);
    simulateMessage('module:clock:time', { t: 1 });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    u1();
    u2();
  });
});

describe('WebSocketClient — disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  afterEach(() => {
    wsClient.reset();
    vi.clearAllMocks();
    Object.keys(socketEventHandlers).forEach((k) => delete socketEventHandlers[k]);
  });

  it('disconnect calls socket.disconnect()', () => {
    wsClient.connect();
    wsClient.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('isConnected() returns false after disconnect()', () => {
    wsClient.connect();
    simulateConnect();
    wsClient.disconnect();
    expect(wsClient.isConnected()).toBe(false);
  });
});
