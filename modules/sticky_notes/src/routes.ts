/**
 * Express routes for the Sticky Notes module.
 * Standard OzMirror endpoints plus note CRUD.
 *
 *   GET    /health
 *   GET    /manifest
 *   GET    /data?instanceId=<id>          — returns notes for this instance
 *   POST   /action                        — standard module action dispatch
 *   GET    /notes?instanceId=<id>         — list notes
 *   POST   /notes                         — create note
 *   PUT    /notes/:id                     — update note (requires instance_id for IDOR protection)
 *   DELETE /notes/:id                     — delete note (requires instance_id for IDOR protection)
 */

import { Router, Request, Response } from 'express';
import { getNotesByInstance, createNote, updateNote, deleteNote } from './database';
import { publishNoteEvent } from './redis-client';
import { MANIFEST } from './manifest';

const router = Router();

const startTime = Date.now();

// ---------------------------------------------------------------------------
// Standard module endpoints
// ---------------------------------------------------------------------------

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

router.get('/data', (req: Request, res: Response) => {
  const instanceId = typeof req.query.instanceId === 'string'
    ? req.query.instanceId
    : 'sticky_notes_01';
  const notes = getNotesByInstance(instanceId);
  res.json({ notes });
});

router.post('/action', (req: Request, res: Response) => {
  const { instanceId, action, payload } = req.body ?? {};

  if (typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "action" field' });
  }

  const id = typeof instanceId === 'string' ? instanceId : 'sticky_notes_01';

  if (action === 'getNotes') {
    const notes = getNotesByInstance(id);
    return res.json({ success: true, data: { notes } });
  }

  if (action === 'createNote') {
    const { content, color, font_size } = (payload ?? {}) as Record<string, unknown>;
    const note = createNote(
      id,
      typeof content === 'string' ? content : '',
      typeof color === 'string' ? color : '#ffeb3b',
      typeof font_size === 'number' ? font_size : 16
    );
    publishNoteEvent('created', id, note);
    return res.json({ success: true, data: note });
  }

  return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
});

// ---------------------------------------------------------------------------
// Note CRUD endpoints
// ---------------------------------------------------------------------------

router.get('/notes', (req: Request, res: Response) => {
  const instanceId = typeof req.query.instanceId === 'string'
    ? req.query.instanceId
    : undefined;
  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId query parameter required' });
  }
  res.json(getNotesByInstance(instanceId));
});

router.post('/notes', async (req: Request, res: Response) => {
  const { instance_id, content, color, font_size } = req.body ?? {};

  if (typeof instance_id !== 'string' || !instance_id) {
    return res.status(400).json({ error: 'instance_id is required' });
  }

  const note = createNote(
    instance_id,
    typeof content === 'string' ? content : '',
    typeof color === 'string' ? color : '#ffeb3b',
    typeof font_size === 'number' ? font_size : 16
  );
  await publishNoteEvent('created', instance_id, note);
  res.status(201).json(note);
});

router.put('/notes/:id', async (req: Request, res: Response) => {
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  const { instance_id, content, color, font_size } = req.body ?? {};

  if (typeof instance_id !== 'string' || !instance_id) {
    return res.status(400).json({ error: 'instance_id is required for ownership verification' });
  }

  const updated = updateNote(noteId, instance_id, { content, color, font_size });
  if (!updated) {
    return res.status(404).json({ error: 'Note not found or not owned by this instance' });
  }
  await publishNoteEvent('updated', instance_id, updated);
  res.json(updated);
});

router.delete('/notes/:id', async (req: Request, res: Response) => {
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }

  const { instance_id } = req.body ?? {};

  if (typeof instance_id !== 'string' || !instance_id) {
    return res.status(400).json({ error: 'instance_id is required for ownership verification' });
  }

  const deleted = deleteNote(noteId, instance_id);
  if (!deleted) {
    return res.status(404).json({ error: 'Note not found or not owned by this instance' });
  }
  await publishNoteEvent('deleted', instance_id, { id: noteId });
  res.json({ success: true, id: noteId });
});

export default router;
