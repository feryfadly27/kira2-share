import { Router } from 'express';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadDir = join(__dirname, '..', '..', 'uploads');
mkdirSync(uploadDir, { recursive: true });

// Simpan file ke folder lokal (pengganti Backblaze B2).
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, safe + (extname(file.originalname) || '.png'));
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const r = Router();

function ownedEvent(req, res) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!ev) { res.status(404).json({ error: 'event not found' }); return null; }
  return ev;
}

// POST /api/event/:id/photos  (multipart field: "file")
r.post('/:id/photos', requireAuth, upload.single('file'), (req, res) => {
  if (!ownedEvent(req, res)) return;
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = `/uploads/${req.file.filename}`;
  const info = db
    .prepare('INSERT INTO photos (event_id, filename, url) VALUES (?, ?, ?)')
    .run(req.params.id, req.file.filename, url);
  db.prepare('UPDATE events SET shares = shares + 1 WHERE id = ?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid));
});

// GET /api/event/:id/photos
r.get('/:id/photos', requireAuth, (req, res) => {
  if (!ownedEvent(req, res)) return;
  const rows = db.prepare('SELECT * FROM photos WHERE event_id = ? ORDER BY id DESC').all(req.params.id);
  res.json(rows);
});

// DELETE /api/event/:id/photos/:photoId
r.delete('/:id/photos/:photoId', requireAuth, (req, res) => {
  if (!ownedEvent(req, res)) return;
  db.prepare('DELETE FROM photos WHERE id = ? AND event_id = ?').run(req.params.photoId, req.params.id);
  res.json({ deleted: true });
});

export default r;
