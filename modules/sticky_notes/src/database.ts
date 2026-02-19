/**
 * SQLite database for sticky notes persistence.
 * Uses better-sqlite3 with WAL mode for concurrent reads.
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.env.DATA_DIR || '/app/data', 'sticky_notes.db');

export interface Note {
  id: number;
  instance_id: string;
  content: string;
  color: string;
  font_size: number;
  created_at: string;
  updated_at: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id TEXT NOT NULL,
        content TEXT DEFAULT '',
        color TEXT DEFAULT '#ffeb3b',
        font_size INTEGER DEFAULT 16,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notes_instance_id ON notes(instance_id);
    `);
  }
  return db;
}

export function getNotesByInstance(instanceId: string): Note[] {
  return getDb()
    .prepare('SELECT * FROM notes WHERE instance_id = ? ORDER BY created_at DESC')
    .all(instanceId) as Note[];
}

export function createNote(instanceId: string, content = '', color = '#ffeb3b', fontSize = 16): Note {
  return getDb()
    .prepare(
      `INSERT INTO notes (instance_id, content, color, font_size)
       VALUES (?, ?, ?, ?) RETURNING *`
    )
    .get(instanceId, content, color, fontSize) as Note;
}

export function updateNote(
  id: number,
  instanceId: string,
  fields: { content?: string; color?: string; font_size?: number }
): Note | undefined {
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (fields.content !== undefined) { sets.push('content = ?'); values.push(fields.content); }
  if (fields.color !== undefined) { sets.push('color = ?'); values.push(fields.color); }
  if (fields.font_size !== undefined) { sets.push('font_size = ?'); values.push(fields.font_size); }

  if (sets.length === 0) return undefined;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, instanceId);

  return getDb()
    .prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ? AND instance_id = ? RETURNING *`)
    .get(...values) as Note | undefined;
}

export function deleteNote(id: number, instanceId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM notes WHERE id = ? AND instance_id = ?')
    .run(id, instanceId);
  return result.changes > 0;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
