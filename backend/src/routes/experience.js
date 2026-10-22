import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

// Pastikan event milik user
function ownedEvent(req, res) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!ev) { res.status(404).json({ error: 'event not found' }); return null; }
  return ev;
}

// GET /api/event/:id/experiences
r.get('/:id/experiences', (req, res) => {
  if (!ownedEvent(req, res)) return;
  const rows = db.prepare('SELECT * FROM experiences WHERE event_id = ? ORDER BY id').all(req.params.id);
  res.json(rows);
});

// POST /api/event/:id/experiences
r.post('/:id/experiences', (req, res) => {
  if (!ownedEvent(req, res)) return;
  const { name, type, overlay } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db
    .prepare('INSERT INTO experiences (event_id, name, type, overlay) VALUES (?, ?, ?, ?)')
    .run(req.params.id, name, type || 'photo', JSON.stringify(overlay || {}));
  res.json(db.prepare('SELECT * FROM experiences WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/event/:id/experiences/:expId
r.put('/:id/experiences/:expId', (req, res) => {
  if (!ownedEvent(req, res)) return;
  const exp = db.prepare('SELECT * FROM experiences WHERE id = ? AND event_id = ?').get(req.params.expId, req.params.id);
  if (!exp) return res.status(404).json({ error: 'experience not found' });
  const { name, type, overlay } = req.body || {};
  db.prepare('UPDATE experiences SET name = ?, type = ?, overlay = ? WHERE id = ?').run(
    name ?? exp.name,
    type ?? exp.type,
    overlay !== undefined ? JSON.stringify(overlay) : exp.overlay,
    exp.id
  );
  res.json(db.prepare('SELECT * FROM experiences WHERE id = ?').get(exp.id));
});

// DELETE /api/event/:id/experiences/:expId
r.delete('/:id/experiences/:expId', (req, res) => {
  if (!ownedEvent(req, res)) return;
  db.prepare('DELETE FROM experiences WHERE id = ? AND event_id = ?').run(req.params.expId, req.params.id);
  res.json({ deleted: true });
});

export default r;
