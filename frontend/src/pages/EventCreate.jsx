import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function EventCreate() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [app, setApp] = useState('lumabooth');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const ev = await api('/event/create', { method: 'POST', body: { name, app } });
      nav(`/admin/event/${ev.id}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-head"><h1>Buat Event</h1></header>
      <section className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submit}>
          <label className="field">
            <span>Nama Event</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Wedding Andi & Sari" required />
          </label>
          <label className="field">
            <span>Aplikasi</span>
            <select value={app} onChange={(e) => setApp(e.target.value)}>
              <option value="lumabooth">Kira2-Share</option>
              <option value="dslrbooth">DSLRBooth</option>
            </select>
          </label>
          {err && <div className="error">{err}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat Event'}</button>
        </form>
      </section>
    </div>
  );
}
