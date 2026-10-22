import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

// SQLite bawaan Node 22.5+/24 — tanpa komponen native.
export const db = new DatabaseSync(join(dataDir, 'replica.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT DEFAULT '',
    plan          TEXT DEFAULT 'free',
    ai_credits    INTEGER DEFAULT 0,
    sms_credits   INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    app         TEXT DEFAULT 'lumabooth',
    status      TEXT DEFAULT 'active',
    cover       TEXT DEFAULT '',
    experiences INTEGER DEFAULT 1,
    shares      INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT DEFAULT 'photo',
    overlay    TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL,
    filename   TEXT NOT NULL,
    url        TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id)
  );
`);

// Tambah kolom source_path (jalur asli di C:\dslrBooth) untuk dedup import.
// Abaikan kalau sudah ada (ALTER TABLE error jika kolom sudah ada).
try {
  db.exec('ALTER TABLE photos ADD COLUMN source_path TEXT');
} catch { /* kolom sudah ada */ }

// Tambah kolom session_id (SessionNanoId dari dslrBooth) -> mengelompokkan foto per sesi.
try {
  db.exec('ALTER TABLE photos ADD COLUMN session_id TEXT');
} catch { /* kolom sudah ada */ }
