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

export interface CreateNoteInput {
  instance_id: string;
  content?: string;
  color?: string;
  font_size?: number;
}

export interface UpdateNoteInput {
  content?: string;
  color?: string;
  font_size?: number;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
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

export function getNotesByInstance(instanceId: string): Note[] {
  const database = getDb();
  return database
    .prepare('SELECT * FROM notes WHERE instance_id = ? ORDER BY created_at DESC')
    .all(instanceId) as Note[];
}

export function getNoteById(id: number): Note | undefined {
  const database = getDb();
  return database.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined;
}

export function createNote(input: CreateNoteInput): Note {
  const database = getDb();
  const result = database
    .prepare(
      `INSERT INTO notes (instance_id, content, color, font_size)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.instance_id,
      input.content ?? '',
      input.color ?? '#ffeb3b',
      input.font_size ?? 16
    );

  return getNoteById(result.lastInsertRowid as number)!;
}

export function updateNote(id: number, input: UpdateNoteInput): Note | undefined {
  const database = getDb();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.content !== undefined) {
    fields.push('content = ?');
    values.push(input.content);
  }
  if (input.color !== undefined) {
    fields.push('color = ?');
    values.push(input.color);
  }
  if (input.font_size !== undefined) {
    fields.push('font_size = ?');
    values.push(input.font_size);
  }

  if (fields.length === 0) {
    return getNoteById(id);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  database.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getNoteById(id);
}

export function deleteNote(id: number): boolean {
  const database = getDb();
  const result = database.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return result.changes > 0;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
