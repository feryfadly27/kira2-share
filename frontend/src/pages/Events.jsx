import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Events() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');

  function load() {
    api('/event/all?page=1')
      .then((r) => { setRows(r.data); setTotal(r.total); })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, []);

  async function remove(id) {
    if (!confirm('Hapus event ini?')) return;
    await api(`/event/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <header className="page-head">
        <h1>Semua Event <span className="muted">({total})</span></h1>
        <Link to="/event/create" className="btn btn-primary">+ Buat Event</Link>
      </header>

      {err && <div className="error">{err}</div>}

      <section className="card">
        {rows.length === 0 ? (
          <p className="muted">Belum ada event.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Nama</th><th>App</th><th>Status</th><th>Experiences</th><th>Shares</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/admin/event/${e.id}`} className="link">{e.name}</Link></td>
                  <td><span className="pill">{e.app}</span></td>
                  <td><span className={'pill pill-' + e.status}>{e.status}</span></td>
                  <td>{e.experiences}</td>
                  <td>{e.shares}</td>
                  <td className="row-actions">
                    <Link to={`/admin/analytics/${e.id}`} className="link">Analytics</Link>
                    <button className="link link-danger" onClick={() => remove(e.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
