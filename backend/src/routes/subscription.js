import { Router } from 'express';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

// Data plan contoh untuk dua produk (mirip langganan asli).
const CATALOG = {
  lumabooth: {
    app: 'lumabooth',
    name: 'LumaBooth',
    plans: [
      { id: 'free',   name: 'Free',   price: 0,   events: 1,  ai_credits: 0,   sms: 0 },
      { id: 'pro',    name: 'Pro',    price: 19,  events: 20, ai_credits: 100, sms: 500 },
      { id: 'business', name: 'Business', price: 49, events: 100, ai_credits: 500, sms: 2000 },
    ],
  },
  dslrbooth: {
    app: 'dslrbooth',
    name: 'DSLRBooth',
    plans: [
      { id: 'free', name: 'Free', price: 0, events: 1, ai_credits: 0, sms: 0 },
      { id: 'pro',  name: 'Pro',  price: 15, events: 15, ai_credits: 100, sms: 500 },
    ],
  },
};

// GET /api/subscription/catalog
r.get('/catalog', (req, res) => res.json(CATALOG));

// GET /api/subscription/current
r.get('/current', (req, res) => {
  res.json({ plan: 'pro', ai_credits: 120, sms_credits: 500, renews_at: '2026-11-22' });
});

// POST /api/subscription/checkout (dummy)
r.post('/checkout', (req, res) => {
  const { app, plan } = req.body || {};
  res.json({ ok: true, app, plan, message: 'Checkout lokal (belum terhubung Stripe).' });
});

export default r;
