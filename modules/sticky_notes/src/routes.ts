import { Router, Request, Response } from 'express';
import {
  getNotesByInstance,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} from './database';
import { publishNoteEvent } from './redis-client';
import { requireApiKey } from './auth';

const router = Router();

const manifest = {
  id: 'sticky_notes',
  name: 'Sticky Notes',
  description: 'Editable sticky notes with color and font customization',
  version: '1.0.0',
  author: 'OzMirror',
  icon: 'sticky-note',
  defaultConfig: {
    defaultColor: '#ffeb3b',
    defaultFontSize: 16,
  },
  gridConstraints: {
    minW: 2,
    minH: 2,
    maxW: 8,
    maxH: 8,
  },
};

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', module: 'sticky_notes' });
});

router.get('/manifest', (_req: Request, res: Response) => {
  res.json(manifest);
});

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// GET /notes?instanceId=sticky_01
router.get('/notes', requireApiKey, (req: Request, res: Response) => {
  const instanceId = asString(req.query.instanceId);
  if (!instanceId) {
    res.status(400).json({ error: 'instanceId query parameter required' });
    return;
  }
  const notes = getNotesByInstance(instanceId);
  res.json(notes);
});

// GET /notes/:id
router.get('/notes/:id', requireApiKey, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid note ID' });
    return;
  }
  const note = getNoteById(id);
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note);
});

// POST /notes
router.post('/notes', requireApiKey, async (req: Request, res: Response) => {
  const { instance_id, content, color, font_size } = req.body as {
    instance_id?: string;
    content?: string;
    color?: string;
    font_size?: number;
  };

  if (!instance_id) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }

  const note = createNote({ instance_id, content, color, font_size });
  await publishNoteEvent('created', instance_id, note);
  res.status(201).json(note);
});

// PUT /notes/:id
// Requires instance_id in body to verify ownership (prevents IDOR).
router.put('/notes/:id', requireApiKey, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid note ID' });
    return;
  }

  const { instance_id, content, color, font_size } = req.body as {
    instance_id?: string;
    content?: string;
    color?: string;
    font_size?: number;
  };

  if (!instance_id) {
    res.status(400).json({ error: 'instance_id is required for ownership verification' });
    return;
  }

  const updated = updateNote(id, instance_id, { content, color, font_size });
  if (!updated) {
    res.status(404).json({ error: 'Note not found or not owned by this instance' });
    return;
  }
  await publishNoteEvent('updated', instance_id, updated);
  res.json(updated);
});

// DELETE /notes/:id
// Requires instance_id in body to verify ownership (prevents IDOR).
router.delete('/notes/:id', requireApiKey, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid note ID' });
    return;
  }

  const { instance_id } = req.body as { instance_id?: string };
  if (!instance_id) {
    res.status(400).json({ error: 'instance_id is required for ownership verification' });
    return;
  }

  const deleted = deleteNote(id, instance_id);
  if (!deleted) {
    res.status(404).json({ error: 'Note not found or not owned by this instance' });
    return;
  }
  await publishNoteEvent('deleted', instance_id, { id });
  res.json({ success: true, id });
});

export default router;
