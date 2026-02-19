import { useState, useEffect, useRef } from 'react';
import { useWebSocketChannel } from '../hooks/useWebSocket';
import { getNotes, createNote, updateNote, deleteNote } from '../api/modulesApi';
import type { Note } from '../types';
import styles from './StickyNotesWidget.module.css';

interface StickyNotesWidgetProps {
  instanceId: string;
  config?: {
    defaultColor?: string;
    defaultFontSize?: number;
  };
}

const COLOR_PALETTE = [
  '#ffeb3b', // yellow
  '#ff9800', // orange
  '#f48fb1', // pink
  '#a5d6a7', // green
  '#90caf9', // blue
  '#ce93d8', // purple
  '#ffffff', // white
  '#b0bec5', // grey
];

interface NoteCardProps {
  note: Note;
  onUpdate: (id: number, data: Partial<Note>) => void;
  onDelete: (id: number) => void;
}

function NoteCard({ note, onUpdate, onDelete }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const saveContent = () => {
    setEditing(false);
    if (content !== note.content) {
      onUpdate(note.id, { content });
    }
  };

  return (
    <div
      className={styles.noteCard}
      style={{ backgroundColor: note.color, fontSize: `${note.font_size}px` }}
    >
      <div className={styles.noteToolbar}>
        <div className={styles.colorRow}>
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              className={`${styles.colorDot} ${note.color === c ? styles.colorDotActive : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onUpdate(note.id, { color: c })}
              aria-label={`Set color ${c}`}
            />
          ))}
        </div>
        <div className={styles.toolbarActions}>
          <button
            className={styles.fontBtn}
            onClick={() => onUpdate(note.id, { font_size: Math.max(10, note.font_size - 2) })}
            title="Decrease font size"
          >
            A-
          </button>
          <button
            className={styles.fontBtn}
            onClick={() => onUpdate(note.id, { font_size: Math.min(32, note.font_size + 2) })}
            title="Increase font size"
          >
            A+
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => onDelete(note.id)}
            title="Delete note"
          >
            ✕
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          className={styles.noteTextarea}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={saveContent}
          onKeyDown={(e) => {
            if (e.key === 'Escape') saveContent();
          }}
          style={{ fontSize: `${note.font_size}px` }}
        />
      ) : (
        <div
          className={styles.noteContent}
          onClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(true);
          }}
        >
          {note.content || <span className={styles.placeholder}>Click to add text...</span>}
        </div>
      )}
    </div>
  );
}

export default function StickyNotesWidget({
  instanceId,
  config = {},
}: StickyNotesWidgetProps) {
  const defaultColor = config.defaultColor ?? '#ffeb3b';
  const defaultFontSize = config.defaultFontSize ?? 16;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotes(instanceId)
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instanceId]);

  // Single source of truth: WebSocket events drive all state changes.
  // API handlers only fire the request; the resulting WebSocket event updates state.
  useWebSocketChannel(`module:sticky_notes:created`, (payload) => {
    const event = payload as { instanceId: string; data: Note };
    if (event.instanceId === instanceId) {
      setNotes((prev) => {
        // Deduplicate: the note may already be present if this client initiated the create
        if (prev.some((n) => n.id === event.data.id)) return prev;
        return [event.data, ...prev];
      });
    }
  });

  useWebSocketChannel(`module:sticky_notes:updated`, (payload) => {
    const event = payload as { instanceId: string; data: Note };
    if (event.instanceId === instanceId) {
      setNotes((prev) => prev.map((n) => (n.id === event.data.id ? event.data : n)));
    }
  });

  useWebSocketChannel(`module:sticky_notes:deleted`, (payload) => {
    const event = payload as { instanceId: string; data: { id: number } };
    if (event.instanceId === instanceId) {
      setNotes((prev) => prev.filter((n) => n.id !== event.data.id));
    }
  });

  // Fire-and-forget: WebSocket events will update state.
  const handleCreate = () => {
    createNote(instanceId, {
      content: '',
      color: defaultColor,
      font_size: defaultFontSize,
    }).catch(console.error);
  };

  const handleUpdate = (id: number, data: Partial<Note>) => {
    updateNote(id, { ...data, instance_id: instanceId } as Record<string, unknown>).catch(
      console.error
    );
  };

  const handleDelete = (id: number) => {
    deleteNote(id, instanceId).catch(console.error);
  };

  if (loading) {
    return (
      <div className={styles.widget}>
        <span className={styles.loading}>Loading notes...</span>
      </div>
    );
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Sticky Notes</span>
        <button className={styles.addBtn} onClick={handleCreate} title="Add note">
          + Add Note
        </button>
      </div>
      <div className={styles.noteList}>
        {notes.length === 0 && (
          <div className={styles.empty}>No notes yet. Click &quot;+ Add Note&quot; to start.</div>
        )}
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
