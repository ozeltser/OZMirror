/**
 * SQLite database setup and CRUD operations for the Sticky Notes module.
 * Uses better-sqlite3 (synchronous API) for simplicity and reliability.
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join('/app/data', 'sticky-notes.db');

let db: Database.Database;

export interface Note {
  id: number;
  instance_id: string;
  content: string;
  color: string;
  font_size: number;
  created_at: string;
  updated_at: string;
}

export function initDb(): void {
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#ffeb3b',
      font_size INTEGER NOT NULL DEFAULT 16,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_instance_id ON notes(instance_id);
  `);

  console.log(`[db] SQLite database initialised at ${DB_PATH}`);
}

export function getNotesByInstance(instanceId: string): Note[] {
  return db
    .prepare('SELECT * FROM notes WHERE instance_id = ? ORDER BY created_at ASC')
    .all(instanceId) as Note[];
}

export function getNoteById(id: number): Note | undefined {
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined;
}

export function createNote(
  instanceId: string,
  content: string,
  color = '#ffeb3b',
  fontSize = 16
): Note {
  const result = db
    .prepare(
      `INSERT INTO notes (instance_id, content, color, font_size)
       VALUES (?, ?, ?, ?)`
    )
    .run(instanceId, content, color, fontSize);

  return getNoteById(result.lastInsertRowid as number)!;
}

export function updateNote(
  id: number,
  fields: { content?: string; color?: string; font_size?: number }
): Note | null {
  const existing = getNoteById(id);
  if (!existing) return null;

  const content = fields.content ?? existing.content;
  const color = fields.color ?? existing.color;
  const font_size = fields.font_size ?? existing.font_size;

  db.prepare(
    `UPDATE notes
     SET content = ?, color = ?, font_size = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(content, color, font_size, id);

  return getNoteById(id)!;
}

export function deleteNote(id: number): boolean {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function closeDb(): void {
  db?.close();
  console.log('[db] SQLite database closed');
}
