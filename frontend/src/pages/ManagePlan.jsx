import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

// Kelola plan langganan per aplikasi (/admin/subscriptions/:appName/manage).
export default function ManagePlan() {
  const { appName } = useParams();
  const [catalog, setCatalog] = useState(null);
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/subscription/catalog').then(setCatalog).catch((e) => setErr(e.message));
    api('/subscription/current').then(setCurrent).catch(() => {});
  }, []);

  async function checkout(plan) {
    setMsg('');
    try {
      const r = await api('/subscription/checkout', { method: 'POST', body: { app: appName, plan: plan.id } });
      setMsg(r.message || 'Checkout diproses.');
    } catch (e) {
      setErr(e.message);
    }
  }

  const app = catalog?.[appName];

  return (
    <div>
      <header className="page-head">
        <h1>Kelola Plan — {app?.name || appName}</h1>
        <Link to="/admin/subscriptions" className="btn btn-ghost">← Langganan</Link>
      </header>

      {err && <div className="error">{err}</div>}
      {msg && <div className="saved" style={{ display: 'block', marginBottom: 10 }}>{msg}</div>}

      {current && (
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Plan Aktif</div><div className="stat-value">{current.plan}</div></div>
          <div className="stat-card"><div className="stat-label">AI Credits</div><div className="stat-value">{current.ai_credits}</div></div>
          <div className="stat-card"><div className="stat-label">SMS Credits</div><div className="stat-value">{current.sms_credits}</div></div>
          <div className="stat-card"><div className="stat-label">Renews</div><div className="stat-value" style={{ fontSize: 16 }}>{current.renews_at}</div></div>
        </div>
      )}

      {!app ? (
        <section className="card"><p className="muted">Memuat katalog…</p></section>
      ) : (
        <div className="plan-grid">
          {app.plans.map((p) => (
            <div key={p.id} className={'plan-card' + (current?.plan === p.id ? ' current' : '')}>
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">{p.price === 0 ? 'Gratis' : `$${p.price}/bln`}</div>
              <ul className="plan-feats">
                <li>{p.events} event</li>
                <li>{p.ai_credits} AI credits</li>
                <li>{p.sms} SMS</li>
              </ul>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => checkout(p)}
                disabled={current?.plan === p.id}
              >
                {current?.plan === p.id ? 'Plan aktif ✓' : 'Pilih plan'}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="muted">Checkout lokal — belum terhubung Stripe.</p>
    </div>
  );
}
