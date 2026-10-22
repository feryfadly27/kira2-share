import { Router } from 'express';
import { db } from '../db.js';

const r = Router();

// GET /api/share/:photoId — tampilan publik share (tanpa login)
r.get('/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'share not found' });
  const ev = db.prepare('SELECT id, name, app FROM events WHERE id = ?').get(photo.event_id);
  res.json({ ...photo, event: ev });
});

// GET /api/event/:id/shares — daftar share publik suatu event (ringkas)
r.get('/event/:id', (req, res) => {
  const ev = db.prepare('SELECT id, name, app FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'event not found' });
  const rows = db.prepare('SELECT id, url, created_at FROM photos WHERE event_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ event: ev, shares: rows });
});

export default r;
