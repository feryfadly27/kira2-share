/**
 * VPS Sync — mendorong foto & event dari replika lokal ke backend VPS.
 *
 * Alur:
 *  1. Backend lokal tetap mengimpor foto dari folder dslrBooth (booth.js).
 *  2. Modul ini mencocokkan event lokal <-> event VPS berdasarkan NAMA.
 *     Bila event belum ada di VPS, ia dibuat lewat API resmi (/api/event/create).
 *  3. Setiap foto yang belum terkirim (photos.vps_synced = 0) di-PUT ke
 *     endpoint publik VPS:  /gallery/<vpsEventId>?session=<SessionNanoId>
 *     (endpoint itu dipakai juga oleh alur upload dslrBooth asli).
 *  4. Status tersimpan di DB lokal supaya foto tidak terkirim dua kali.
 *
 * Konfigurasi lewat env:
 *   VPS_BASE_URL  — contoh: https://shares.kira2memories.web.id
 *   VPS_EMAIL     — akun di VPS   (default: demo@local)
 *   VPS_PASSWORD  — sandi di VPS  (default: demo1234)
 */
import { readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, '..', 'uploads');

const VPS_BASE = (process.env.VPS_BASE_URL || process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const VPS_EMAIL = process.env.VPS_EMAIL || 'demo@local';
const VPS_PASSWORD = process.env.VPS_PASSWORD || 'demo1234';

// Batas foto per tick & jeda antar tick (supaya VPS tidak kebanjiran).
const BATCH = 10;
const TICK_MS = 4000;

export const vpsSyncEnabled = () => !!VPS_BASE;

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

let token = null;

async function login() {
  const r = await fetch(`${VPS_BASE}/api/user/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: VPS_EMAIL, password: VPS_PASSWORD }),
  });
  if (!r.ok) throw new Error(`login VPS gagal (HTTP ${r.status})`);
  const j = await r.json();
  token = j.token;
  return token;
}

// Request API VPS dengan Bearer token; otomatis login ulang bila token kedaluwarsa.
async function api(path, opts = {}, retry = true) {
  if (!token) await login();
  const headers = { ...(opts.headers || {}), authorization: `Bearer ${token}` };
  // Hanya pakai application/json untuk body teks. FormData dibiarkan
  // (biar fetch yang menentukan boundary multipart).
  if (typeof opts.body === 'string' && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const r = await fetch(`${VPS_BASE}${path}`, { ...opts, headers });
  if (r.status === 401 && retry) {
    token = null;
    return api(path, opts, false);
  }
  return r;
}

// Cari event di VPS berdasarkan nama (telusuri semua halaman).
async function findVpsEventByName(name) {
  const target = String(name).toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const r = await api(`/api/event/all?page=${page}`);
    if (!r.ok) return null;
    const j = await r.json();
    const hit = (j.data || []).find((e) => String(e.name).toLowerCase() === target);
    if (hit) return hit;
    if (!j.data || j.data.length < (j.per || 20)) break; // sudah habis
  }
  return null;
}

// Pastikan event lokal punya padanan di VPS. Kembalikan id VPS-nya.
export async function ensureVpsEvent(localEventId) {
  const ev = db.prepare('SELECT id, name, vps_event_id FROM events WHERE id = ?').get(localEventId);
  if (!ev) return null;
  if (ev.vps_event_id) return ev.vps_event_id;

  let remote = await findVpsEventByName(ev.name);
  if (!remote) {
    const c = await api('/api/event/create', {
      method: 'POST',
      body: JSON.stringify({ name: ev.name, app: 'dslrbooth' }),
    });
    if (!c.ok) throw new Error(`buat event VPS gagal (HTTP ${c.status})`);
    remote = await c.json();
  }
  db.prepare('UPDATE events SET vps_event_id = ? WHERE id = ?').run(remote.id, localEventId);
  console.log(`[vps] event "${ev.name}" terpetakan -> VPS id=${remote.id}`);
  return remote.id;
}

// Kirim satu foto lokal ke VPS. true bila berhasil.
export async function pushPhoto(photoId) {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
  if (!p) return false;
  const vpsId = await ensureVpsEvent(p.event_id);
  if (!vpsId) return false;

  const file = join(UPLOADS, p.filename);
  const buf = readFileSync(file);
  const ct = MIME[extname(p.filename).toLowerCase()] || 'application/octet-stream';

  // Pakai endpoint upload resmi VPS (multipart, butuh login):
  //   POST /api/event/:id/photos   field "file"
  const form = new FormData();
  form.append('file', new Blob([buf], { type: ct }), p.filename);

  const r = await api(`/api/event/${vpsId}/photos`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`upload foto ke VPS gagal (HTTP ${r.status})`);
  db.prepare('UPDATE photos SET vps_synced = 1 WHERE id = ?').run(photoId);
  return true;
}

// id yang dipakai di link publik: id VPS bila sudah terpetakan, kalau tidak id lokal.
export function publicEventId(localEventId) {
  if (!vpsSyncEnabled()) return localEventId;
  const r = db.prepare('SELECT vps_event_id FROM events WHERE id = ?').get(localEventId);
  return r?.vps_event_id || localEventId;
}

let busy = false;

async function tick() {
  if (busy || !vpsSyncEnabled()) return;
  busy = true;
  try {
    // 1) Petakan semua event lokal yang belum punya padanan VPS.
    const unmapped = db
      .prepare('SELECT id FROM events WHERE vps_event_id IS NULL ORDER BY id')
      .all();
    for (const e of unmapped) {
      try {
        await ensureVpsEvent(e.id);
      } catch (err) {
        console.error(`[vps] gagal petakan event ${e.id}: ${err.message}`);
        return; // koneksi bermasalah -> coba lagi tick berikutnya
      }
    }

    // 2) Dorong foto yang belum terkirim (urut terlama dulu).
    const pending = db
      .prepare('SELECT id FROM photos WHERE vps_synced = 0 ORDER BY id LIMIT ?')
      .all(BATCH);
    for (const p of pending) {
      try {
        await pushPhoto(p.id);
        console.log(`[vps] foto #${p.id} terkirim ke VPS`);
      } catch (err) {
        console.error(`[vps] foto #${p.id} gagal: ${err.message}`);
        break; // berhenti dulu, coba lagi tick berikutnya
      }
    }
  } catch (e) {
    console.error('[vps] sync error:', e.message);
  } finally {
    busy = false;
  }
}

export function startVpsSync() {
  if (!vpsSyncEnabled()) {
    console.log('[vps] sinkronisasi nonaktif (VPS_BASE_URL kosong)');
    return;
  }
  console.log(`[vps] sinkronisasi aktif -> ${VPS_BASE} (akun ${VPS_EMAIL})`);
  tick();
  const t = setInterval(tick, TICK_MS);
  if (typeof t.unref === 'function') t.unref();
}

// Ringkasan status untuk diagnostic.
export function vpsStatus() {
  const total = db.prepare('SELECT COUNT(*) c FROM photos').get().c;
  const synced = db.prepare('SELECT COUNT(*) c FROM photos WHERE vps_synced = 1').get().c;
  const mapped = db.prepare('SELECT COUNT(*) c FROM events WHERE vps_event_id IS NOT NULL').get().c;
  const evTotal = db.prepare('SELECT COUNT(*) c FROM events').get().c;
  return {
    enabled: vpsSyncEnabled(),
    base: VPS_BASE || null,
    photos: { total, synced, pending: total - synced },
    events: { total: evTotal, mapped },
  };
}
