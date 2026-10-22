import { readdirSync, statSync, copyFileSync, existsSync, mkdirSync, utimesSync, unlinkSync, readFileSync } from 'node:fs';
import { join, extname, basename, relative, sep } from 'node:path';
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

// ------------------------------------------------- pemetaan event dslrBooth
// dslrBooth membuat satu folder per event di C:\dslrBooth\<nama-event>\.
// Jadi nama folder = nama event, dan itu yang jadi kunci ke event replika.
const DSLR_SETTINGS_DIR = join(process.env.APPDATA || '', 'dslrBooth', 'Settings');
const DSLR_APP_SETTINGS = join(process.env.APPDATA || '', 'dslrBooth', 'app_settings_2021.json');

let currentEventCache = { name: null, at: 0 };

// Nama event dslrBooth yang sedang aktif (dari EventId di app_settings + file .lcfg).
export function currentEventName() {
  if (currentEventCache.name && Date.now() - currentEventCache.at < 5000) return currentEventCache.name;
  let name = null;
  try {
    const s = JSON.parse(readFileSync(DSLR_APP_SETTINGS, 'utf8'));
    const id = s.EventId;
    if (id) {
      const f = readdirSync(DSLR_SETTINGS_DIR).find((x) => x.startsWith(id + '-') && x.endsWith('.lcfg'));
      if (f) name = f.slice(id.length + 1, -'.lcfg'.length);
    }
  } catch {
    /* settings tidak terbaca */
  }
  if (!name) {
    // cadangan: folder event dengan media terbaru
    try {
      let best = null;
      let bestTime = 0;
      for (const d of readdirSync(BOOTH_ROOT, { withFileTypes: true })) {
        if (!d.isDirectory() || SKIP_DIRS.has(d.name)) continue;
        const dir = join(BOOTH_ROOT, d.name);
        const files = [];
        walk(dir, files);
        const newest = files.reduce((acc, p) => Math.max(acc, statSync(p).mtimeMs), 0);
        if (newest > bestTime) { bestTime = newest; best = d.name; }
      }
      name = best;
    } catch { /* abaikan */ }
  }
  currentEventCache = { name, at: Date.now() };
  return name;
}

// Nama event untuk sebuah file (dari path-nya), fallback ke event aktif.
export function eventNameFromPath(filePath) {
  const rel = relative(BOOTH_ROOT, filePath);
  const parts = rel.split(sep);
  if (parts.length > 1 && !SKIP_DIRS.has(parts[0])) return parts[0];
  return currentEventName();
}

const eventIdCache = new Map();

// Cari (atau buat) event replika yang namanya sama dengan event dslrBooth.
export function resolveEventId(eventName) {
  const name = String(eventName || '').trim();
  if (!name) return null;
  if (eventIdCache.has(name)) return eventIdCache.get(name);

  let ev =
    db.prepare("SELECT id FROM events WHERE LOWER(name) = LOWER(?) AND app = 'dslrbooth'").get(name) ||
    db.prepare('SELECT id FROM events WHERE LOWER(name) = LOWER(?)').get(name);

  if (!ev) {
    const info = db
      .prepare("INSERT INTO events (user_id, name, app, status) VALUES (1, ?, 'dslrbooth', 'active')")
      .run(name);
    ev = { id: info.lastInsertRowid };
    console.log(`[booth] event replika dibuat: "${name}" (id=${ev.id})`);
  }
  eventIdCache.set(name, ev.id);
  return ev.id;
}

// Event replika untuk event dslrBooth yang sedang aktif.
export function currentEventId() {
  return resolveEventId(currentEventName());
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
// Tiap file diarahkan ke event replika yang namanya sama dengan event dslrBooth asalnya.
export function importNewPhotos() {
  const files = [];
  walk(BOOTH_ROOT, files);
  backfillSessions();
  if (files.length === 0) return { imported: [], scanned: 0 };

  const imported = [];
  for (const f of files) {
    if (isImported(f)) continue;
    const eventId = resolveEventId(eventNameFromPath(f));
    if (!eventId) continue;
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
