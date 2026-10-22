import { readdirSync, statSync, copyFileSync, existsSync, mkdirSync, utimesSync, unlinkSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { db } from './db.js';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Akar penyimpanan foto dslrBooth (ImagesPath dari app_settings).
const BOOTH_ROOT = process.env.DSLRBOOTH_IMAGE_PATH || 'C:\\dslrBooth';
const UPLOADS = join(__dirname, '..', 'uploads');
mkdirSync(UPLOADS, { recursive: true });

// Folder yang bukan berisi hasil capture.
const SKIP_DIRS = new Set(['Settings', 'Templates', 'StartScreenTemplates', 'Logs']);
// File milik kita sendiri (QR) - jangan diimpor sebagai foto.
const SKIP_FILES = new Set(['lumabooth-qr.png', 'selfhost-qr.png']);
const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm']);

// Delay (ms) agar file yang masih ditulis app tidak ikut ter-copy setengah jangan.
const SETTLE_MS = 2500;

function ensureBoothEvent() {
  let ev = db.prepare("SELECT id FROM events WHERE name = ?").get('dslrBooth Import');
  if (!ev) {
    const info = db
      .prepare("INSERT INTO events (user_id, name, app, status) VALUES (1, ?, 'dslrbooth', 'active')")
      .run('dslrBooth Import');
    ev = { id: info.lastInsertRowid };
  }
  return ev.id;
}

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile() && MEDIA_EXT.has(extname(e.name).toLowerCase())) {
      if (SKIP_FILES.has(e.name.toLowerCase())) continue;
      out.push(full);
    }
  }
}

function isImported(sourcePath) {
  const row = db.prepare('SELECT id FROM photos WHERE source_path = ?').get(sourcePath);
  return !!row;
}

// ------------------------------------------------- pemetaan file -> sesi
// DB lokal dslrBooth (FileItems) memuat SessionNanoId per sesi foto.
const DSLR_DB = join(process.env.APPDATA || '', 'dslrBooth', 'database_2025.db');
let sessionMap = null;
let sessionMapStamp = 0;

function loadSessionMap() {
  if (sessionMap && Date.now() - sessionMapStamp < 20000) return sessionMap;
  sessionMap = new Map();
  sessionMapStamp = Date.now();
  try {
    if (!existsSync(DSLR_DB)) return sessionMap;
    // salin snapshot supaya aman dari lock SQLite saat app sedang jalan
    const snap = join(tmpdir(), 'dslr_db_snapshot.db');
    copyFileSync(DSLR_DB, snap);
    const d = new DatabaseSync(snap, { readOnly: true });
    for (const r of d.prepare('SELECT FileName, SessionNanoId FROM FileItems').all()) {
      if (r.FileName) sessionMap.set(String(r.FileName).toLowerCase(), r.SessionNanoId || null);
    }
    d.close();
    try { unlinkSync(snap); } catch { /* abaikan */ }
  } catch {
    /* DB terkunci / belum ada -> tanpa info sesi */
  }
  return sessionMap;
}

function importFile(sourcePath, eventId) {
  const st = statSync(sourcePath);
  if (st.size === 0) return null;
  if (Date.now() - st.mtimeMs < SETTLE_MS) return null; // masih ditulis

  const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(sourcePath).toLowerCase();
  const dest = join(UPLOADS, safeName);
  try {
    copyFileSync(sourcePath, dest);
    // Pertahankan waktu asli agar urutan chronologis masuk akal.
    try { utimesSync(dest, st.atime, st.mtime); } catch {}
  } catch {
    return null; // bisa jadi masih terkunci app
  }

  const url = `/uploads/${safeName}`;
  const sessionId = loadSessionMap().get(sourcePath.toLowerCase()) || null;
  const info = db
    .prepare('INSERT INTO photos (event_id, filename, url, source_path, session_id) VALUES (?, ?, ?, ?, ?)')
    .run(eventId, safeName, url, sourcePath, sessionId);
  db.prepare('UPDATE events SET shares = shares + 1 WHERE id = ?').run(eventId);
  return { id: info.lastInsertRowid, url, source: sourcePath, session_id: sessionId };
}

// Isi session_id untuk foto yang terimpor sebelum kolom ini ada.
function backfillSessions() {
  const rows = db.prepare('SELECT id, source_path FROM photos WHERE session_id IS NULL AND source_path IS NOT NULL').all();
  if (rows.length === 0) return;
  const map = loadSessionMap();
  const upd = db.prepare('UPDATE photos SET session_id = ? WHERE id = ?');
  for (const r of rows) {
    const s = map.get(String(r.source_path).toLowerCase());
    if (s) upd.run(s, r.id);
  }
}

// Pindai folder dslrBooth, impor media baru yang belum masuk replika.
export function importNewPhotos() {
  const files = [];
  walk(BOOTH_ROOT, files);
  backfillSessions();
  if (files.length === 0) return { imported: [], scanned: 0 };

  const eventId = ensureBoothEvent();
  const imported = [];
  for (const f of files) {
    if (isImported(f)) continue;
    const rec = importFile(f, eventId);
    if (rec) {
      imported.push(rec);
      console.log(`[booth] import: ${rec.url}  <= ${f}`);
    }
  }
  return { imported, scanned: files.length };
}

let timer = null;
export function startBoothWatcher(intervalMs = 5000) {
  if (timer) return;
  // Pindai sekali saat start, lalu berkala.
  importNewPhotos();
  timer = setInterval(() => {
    try { importNewPhotos(); } catch (e) { console.error('[booth] watcher error:', e.message); }
  }, intervalMs);
  // Jangan tahan proses hanya karena timer ini.
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`[booth] watcher aktif -> ${BOOTH_ROOT} (setiap ${intervalMs}ms)`);
}
