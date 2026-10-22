import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Upload foto ke backend lokal (multipart) + gallery + link share publik.
export default function PhotoUpload({ eventId }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  function load() {
    api(`/event/${eventId}/photos`).then(setPhotos).catch((e) => setErr(e.message));
  }
  useEffect(load, [eventId]);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const token = localStorage.getItem('replica_token');
        const res = await fetch(`/api/event/${eventId}/photos`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
      }
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id) {
    if (!confirm('Hapus foto ini?')) return;
    await api(`/event/${eventId}/photos/${id}`, { method: 'DELETE' });
    load();
  }

  function shareUrl(id) {
    return `${window.location.origin}/shares/${id}`;
  }

  async function copy(id) {
    try { await navigator.clipboard.writeText(shareUrl(id)); alert('Link share disalin!'); }
    catch { prompt('Salin link ini:', shareUrl(id)); }
  }

  return (
    <div>
      <div className="card-head">
        <h2>Foto / Share</h2>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {busy ? 'Mengunggah…' : '⬆ Upload foto'}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} disabled={busy} />
        </label>
      </div>

      {err && <div className="error">{err}</div>}

      {photos.length === 0 ? (
        <p className="muted">Belum ada foto. Upload yang pertama!</p>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="photo-card">
              <img src={p.url} alt={p.filename} loading="lazy" />
              <div className="photo-actions">
                <button className="link" onClick={() => copy(p.id)}>Bagikan</button>
                <a className="link" href={shareUrl(p.id)} target="_blank" rel="noreferrer">Buka</a>
                <button className="link link-danger" onClick={() => remove(p.id)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="muted">Foto disimpan di folder <code>backend/uploads</code> (pengganti Backblaze B2).</p>
    </div>
  );
}
