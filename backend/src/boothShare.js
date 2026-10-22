/**
 * LumaBooth Share Link Rewriter
 *
 * dslrBooth membuat QR share dari nilai `FileItems.UploadUrl` yang tersimpan
 * di database lokal miliknya (C:\Users\<user>\AppData\Roaming\dslrBooth\database_2025.db).
 *
 * Karena upload ke cloud ditolak (lisensi), nilai itu berisi URL error
 * "fotoshare.co/license-error?..." — itulah yang jadi isi QR.
 *
 * Modul ini menulis ulang nilai tersebut menjadi link galeri self-host
 * (per sesi), sehingga QR yang ditampilkan dslrBooth langsung mengarah ke
 * server kita. Tidak ada pemalsuan lisensi: hanya tujuan link yang diganti.
 */
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const DSLR_DB = join(process.env.APPDATA || '', 'dslrBooth', 'database_2025.db');
const DSLR_SETTINGS = join(process.env.APPDATA || '', 'dslrBooth', 'app_settings_2021.json');

// Pola URL yang perlu diganti (link ke cloud fotoshare).
const CLOUD_URL = /fotoshare\.co/i;

let lastSummary = { updated: 0, total: 0 };

/**
 * @param {(eventId:number)=>string} galleryUrlFn
 *   menghasilkan URL galeri, mis. (id) => `http://192.168.1.5:4000/gallery/${id}?session=XYZ`
 */
export function rewriteUploadUrls(galleryUrlFn) {
  if (!existsSync(DSLR_DB)) return { updated: 0, total: 0, skipped: 'db tidak ada' };

  let db;
  try {
    db = new DatabaseSync(DSLR_DB);
  } catch (e) {
    return { updated: 0, total: 0, skipped: e.message };
  }

  try {
    // Temukan event booth di replika (id = 5 "dslrBooth Import")
    const eventId = galleryUrlFn.eventId;
    const rows = db.prepare('SELECT Id, SessionNanoId, UploadUrl FROM FileItems').all();
    if (rows.length === 0) return { updated: 0, total: 0 };

    const upd = db.prepare('UPDATE FileItems SET UploadUrl = ? WHERE Id = ?');
    let updated = 0;
    for (const r of rows) {
      if (!r.UploadUrl || !CLOUD_URL.test(r.UploadUrl)) continue;
      const target = r.SessionNanoId
        ? `${galleryUrlFn.base}?session=${encodeURIComponent(r.SessionNanoId)}`
        : galleryUrlFn.base;
      if (r.UploadUrl === target) continue;
      upd.run(target, r.Id);
      updated++;
    }
    lastSummary = { updated, total: rows.length };
    if (updated) {
      console.log(`[share] ${updated} link share dslrBooth ditulis ke galeri self-host`);
    }
    return lastSummary;
  } catch (e) {
    // DB sedang dipakai app -> coba lagi nanti
    return { updated: 0, total: 0, skipped: e.message };
  } finally {
    try { db.close(); } catch { /* abaikan */ }
  }
}

export function startShareRewriter(getInfo, intervalMs = 2500) {
  const run = () => {
    try {
      const info = getInfo();
      if (!info) return;
      rewriteUploadUrls(info);
    } catch (e) {
      console.error('[share] error:', e.message);
    }
  };
  run();
  const t = setInterval(run, intervalMs);
  if (typeof t.unref === 'function') t.unref();
  console.log(`[share] rewriter link share aktif (${DSLR_DB})`);
}
