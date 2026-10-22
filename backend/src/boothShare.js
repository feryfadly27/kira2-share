/**
 * LumaBooth Share Link Rewriter
 *
 * dslrBooth membuat QR share dari nilai `FileItems.UploadUrl` yang tersimpan
 * di database lokal miliknya (AppData\Roaming\dslrBooth\database_2025.db).
 *
 * Karena upload ke cloud ditolak (lisensi), nilai itu berisi URL error
 * "fotoshare.co/license-error?..." — itulah yang jadi isi QR.
 *
 * Modul ini menulis ulang nilai tersebut menjadi link galeri self-host,
 * **sesuai event asalnya** (menggunakan FileItems.AlbumName = nama event dslrBooth),
 * sehingga QR dslrBooth menunjuk ke galeri event yang benar.
 *
 * Tidak ada pemalsuan validasi lisensi: endpoint lisensi diteruskan utuh
 * ke server asli. Yang diubah hanya tujuan link.
 */
import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const DSLR_DB = join(process.env.APPDATA || '', 'dslrBooth', 'database_2025.db');
const CLOUD_URL = /fotoshare\.co/i;
// Link galeri milik kita sendiri (hasil rewrite sebelumnya) - ikut di-refresh
// supaya event/session-nya selalu benar.
const OUR_GALLERY = /^https?:\/\/[^/]+\/gallery\//i;

let lastSummary = { updated: 0, total: 0 };

/**
 * @param {object} info
 * @param {(name:string)=>number|null} info.resolveEventId  nama event dslrBooth -> id event replika
 * @param {(eventId:number)=>string}   info.baseUrl         id event replika -> URL dasar galeri
 */
export function rewriteUploadUrls(info) {
  if (!existsSync(DSLR_DB)) return { updated: 0, total: 0, skipped: 'db tidak ada' };

  let db;
  try {
    db = new DatabaseSync(DSLR_DB);
  } catch (e) {
    return { updated: 0, total: 0, skipped: e.message };
  }

  try {
    const rows = db
      .prepare('SELECT Id, SessionNanoId, AlbumName, UploadUrl FROM FileItems')
      .all();
    if (rows.length === 0) return { updated: 0, total: 0 };

    const upd = db.prepare('UPDATE FileItems SET UploadUrl = ? WHERE Id = ?');
    let updated = 0;
    for (const r of rows) {
      if (!r.UploadUrl || !(CLOUD_URL.test(r.UploadUrl) || OUR_GALLERY.test(r.UploadUrl))) continue;
      const eventId = info.resolveEventId(r.AlbumName);
      if (!eventId) continue;
      const base = info.baseUrl(eventId);
      const target = r.SessionNanoId
        ? `${base}?session=${encodeURIComponent(r.SessionNanoId)}`
        : base;
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

export function startShareRewriter(getInfo, intervalMs = 800) {
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
