import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

// GET /api/event/all?page=1
r.get('/all', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const per = 20;
  const rows = db
    .prepare('SELECT * FROM events WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(req.user.sub, per, (page - 1) * per);
  const total = db.prepare('SELECT COUNT(*) c FROM events WHERE user_id = ?').get(req.user.sub).c;
  res.json({ page, per, total, data: rows });
});

// POST /api/event/create
r.post('/create', (req, res) => {
  const { name, app } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db
    .prepare('INSERT INTO events (user_id, name, app, status) VALUES (?, ?, ?, ?)')
    .run(req.user.sub, name, app || 'lumabooth', 'active');
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.json(ev);
});

// GET /api/event/:id
r.get('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!ev) return res.status(404).json({ error: 'not found' });
  res.json(ev);
});

// PUT /api/event/:id
r.put('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!ev) return res.status(404).json({ error: 'not found' });
  const { name, status } = req.body || {};
  db.prepare('UPDATE events SET name = ?, status = ? WHERE id = ?').run(name ?? ev.name, status ?? ev.status, ev.id);
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id));
});

// DELETE /api/event/:id
r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  res.json({ deleted: true });
});

// GET /api/event/:id/analytics
r.get('/:id/analytics', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!ev) return res.status(404).json({ error: 'not found' });
  // Data contoh untuk chart — ganti dengan data asli bila perlu.
  const trend = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, views: Math.floor(Math.random() * 100) }));
  res.json({ event_id: ev.id, name: ev.name, views: trend.reduce((a, b) => a + b.views, 0), shares: ev.shares, trend });
});

export default r;
