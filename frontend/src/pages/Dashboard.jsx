import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/user/stats').then(setStats).catch((e) => setErr(e.message));
    api('/event/all?page=1').then((r) => setEvents(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <header className="page-head">
        <h1>Dashboard</h1>
        <Link to="/event/create" className="btn btn-primary">+ Buat Event</Link>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="stat-grid">
        <StatCard label="Total Event" value={stats?.events ?? '–'} />
        <StatCard label="Event Aktif" value={stats?.active ?? '–'} />
        <StatCard label="Plan" value={stats?.plan ?? '–'} />
        <StatCard label="AI Credits" value={stats?.ai_credits ?? '–'} />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Event Terbaru</h2>
          <Link to="/event/all" className="link">Lihat semua</Link>
        </div>
        {events.length === 0 ? (
          <p className="muted">Belum ada event. Buat yang pertama!</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Nama</th><th>App</th><th>Status</th><th>Shares</th></tr>
            </thead>
            <tbody>
              {events.slice(0, 5).map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/admin/event/${e.id}`} className="link">{e.name}</Link></td>
                  <td><span className="pill">{e.app}</span></td>
                  <td><span className={'pill pill-' + e.status}>{e.status}</span></td>
                  <td>{e.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
