import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import userRoutes from './routes/user.js';
import eventRoutes from './routes/event.js';
import experienceRoutes from './routes/experience.js';
import photoRoutes from './routes/photo.js';
import shareRoutes from './routes/share.js';
import subscriptionRoutes from './routes/subscription.js';
import { startBoothWatcher, importNewPhotos, currentEventId, currentEventName, resolveEventId } from './booth.js';
import { startScreenWatcher } from './boothScreen.js';
import { startShareRewriter } from './boothShare.js';
import { startVpsSync, publicEventId, vpsStatus } from './vpsSync.js';
import { renderGallery, renderQrPage } from './views.js';
import { db } from './db.js';
import QRCode from 'qrcode';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Folder upload foto (pengganti Backblaze B2 + CDN).
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kira2-share' }));

// Status sinkronisasi ke VPS (diagnostic).
app.get('/api/booth/vps-status', (req, res) => res.json(vpsStatus()));
app.use('/api/user', userRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/event', experienceRoutes); // /api/event/:id/experiences
app.use('/api/event', photoRoutes);      // /api/event/:id/photos
app.use('/api/share', shareRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Impor foto dslrBooth -> replika (manual trigger; watcher juga jalan otomatis).
app.post('/api/booth/import', (req, res) => {
  try {
    res.json(importNewPhotos());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
//  Jembatan QR dslrBooth -> replika
//  QR dslrBooth berformat: http://{ip}:{WebserverPort}/view/{a}/{b}
//  Kita set WebserverPort = 4000 (port Express ini) supaya QR jatuh
//  ke server kita, lalu diarahkan ke galeri semua foto (ori + gif + print).
// ============================================================

// Event replika yang mewakili event dslrBooth yang sedang aktif.
function boothEventId() {
  return currentEventId();
}

// URL dasar galeri untuk sebuah event replika.
// Prioritaskan PUBLIC_BASE_URL dari environment (untuk tunnel/cloudflared).
// Jika tidak ada, gunakan IP LAN.
function galleryBaseUrl(eventId) {
  const base = process.env.PUBLIC_BASE_URL
    ? process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
    : `http://${getLanIp()}:${process.env.PORT || 4000}`;
  // Saat sinkronisasi VPS aktif, pakai id event di VPS supaya link valid di sana.
  return base + `/gallery/${publicEventId(eventId)}`;
}

// Ambil IPv4 LAN utama (untuk QR yang harus bisa dibuka HP di jaringan yang sama).
function getLanIp() {
  const ifs = os.networkInterfaces();
  const cands = [];
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) {
      if (a.family === 'IPv4' && !a.internal) cands.push(a.address);
    }
  }
  return (
    cands.find((ip) => ip.startsWith('192.168.')) ||
    cands.find((ip) => !ip.startsWith('169.254.')) ||
    cands[0] ||
    '127.0.0.1'
  );
}

// Bangun base URL kanonik untuk QR: selalu ke backend (port 4000) di IP LAN,
// supaya HP bisa membuka galeri apa pun halaman yang dipakai membuka /qr.
function lanBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `http://${getLanIp()}:${process.env.PORT || 4000}`;
}

// URL galeri self-host (dipakai bridge MITM untuk mengarahkan QR dslrBooth).
// Selalu per-SESI: sesi foto terakhir, supaya QR membawa foto sesi tersebut.
app.get('/api/booth/gallery-url', (req, res) => {
  const id = boothEventId();
  if (!id) return res.status(404).json({ error: 'belum ada foto booth yang diimpor' });
  const base = `${lanBaseUrl()}/gallery/${publicEventId(id)}`;
  // sesi terakhir (foto terbaru yang punya session_id)
  const last = db
    .prepare('SELECT session_id FROM photos WHERE event_id = ? AND session_id IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(id);
  const url = last?.session_id ? `${base}?session=${encodeURIComponent(last.session_id)}` : base;
  res.json({ event_id: id, session_id: last?.session_id ?? null, url });
});

// Pintasan: buka QR untuk event "dslrBooth Import".
app.get('/booth', (req, res) => {
  const id = boothEventId();
  if (!id) return res.status(404).type('html').send('<h1>Belum ada foto booth yang diimpor.</h1>');
  res.redirect(302, `/qr/${id}`);
});

// Halaman QR besar -> galeri semua foto (untuk ditampilkan/dicetak di booth).
app.get('/qr/:eventId', async (req, res) => {
  const ev = db.prepare('SELECT id, name FROM events WHERE id = ?').get(req.params.eventId);
  if (!ev) return res.status(404).type('html').send('<h1>Event tidak ditemukan</h1>');

  const base = lanBaseUrl();
  const galleryUrl = `${base}/gallery/${publicEventId(ev.id)}`;
  let svg = '';
  try {
    svg = await QRCode.toString(galleryUrl, {
      type: 'svg',
      margin: 1,
      width: 360,
      color: { dark: '#16130F', light: '#FFFFFF' },
    });
  } catch (e) {
    svg = `<p>Gagal membuat QR: ${e.message}</p>`;
  }

  // Hitung foto pada sesi TERBARU (sesuai tujuan link QR).
  const last = db
    .prepare('SELECT session_id FROM photos WHERE event_id = ? AND session_id IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(ev.id);
  const cnt = last?.session_id
    ? db.prepare('SELECT COUNT(*) c FROM photos WHERE event_id = ? AND session_id = ?').get(ev.id, last.session_id).c
    : db.prepare('SELECT COUNT(*) c FROM photos WHERE event_id = ?').get(ev.id).c;
  res.type('html').send(renderQrPage({ title: ev.name, svg, galleryUrl, count: cnt }));
});

app.get('/view/:a/:b', (req, res) => {
  const id = boothEventId();
  if (!id) return res.status(404).send('Belum ada foto booth yang diimpor.');
  res.redirect(302, `/gallery/${id}`);
});

// Galeri publik per event.
// Default: foto dari SESI TERBARU saja (supaya tamu tidak melihat sesi lain).
// ?session=<id> -> sesi tertentu, ?all=1 -> semua sesi.
const galleryUpload = express.raw({ type: '*/*', limit: '120mb' });

function handleGalleryUpload(req, res) {
  // Menerima upload file dari dslrBooth (link share-nya kita arahkan ke sini).
  const ev = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.eventId);
  if (!ev) return res.status(404).json({ error: 'event tidak ada' });
  const buf = req.body;
  if (!buf || !buf.length) return res.status(400).json({ error: 'body kosong' });

  const ct = String(req.headers['content-type'] || '');
  const ext = ct.includes('mp4') ? '.mp4'
    : ct.includes('webm') ? '.webm'
    : ct.includes('png') ? '.png'
    : ct.includes('gif') ? '.gif'
    : '.jpg';
  const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
  const dest = join(__dirname, '..', 'uploads', name);
  try {
    writeFileSync(dest, buf);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  const sessionId = req.query.session ? String(req.query.session) : null;
  db.prepare('INSERT INTO photos (event_id, filename, url, session_id) VALUES (?, ?, ?, ?)')
    .run(ev.id, name, `/uploads/${name}`, sessionId);
  db.prepare('UPDATE events SET shares = shares + 1 WHERE id = ?').run(ev.id);
  console.log(`[gallery] upload dari dslrBooth diterima: ${name} (${buf.length} b)`);
  res.json({ success: true, url: `/uploads/${name}` });
}

app.post('/gallery/:eventId', galleryUpload, handleGalleryUpload);
app.put('/gallery/:eventId', galleryUpload, handleGalleryUpload);

app.get('/gallery/:eventId', (req, res) => {
  const ev = db.prepare('SELECT id, name FROM events WHERE id = ?').get(req.params.eventId);
  if (!ev) return res.status(404).type('html').send('<h1>Galeri tidak ditemukan</h1>');

  const all = db
    .prepare('SELECT id, filename, url, created_at, session_id FROM photos WHERE event_id = ? ORDER BY created_at DESC')
    .all(ev.id);

  // Daftar sesi (urutan terbaru lebih dulu) + jumlah fotonya.
  const sessionCounts = new Map();
  for (const p of all) {
    if (!p.session_id) continue;
    sessionCounts.set(p.session_id, (sessionCounts.get(p.session_id) || 0) + 1);
  }
  const sessions = [...sessionCounts.keys()];

  let photos = all;
  let currentSession = null;
  if (req.query.all !== '1') {
    if (req.query.session && sessionCounts.has(String(req.query.session))) {
      currentSession = String(req.query.session);
    } else if (sessions.length) {
      currentSession = sessions[0]; // sesi terbaru
    }
    if (currentSession) photos = all.filter((p) => p.session_id === currentSession);
  }

  // Pemilih sesi - hanya ditampilkan bila pengguna meminta semua sesi (?all=1).
  // secara default hanya sesi berjalan yang ditampilkan (tanpa daftar sesi lain).
  const sessionTabs =
    req.query.all === '1' && sessions.length
      ? `<div class="tabs">${sessions
          .map(
            (s) =>
              `<a class="tab${s === currentSession ? ' on' : ''}" href="/gallery/${ev.id}?session=${encodeURIComponent(s)}">Sesi ${sessionCounts.get(s)} foto</a>`
          )
          .join('')}<a class="tab on" href="/gallery/${ev.id}?all=1">Semua sesi</a></div>`
      : '';

  res.type('html').send(
    renderGallery({
      title: ev.name,
      photos,
      tabsHtml: sessionTabs,
      qrHref: `/qr/${ev.id}`,
      sessionNote: req.query.all === '1' ? 'Semua sesi' : 'Sesi foto kamu',
    })
  );
});

// 404 untuk path /api yang tidak dikenal
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API berjalan di http://localhost:${PORT}`);
  startBoothWatcher();
  // Dorong foto hasil impor ke backend VPS (shares.kira2memories.web.id).
  startVpsSync();
  // QR self-host ditampilkan di layar dslrBooth (menggantikan QR cloud).
  startScreenWatcher(async () => {
    const id = boothEventId();
    if (!id) return null;
    return galleryBaseUrl(id);
  });
  // Tulis ulang link share dslrBooth (FileItems.UploadUrl) -> galeri event asalnya.
  startShareRewriter(() => ({
    resolveEventId: (name) => resolveEventId(name) || currentEventId(),
    baseUrl: (eventId) => galleryBaseUrl(eventId),
  }), 800);
});
