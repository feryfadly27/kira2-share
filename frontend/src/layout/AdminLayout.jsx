import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const nav = [
  {
    group: 'Beranda',
    items: [
      { to: '/admin', label: 'Dashboard', end: true },
      { to: '/admin/homepage', label: 'Homepage' },
    ],
  },
  {
    group: 'Event',
    items: [
      { to: '/event/all', label: 'Semua Event' },
      { to: '/event/create', label: '+ Buat Event' },
      { to: '/booth', label: 'Booth QR', external: true },
    ],
  },
  {
    group: 'Langganan',
    items: [
      { to: '/admin/subscriptions', label: 'Langganan' },
      { to: '/admin/subscriptions/ai-credits', label: 'AI Credits' },
    ],
  },
  {
    group: 'Akun',
    items: [
      { to: '/admin/account', label: 'Akun' },
      { to: '/admin/settings', label: 'Pengaturan' },
      { to: '/admin/sms-health', label: 'SMS Health' },
      { to: '/admin/refer-earn', label: 'Refer & Earn' },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();

  function handleLogout() {
    logout();
    nav2('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo"></span>
          <span>Kira2<em>-Share</em></span>
        </div>
        <nav>
          {nav.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-group-title">{g.group}</div>
              {g.items.map((it) =>
                it.external ? (
                  <a key={it.to} href={it.to} target="_blank" rel="noopener" className="nav-link">
                    {it.label}
                  </a>
                ) : (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                  >
                    {it.label}
                  </NavLink>
                )
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip" title={user?.email}>{user?.name || user?.email}</div>
          <button className="btn btn-ghost" onClick={handleLogout}>Keluar</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
