import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';

const r = Router();

// POST /api/user/register
r.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  try {
    const hash = hashPassword(password);
    const info = db
      .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run(email, hash, name || '');
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(info.lastInsertRowid);
    return res.json({ token: signToken(user), user });
  } catch {
    return res.status(400).json({ error: 'email already exists' });
  }
});

// POST /api/user/login
r.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  return res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
  });
});

// GET /api/user/me
r.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, name, plan, ai_credits, sms_credits, created_at FROM users WHERE id = ?')
    .get(req.user.sub);
  res.json(user);
});

// PUT /api/user/update
r.put('/update', requireAuth, (req, res) => {
  const { name, plan } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE users SET name = ?, plan = ? WHERE id = ?').run(
    name ?? user.name,
    plan ?? user.plan,
    user.id
  );
  res.json(db.prepare('SELECT id, email, name, plan FROM users WHERE id = ?').get(user.id));
});

// GET /api/user/stats  (asli membalas 404 — di sini kita sediakan agar dashboard punya data)
r.get('/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) c FROM events WHERE user_id = ?').get(req.user.sub).c;
  const active = db
    .prepare("SELECT COUNT(*) c FROM events WHERE user_id = ? AND status = 'active'")
    .get(req.user.sub).c;
  const user = db.prepare('SELECT plan, ai_credits, sms_credits FROM users WHERE id = ?').get(req.user.sub);
  res.json({ events: total, active, ...user });
});

export default r;
