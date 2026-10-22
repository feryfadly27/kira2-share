import 'dotenv/config';
import { db } from './db.js';
import { hashPassword } from './auth.js';

// User demo: demo@local / demo1234
const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@local');
let userId;
if (exists) {
  userId = exists.id;
  console.log('User demo sudah ada:', 'demo@local');
} else {
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, plan, ai_credits, sms_credits) VALUES (?, ?, ?, ?, ?, ?)')
    .run('demo@local', hashPassword('demo1234'), 'Demo User', 'pro', 120, 500);
  userId = info.lastInsertRowid;
  console.log('User demo dibuat:', 'demo@local / demo1234');
}

// Beberapa event contoh
const count = db.prepare('SELECT COUNT(*) c FROM events WHERE user_id = ?').get(userId).c;
if (count === 0) {
  const insert = db.prepare('INSERT INTO events (user_id, name, app, status, shares, experiences) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run(userId, 'Wedding Andi & Sari', 'lumabooth', 'active', 128, 3);
  insert.run(userId, 'Birthday Keira', 'dslrbooth', 'active', 42, 2);
  insert.run(userId, 'Company Gathering PT Maju', 'lumabooth', 'draft', 0, 1);
  console.log('3 event contoh dibuat.');
}

console.log('Seed selesai.');
