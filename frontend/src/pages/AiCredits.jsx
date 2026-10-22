import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

// Halaman AI Credits (/admin/subscriptions/ai-credits).
export default function AiCredits() {
  const [current, setCurrent] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/subscription/current').then(setCurrent).catch((e) => setErr(e.message));
  }, []);

  // Pemakaian contoh per minggu
  const usage = [
    { day: 'Sen', used: 12 }, { day: 'Sel', used: 19 }, { day: 'Rab', used: 7 },
    { day: 'Kam', used: 24 }, { day: 'Jum', used: 15 }, { day: 'Sab', used: 31 },
    { day: 'Min', used: 9 },
  ];
  const totalUsed = usage.reduce((a, b) => a + b.used, 0);
  const remaining = current ? current.ai_credits : null;

  return (
    <div>
      <header className="page-head">
        <h1>AI Credits</h1>
        <Link to="/admin/subscriptions" className="btn btn-ghost">← Langganan</Link>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Sisa Credits</div><div className="stat-value">{remaining ?? '–'}</div></div>
        <div className="stat-card"><div className="stat-label">Dipakai (7 hari)</div><div className="stat-value">{totalUsed}</div></div>
        <div className="stat-card"><div className="stat-label">Plan</div><div className="stat-value">{current?.plan ?? '–'}</div></div>
      </div>

      <section className="card">
        <h2>Pemakaian Mingguan</h2>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={usage} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#16130F" strokeOpacity={0.14} strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6B6357" tickLine={false} />
              <YAxis stroke="#6B6357" allowDecimals={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(22,19,15,.06)' }}
                contentStyle={{
                  background: '#FFFFFF',
                  border: '2px solid #16130F',
                  borderRadius: 0,
                  boxShadow: '3px 3px 0 #16130F',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="used" fill="#FF3B00" stroke="#16130F" strokeWidth={2} radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>Tambah Credits</h2>
        <p className="muted">Isi ulang AI credits untuk fitur (mis. auto-caption, background removal).</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => alert('Top-up lokal — belum terhubung pembayaran.')}>+ 100 credits</button>
          <button className="btn btn-ghost" onClick={() => alert('Top-up lokal — belum terhubung pembayaran.')}>+ 500 credits</button>
        </div>
      </section>
    </div>
  );
}
