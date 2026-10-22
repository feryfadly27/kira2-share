import { Link } from 'react-router-dom';

const plans = [
  { app: 'lumabooth', name: 'Kira2-Share', color: '#FF3B00' },
  { app: 'dslrbooth', name: 'DSLRBooth', color: '#1F9D55' },
];

export default function Subscriptions() {
  return (
    <div>
      <header className="page-head"><h1>Langganan</h1></header>
      <div className="plan-grid">
        {plans.map((p) => (
          <div key={p.app} className="plan-card" style={{ borderColor: p.color }}>
            <div className="plan-name" style={{ color: p.color }}>{p.name}</div>
            <p className="muted">Pilih plan & kelola langganan {p.name}.</p>
            <div className="btn-row">
              <Link to={`/admin/subscriptions/${p.app}/manage`} className="btn btn-primary">Kelola</Link>
              <Link to={`/admin/subscriptions/${p.app}/learn-more`} className="btn btn-ghost">Pelajari</Link>
            </div>
          </div>
        ))}
      </div>
      <section className="card">
        <h2>Tambahan</h2>
        <div className="btn-row">
          <Link to="/admin/subscriptions/ai-credits" className="btn btn-ghost">AI Credits</Link>
          <Link to="/subscription/redeem-voucher" className="btn btn-ghost">Redeem Voucher</Link>
        </div>
      </section>
    </div>
  );
}
