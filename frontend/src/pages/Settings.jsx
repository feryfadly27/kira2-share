import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    // Simpan lokal dulu — endpoint update profil bisa ditambahkan di backend.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <header className="page-head"><h1>Pengaturan</h1></header>
      <section className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={save}>
          <label className="field">
            <span>Nama tampilan</span>
            <input defaultValue={user?.name || ''} placeholder="Nama Anda" />
          </label>
          <label className="field">
            <span>Bahasa</span>
            <select defaultValue="id">
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </label>
          <button className="btn btn-primary">Simpan</button>
          {saved && <span className="saved">Tersimpan ✓</span>}
        </form>
      </section>
    </div>
  );
}
