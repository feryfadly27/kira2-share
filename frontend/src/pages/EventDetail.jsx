import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import PhotoUpload from '../components/PhotoUpload.jsx';

export default function EventDetail() {
  const { eventId } = useParams();
  const [ev, setEv] = useState(null);
  const [exps, setExps] = useState([]);
  const [tab, setTab] = useState('detail');
  const [err, setErr] = useState('');

  function load() {
    api(`/event/${eventId}`).then(setEv).catch((e) => setErr(e.message));
    api(`/event/${eventId}/experiences`).then(setExps).catch(() => setExps([]));
  }
  useEffect(load, [eventId]);

  async function toggleStatus() {
    const status = ev.status === 'active' ? 'draft' : 'active';
    await api(`/event/${ev.id}`, { method: 'PUT', body: { status } });
    load();
  }

  async function addExp() {
    const name = prompt('Nama experience baru:', 'Photo Booth');
    if (!name) return;
    await api(`/event/${eventId}/experiences`, { method: 'POST', body: { name, type: 'photo' } });
    load();
  }

  if (err) return <div className="error">{err}</div>;
  if (!ev) return <div className="center">Memuat…</div>;

  const tabs = [
    ['detail', 'Detail'],
    ['experiences', `Experiences (${exps.length})`],
    ['photos', 'Photos'],
  ];

  return (
    <div>
      <header className="page-head">
        <h1>{ev.name}</h1>
        <div className="btn-row">
          <Link to={`/admin/analytics/${ev.id}`} className="btn btn-ghost">Analytics</Link>
          <Link to={`/admin/shares/${ev.id}`} className="btn btn-ghost">Shares</Link>
          <button className="btn btn-ghost" onClick={toggleStatus}>
            {ev.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Status</div><div className="stat-value"><span className={'pill pill-' + ev.status}>{ev.status}</span></div></div>
        <div className="stat-card"><div className="stat-label">App</div><div className="stat-value">{ev.app}</div></div>
        <div className="stat-card"><div className="stat-label">Experiences</div><div className="stat-value">{ev.experiences}</div></div>
        <div className="stat-card"><div className="stat-label">Shares</div><div className="stat-value">{ev.shares}</div></div>
      </div>

      <div className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'detail' && (
        <section className="card">
          <h2>Detail</h2>
          <dl className="dl">
            <div><dt>ID</dt><dd>{ev.id}</dd></div>
            <div><dt>Dibuat</dt><dd>{ev.created_at}</dd></div>
            <div><dt>App</dt><dd>{ev.app}</dd></div>
            <div><dt>Status</dt><dd>{ev.status}</dd></div>
          </dl>
        </section>
      )}

      {tab === 'experiences' && (
        <section className="card">
          <div className="card-head">
            <h2>Experiences</h2>
            <button className="btn btn-primary" onClick={addExp}>+ Experience</button>
          </div>
          {exps.length === 0 ? (
            <p className="muted">Belum ada experience di event ini.</p>
          ) : (
            <div className="exp-list">
              {exps.map((e) => (
                <Link key={e.id} to={`/event/${ev.id}/settings/experiences/${e.id}`} className="exp-item">
                  <strong>{e.name}</strong>
                  <span className="pill">{e.type}</span>
                </Link>
              ))}
            </div>
          )}
          <p className="muted">Klik experience untuk membuka editor overlay (Konva).</p>
        </section>
      )}

      {tab === 'photos' && (
        <section className="card">
          <PhotoUpload eventId={ev.id} />
        </section>
      )}
    </div>
  );
}
