/**
 * Express routes for the Sticky Notes module.
 *   GET    /health
 *   GET    /manifest
 *   GET    /notes?instanceId=<id>
 *   POST   /notes  { instanceId, content, color?, fontSize? }
 *   PUT    /notes/:id  { content?, color?, fontSize? }
 *   DELETE /notes/:id
 */

import { Router, Request, Response } from 'express';
import {
  getNotesByInstance,
  createNote,
  updateNote,
  deleteNote,
} from './db';
import { publishNotesUpdate } from './redis-client';
import { MANIFEST } from './manifest';

const router = Router();
const startTime = Date.now();

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateInstanceId(instanceId: unknown): instanceId is string {
  return typeof instanceId === 'string' && INSTANCE_ID_PATTERN.test(instanceId);
}

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0',
  });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(MANIFEST);
});

// GET /notes?instanceId=<id>  — list all notes for an instance
router.get('/notes', (req: Request, res: Response) => {
  const instanceId = req.query.instanceId;
  if (!validateInstanceId(instanceId)) {
    return res.status(400).json({ error: 'Missing or invalid instanceId' });
  }
  const notes = getNotesByInstance(instanceId);
  res.json({ notes });
});

// POST /notes  — create a new note
router.post('/notes', async (req: Request, res: Response) => {
  const { instanceId, content, color, fontSize } = req.body ?? {};

  if (!validateInstanceId(instanceId)) {
    return res.status(400).json({ error: 'Missing or invalid instanceId' });
  }
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "content" field' });
  }
  if (content.length > 10_000) {
    return res.status(400).json({ error: 'Content exceeds 10,000 character limit' });
  }

  const note = createNote(
    instanceId,
    content,
    typeof color === 'string' ? color : undefined,
    typeof fontSize === 'number' ? fontSize : undefined
  );

  const allNotes = getNotesByInstance(instanceId);
  publishNotesUpdate(instanceId, allNotes).catch(() => {});

  res.status(201).json({ note });
});

// PUT /notes/:id  — update a note
router.put('/notes/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  const { content, color, fontSize } = req.body ?? {};

  if (typeof content === 'string' && content.length > 10_000) {
    return res.status(400).json({ error: 'Content exceeds 10,000 character limit' });
  }

  const updated = updateNote(id, {
    content: typeof content === 'string' ? content : undefined,
    color: typeof color === 'string' ? color : undefined,
    font_size: typeof fontSize === 'number' ? fontSize : undefined,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const allNotes = getNotesByInstance(updated.instance_id);
  publishNotesUpdate(updated.instance_id, allNotes).catch(() => {});

  res.json({ note: updated });
});

// DELETE /notes/:id  — delete a note
router.delete('/notes/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid note id' });
  }

  const deleted = deleteNote(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.json({ success: true });
});

export default router;
