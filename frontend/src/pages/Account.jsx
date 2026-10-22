import { useAuth } from '../auth.jsx';

export default function Account() {
  const { user } = useAuth();

  return (
    <div>
      <header className="page-head"><h1>Akun</h1></header>
      <section className="card" style={{ maxWidth: 520 }}>
        <dl className="dl">
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
          <div><dt>Nama</dt><dd>{user?.name || '—'}</dd></div>
          <div><dt>Plan</dt><dd>{user?.plan || 'free'}</dd></div>
          <div><dt>User ID</dt><dd>{user?.id}</dd></div>
        </dl>
        <p className="muted">Halaman edit profil & ganti password bisa ditambahkan di backend <code>/api/user/update</code>.</p>
      </section>
    </div>
  );
}
