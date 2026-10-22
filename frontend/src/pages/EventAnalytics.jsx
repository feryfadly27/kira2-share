import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

export default function EventAnalytics() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/event/${eventId}/analytics`).then(setData).catch((e) => setErr(e.message));
  }, [eventId]);

  if (err) return <div className="error">{err}</div>;
  if (!data) return <div className="center">Memuat…</div>;

  return (
    <div>
      <header className="page-head">
        <h1>Analytics — {data.name}</h1>
        <Link to={`/admin/event/${data.event_id}`} className="btn btn-ghost">← Kembali ke Event</Link>
      </header>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Views (7 hari)</div><div className="stat-value">{data.views}</div></div>
        <div className="stat-card"><div className="stat-label">Shares</div><div className="stat-value">{data.shares}</div></div>
        <div className="stat-card"><div className="stat-label">Event ID</div><div className="stat-value">{data.event_id}</div></div>
      </div>

      <section className="card">
        <h2>Tren Views</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF3B00" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF3B00" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#16130F" strokeOpacity={0.14} strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6B6357" tickLine={false} tickFormatter={(d) => `H${d}`} />
              <YAxis stroke="#6B6357" allowDecimals={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: '#16130F', strokeWidth: 2 }}
                contentStyle={{
                  background: '#FFFFFF',
                  border: '2px solid #16130F',
                  borderRadius: 0,
                  boxShadow: '3px 3px 0 #16130F',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="views" stroke="#FF3B00" strokeWidth={2} fill="url(#views)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="muted">Menggunakan Recharts — sama seperti library chart pada aplikasi asli.</p>
      </section>
    </div>
  );
}
