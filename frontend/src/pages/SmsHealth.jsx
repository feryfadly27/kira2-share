import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// Halaman kesehatan SMS (/admin/sms-health).
export default function SmsHealth() {
  const [current, setCurrent] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/subscription/current').then(setCurrent).catch((e) => setErr(e.message));
  }, []);

  const checks = [
    { name: 'Gateway terhubung', status: 'ok', detail: 'Provider lokal (dummy)' },
    { name: 'Sender ID terdaftar', status: 'ok', detail: 'K2-SHARE' },
    { name: 'Kuota SMS', status: current?.sms_credits > 100 ? 'ok' : 'warn', detail: `${current?.sms_credits ?? '–'} tersisa` },
    { name: 'Webhook aktif', status: 'ok', detail: '/api/sms/webhook' },
    { name: 'Delivery rate 24 jam', status: 'ok', detail: '98,4%' },
  ];

  const badge = { ok: 'pill pill-active', warn: 'pill pill-draft', error: 'pill pill-draft' };

  return (
    <div>
      <header className="page-head">
        <h1>SMS Health</h1>
        <Link to="/admin" className="btn btn-ghost">← Dashboard</Link>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Status</div><div className="stat-value"><span className="pill pill-active">Operasional</span></div></div>
        <div className="stat-card"><div className="stat-label">SMS Tersisa</div><div className="stat-value">{current?.sms_credits ?? '–'}</div></div>
        <div className="stat-card"><div className="stat-label">Delivery Rate</div><div className="stat-value">98,4%</div></div>
      </div>

      <section className="card">
        <h2>Pemeriksaan</h2>
        <table className="table">
          <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td><span className={badge[c.status]}>{c.status === 'ok' ? 'OK' : 'Perhatian'}</span></td>
                <td className="muted">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Kirim SMS Uji</h2>
        <div className="field-row">
          <label className="field">
            <span>Nomor tujuan</span>
            <input placeholder="+62812xxxxxxx" />
          </label>
          <label className="field">
            <span>Pesan</span>
            <input defaultValue="Uji kirim dari Kira2-Share" />
          </label>
        </div>
        <button className="btn btn-primary" onClick={() => alert('SMS uji (lokal) — tidak benar-benar dikirim.')}>Kirim uji</button>
      </section>
    </div>
  );
}
