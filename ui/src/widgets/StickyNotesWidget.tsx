/**
 * StickyNotesWidget — displays and manages sticky notes for a given instance.
 * Real-time updates via WebSocket, REST polling as fallback.
 * CRUD operations use the module's /notes endpoints via Nginx proxy.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useModuleData } from '../hooks/useModuleData';
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

interface NotesData {
  notes: Note[];
}

interface StickyNotesWidgetProps {
  instanceId: string;
  isEditMode: boolean;
  config: {
    defaultColor?: string;
    defaultFontSize?: number;
  };
}

const NOTE_COLORS = ['#ffeb3b', '#ff8a80', '#80d8ff', '#b9f6ca', '#e1bee7', '#ffe0b2'];

const api = axios.create({ baseURL: '/api/modules/sticky_notes' });

const StickyNotesWidget: React.FC<StickyNotesWidgetProps> = ({ instanceId, config }) => {
  const defaultColor = config.defaultColor ?? '#ffeb3b';
  const defaultFontSize = config.defaultFontSize ?? 16;

  const { data: restData, isLoading, error } = useModuleData<NotesData>(
    'sticky_notes',
    instanceId,
    30_000
  );

  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const initialized = useRef(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Sync REST data into local state
  useEffect(() => {
    if (restData?.notes && !initialized.current) {
      setNotes(restData.notes);
      initialized.current = true;
    }
  }, [restData]);

  // Real-time events
  const handleCreated = useCallback((data: Note) => {
    setNotes((prev) => [data, ...prev.filter((n) => n.id !== data.id)]);
  }, []);

  const handleUpdated = useCallback((data: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === data.id ? data : n)));
  }, []);

  const handleDeleted = useCallback((data: { id: number }) => {
    setNotes((prev) => prev.filter((n) => n.id !== data.id));
  }, []);

  useModuleEvents<Note>('sticky_notes', instanceId, handleCreated, 'created');
  useModuleEvents<Note>('sticky_notes', instanceId, handleUpdated, 'updated');
  useModuleEvents<{ id: number }>('sticky_notes', instanceId, handleDeleted, 'deleted');

  // Focus textarea when editing
  useEffect(() => {
    if (editingId !== null && editRef.current) {
      editRef.current.focus();
    }
  }, [editingId]);

  async function addNote() {
    try {
      const { data: note } = await api.post<Note>('/notes', {
        instance_id: instanceId,
        content: '',
        color: defaultColor,
        font_size: defaultFontSize,
      });
      setNotes((prev) => [note, ...prev]);
      setEditingId(note.id);
      setEditContent('');
    } catch (err) {
      console.error('[StickyNotesWidget] Failed to create note:', err);
    }
  }

  async function saveEdit(note: Note) {
    if (editContent === note.content) {
      setEditingId(null);
      return;
    }
    try {
      const { data: updated } = await api.put<Note>(`/notes/${note.id}`, {
        instance_id: instanceId,
        content: editContent,
      });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      console.error('[StickyNotesWidget] Failed to update note:', err);
    }
    setEditingId(null);
  }

  async function removeNote(noteId: number) {
    try {
      await api.delete(`/notes/${noteId}`, { data: { instance_id: instanceId } });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error('[StickyNotesWidget] Failed to delete note:', err);
    }
  }

  async function cycleColor(note: Note) {
    const idx = NOTE_COLORS.indexOf(note.color);
    const nextColor = NOTE_COLORS[(idx + 1) % NOTE_COLORS.length];
    try {
      const { data: updated } = await api.put<Note>(`/notes/${note.id}`, {
        instance_id: instanceId,
        color: nextColor,
      });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err) {
      console.error('[StickyNotesWidget] Failed to update color:', err);
    }
  }

  const display = notes.length > 0 ? notes : restData?.notes ?? [];

  if (isLoading && display.length === 0) {
    return (
      <div className={styles.container}>
        <span className={styles.loading}>Loading…</span>
      </div>
    );
  }

  if (error && display.length === 0 && !initialized.current) {
    return (
      <div className={styles.container}>
        <span className={styles.error}>Notes unavailable</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Notes</span>
        <button className={styles.addBtn} onClick={addNote} title="Add note">+</button>
      </div>
      <div className={styles.notesList}>
        {display.length === 0 && (
          <div className={styles.empty}>No notes yet. Tap + to add one.</div>
        )}
        {display.map((note) => (
          <div
            key={note.id}
            className={styles.note}
            style={{ backgroundColor: note.color, fontSize: note.font_size }}
          >
            {editingId === note.id ? (
              <textarea
                ref={editRef}
                className={styles.noteEdit}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={() => saveEdit(note)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingId(null);
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(note);
                }}
              />
            ) : (
              <div
                className={styles.noteContent}
                onClick={() => {
                  setEditingId(note.id);
                  setEditContent(note.content);
                }}
              >
                {note.content || <span className={styles.placeholder}>Click to edit…</span>}
              </div>
            )}
            <div className={styles.noteActions}>
              <button
                className={styles.actionBtn}
                onClick={() => cycleColor(note)}
                title="Change color"
              >
                <span className={styles.colorDot} style={{ backgroundColor: note.color }} />
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => removeNote(note.id)}
                title="Delete note"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickyNotesWidget;
