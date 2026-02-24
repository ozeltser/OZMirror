/**
 * Tests for the Sticky Notes module Express routes.
 * Mocks db, redis-client, manifest, and utils to isolate route logic.
 * This module uses API key authentication on /notes endpoints.
 *
 * Note: vi.mock factories are hoisted by Vitest — no top-level variables inside them.
 * API_KEY is pre-set via vitest.config.ts so the module-level const captures it at load time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// API_KEY is set to 'test-api-key-sticky-notes' via vitest.config.ts
const TEST_API_KEY = 'test-api-key-sticky-notes';

// ── Mocks (declared BEFORE importing the module under test) ─────────────────

vi.mock('../db', () => ({
  getNotesByInstance: vi.fn().mockReturnValue([
    {
      id: 1,
      instance_id: 'sticky_01',
      content: 'Buy milk',
      color: '#ffeb3b',
      font_size: 16,
      created_at: '2026-02-24T10:00:00',
      updated_at: '2026-02-24T10:00:00',
    },
    {
      id: 2,
      instance_id: 'sticky_01',
      content: 'Call dentist',
      color: '#ff8a65',
      font_size: 14,
      created_at: '2026-02-24T11:00:00',
      updated_at: '2026-02-24T11:00:00',
    },
  ]),
  getNoteById: vi.fn((id: number) =>
    id === 1
      ? { id: 1, instance_id: 'sticky_01', content: 'Buy milk', color: '#ffeb3b', font_size: 16, created_at: '2026-02-24T10:00:00', updated_at: '2026-02-24T10:00:00' }
      : id === 2
        ? { id: 2, instance_id: 'sticky_01', content: 'Call dentist', color: '#ff8a65', font_size: 14, created_at: '2026-02-24T11:00:00', updated_at: '2026-02-24T11:00:00' }
        : undefined
  ),
  createNote: vi.fn().mockReturnValue({
    id: 1,
    instance_id: 'sticky_01',
    content: 'Buy milk',
    color: '#ffeb3b',
    font_size: 16,
    created_at: '2026-02-24T10:00:00',
    updated_at: '2026-02-24T10:00:00',
  }),
  updateNote: vi.fn().mockReturnValue({
    id: 1,
    instance_id: 'sticky_01',
    content: 'Updated content',
    color: '#ffeb3b',
    font_size: 16,
    created_at: '2026-02-24T10:00:00',
    updated_at: '2026-02-24T12:00:00',
  }),
  deleteNote: vi.fn().mockReturnValue(true),
}));

vi.mock('../redis-client', () => ({
  publishNotesUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../manifest', () => ({
  MANIFEST: {
    id: 'sticky_notes',
    name: 'Sticky Notes',
    description: 'Editable sticky notes with persistent SQLite storage',
    version: '1.0.0',
    author: 'OzMirror',
    icon: 'sticky_notes',
    defaultConfig: { defaultColor: '#ffeb3b', defaultFontSize: 16 },
    configSchema: { type: 'object', properties: { defaultColor: { type: 'string' } } },
    gridConstraints: { minW: 2, minH: 2, maxW: 8, maxH: 8, defaultW: 3, defaultH: 4 },
  },
}));

vi.mock('../utils', () => ({
  validateInstanceId: vi.fn((id: unknown): id is string =>
    typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)
  ),
}));

// ── Module under test ────────────────────────────────────────────────────────

import { getNotesByInstance, getNoteById, createNote, updateNote, deleteNote } from '../db';
import { publishNotesUpdate } from '../redis-client';
import routes from '../routes';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', routes);

const NOTE_1 = {
  id: 1,
  instance_id: 'sticky_01',
  content: 'Buy milk',
  color: '#ffeb3b',
  font_size: 16,
  created_at: '2026-02-24T10:00:00',
  updated_at: '2026-02-24T10:00:00',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with healthy status (no auth required)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('includes uptime as a number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('GET /manifest', () => {
  it('returns 200 with manifest object (no auth required)', async () => {
    const res = await request(app).get('/manifest');
    expect(res.status).toBe(200);
  });

  it('manifest has expected fields', async () => {
    const body = (await request(app).get('/manifest')).body;
    expect(body.id).toBe('sticky_notes');
    expect(body.name).toBe('Sticky Notes');
    expect(body).toHaveProperty('gridConstraints');
    expect(body).toHaveProperty('defaultConfig');
  });
});

describe('GET /notes (requires auth)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without API key', async () => {
    const res = await request(app).get('/notes?instanceId=sticky_01');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong API key', async () => {
    const res = await request(app)
      .get('/notes?instanceId=sticky_01')
      .set('X-API-Key', 'bad-key');
    expect(res.status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await request(app).get('/notes').set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instanceId/);
  });

  it('returns notes for a valid instance', async () => {
    vi.mocked(getNotesByInstance).mockReturnValue([NOTE_1]);
    const res = await request(app)
      .get('/notes?instanceId=sticky_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].content).toBe('Buy milk');
  });
});

describe('POST /notes (requires auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createNote).mockReturnValue(NOTE_1);
    vi.mocked(getNotesByInstance).mockReturnValue([NOTE_1]);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .post('/notes')
      .send({ instanceId: 'sticky_01', content: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await request(app)
      .post('/notes')
      .set('X-API-Key', TEST_API_KEY)
      .send({ content: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instanceId/);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app)
      .post('/notes')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content/);
  });

  it('returns 400 when color is not a valid hex', async () => {
    const res = await request(app)
      .post('/notes')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Hi', color: 'red' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/color/);
  });

  it('returns 400 when fontSize is out of range', async () => {
    const res = await request(app)
      .post('/notes')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Hi', fontSize: 200 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fontSize/);
  });

  it('creates a note and returns 201', async () => {
    const res = await request(app)
      .post('/notes')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Buy milk', color: '#ffeb3b', fontSize: 16 });
    expect(res.status).toBe(201);
    expect(res.body.note).toHaveProperty('id', 1);
    expect(createNote).toHaveBeenCalledWith('sticky_01', 'Buy milk', '#ffeb3b', 16);
    expect(publishNotesUpdate).toHaveBeenCalledWith('sticky_01', [NOTE_1]);
  });
});

describe('PUT /notes/:id (requires auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNoteById).mockImplementation((id) => (id === 1 ? NOTE_1 : undefined));
    vi.mocked(updateNote).mockReturnValue({ ...NOTE_1, content: 'Updated content' });
    vi.mocked(getNotesByInstance).mockReturnValue([NOTE_1]);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .put('/notes/1')
      .send({ instanceId: 'sticky_01', content: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-numeric note id', async () => {
    const res = await request(app)
      .put('/notes/abc')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Updated' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid note id/);
  });

  it('returns 404 when note does not exist', async () => {
    vi.mocked(getNoteById).mockReturnValue(undefined);
    const res = await request(app)
      .put('/notes/999')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when note belongs to a different instance', async () => {
    const res = await request(app)
      .put('/notes/1')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'other_instance', content: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('updates the note and returns the updated note', async () => {
    const res = await request(app)
      .put('/notes/1')
      .set('X-API-Key', TEST_API_KEY)
      .send({ instanceId: 'sticky_01', content: 'Updated content' });
    expect(res.status).toBe(200);
    expect(res.body.note.content).toBe('Updated content');
    expect(updateNote).toHaveBeenCalledWith(1, expect.objectContaining({ content: 'Updated content' }));
    expect(publishNotesUpdate).toHaveBeenCalled();
  });
});

describe('DELETE /notes/:id (requires auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNoteById).mockImplementation((id) => (id === 1 ? NOTE_1 : undefined));
    vi.mocked(deleteNote).mockReturnValue(true);
    vi.mocked(getNotesByInstance).mockReturnValue([]);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app).delete('/notes/1?instanceId=sticky_01');
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-numeric note id', async () => {
    const res = await request(app)
      .delete('/notes/abc?instanceId=sticky_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid note id/);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await request(app).delete('/notes/1').set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/instanceId/);
  });

  it('returns 404 when note does not exist', async () => {
    vi.mocked(getNoteById).mockReturnValue(undefined);
    const res = await request(app)
      .delete('/notes/999?instanceId=sticky_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(404);
  });

  it('returns 403 when note belongs to a different instance', async () => {
    const res = await request(app)
      .delete('/notes/1?instanceId=other_instance')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(403);
  });

  it('deletes the note and returns success', async () => {
    const res = await request(app)
      .delete('/notes/1?instanceId=sticky_01')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(deleteNote).toHaveBeenCalledWith(1);
    expect(publishNotesUpdate).toHaveBeenCalledWith('sticky_01', []);
  });
});
