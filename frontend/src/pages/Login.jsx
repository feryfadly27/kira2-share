import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login({ mode }) {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const forgot = mode === 'forgot';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (forgot) {
        alert('Fitur reset password belum diimplementasikan di replika ini.');
        return;
      }
      if (isRegister) await register(email, password, name);
      else await login(email, password);
      nav(loc.state?.from?.pathname || '/admin', { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <span className="brand-logo"></span>
          <span>Kira2<em>-Share</em></span>
        </div>
        <h1>{forgot ? 'Lupa password' : isRegister ? 'Buat akun' : 'Masuk ke Dashboard'}</h1>

        {isRegister && !forgot && (
          <label className="field">
            <span>Nama</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required />
        </label>
        {!forgot && (
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>
        )}

        {err && <div className="error">{err}</div>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Memproses…' : forgot ? 'Kirim reset' : isRegister ? 'Daftar' : 'Masuk'}
        </button>

        {!forgot && (
          <div className="login-alt">
            {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            <button type="button" className="link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Masuk' : 'Daftar'}
            </button>
          </div>
        )}
        <div className="demo-hint">Demo: demo@local / demo1234 (jalankan <code>npm run seed</code> di backend)</div>
      </form>
    </div>
  );
}
