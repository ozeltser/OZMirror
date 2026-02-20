/**
 * StickyNotesWidget — editable sticky notes backed by SQLite.
 * Notes are created/updated/deleted via REST; real-time sync via WebSocket.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useModuleEvents } from '../hooks/useModuleEvents';
import styles from './StickyNotesWidget.module.css';

interface Note {
  id: number;
  instance_id: string;
  content: string;
  color: string;
  font_size: number;
  created_at: string;
  updated_at: string;
}

interface StickyNotesWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    defaultColor?: string;
    defaultFontSize?: number;
  };
}

const NOTE_COLORS = ['#ffeb3b', '#a5d6a7', '#90caf9', '#f48fb1', '#ce93d8', '#ffcc80'];

function noteClient() {
  return axios.create({ baseURL: '/api/modules/sticky_notes' });
}

const StickyNotesWidget: React.FC<StickyNotesWidgetProps> = ({ instanceId, config }) => {
  const defaultColor = config.defaultColor ?? '#ffeb3b';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await noteClient().get<{ notes: Note[] }>('/notes', {
        params: { instanceId },
      });
      setNotes(data.notes);
      setError(null);
    } catch {
      setError('Could not load notes');
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Real-time updates pushed from the backend via WebSocket
  const handleEvent = useCallback((data: { notes: Note[] }) => {
    setNotes(data.notes);
  }, []);
  // Subscribe to the instance-specific channel: module:sticky_notes:data:<instanceId>
  useModuleEvents<{ notes: Note[] }>('sticky_notes', instanceId, handleEvent, `data:${instanceId}`);

  const handleAddNote = async () => {
    try {
      await noteClient().post('/notes', {
        instanceId,
        content: '',
        color: defaultColor,
      });
      // No need to reload — the backend publishes a WS update that sets state via handleEvent
    } catch {
      setError('Failed to create note');
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSaveEdit = async (note: Note) => {
    if (editingId !== note.id) return;
    try {
      await noteClient().put(`/notes/${note.id}`, { instanceId, content: editContent });
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, content: editContent } : n))
      );
    } catch {
      setError('Failed to save note');
    } finally {
      setEditingId(null);
    }
  };

  const handleColorChange = async (note: Note, color: string) => {
    try {
      await noteClient().put(`/notes/${note.id}`, { instanceId, color });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, color } : n)));
    } catch {
      setError('Failed to update note color');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await noteClient().delete(`/notes/${id}`, { params: { instanceId } });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError('Failed to delete note');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <span className={styles.status}>Loading…</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Notes</span>
        <button className={styles.addBtn} onClick={handleAddNote} title="Add note">
          +
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.noteList}>
        {notes.length === 0 && (
          <div className={styles.status}>No notes yet. Click + to add one.</div>
        )}

        {notes.map((note) => (
          <div
            key={note.id}
            className={styles.noteCard}
            style={{ backgroundColor: note.color }}
          >
            {editingId === note.id ? (
              <textarea
                ref={textareaRef}
                className={styles.noteTextarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={() => handleSaveEdit(note)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingId(null);
                  if (e.key === 'Enter' && e.ctrlKey) handleSaveEdit(note);
                }}
                style={{ fontSize: note.font_size }}
              />
            ) : (
              <div
                className={styles.noteContent}
                style={{ fontSize: note.font_size }}
                onClick={() => handleStartEdit(note)}
                title="Click to edit"
              >
                {note.content || <span className={styles.placeholder}>Click to write…</span>}
              </div>
            )}

            <div className={styles.noteFooter}>
              <div className={styles.colorPicker}>
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={styles.colorDot}
                    style={{ backgroundColor: c, outline: c === note.color ? '2px solid #333' : 'none' }}
                    onClick={() => handleColorChange(note, c)}
                    title="Change color"
                  />
                ))}
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(note.id)}
                title="Delete note"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickyNotesWidget;
