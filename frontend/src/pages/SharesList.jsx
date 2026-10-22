import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

// Daftar share publik suatu event (admin).
export default function SharesList() {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/event/${eventId}/photos`)
      .then((rows) => setData({ shares: rows }))
      .catch((e) => setErr(e.message));
  }, [eventId]);

  if (err) return <div className="error">{err}</div>;
  if (!data) return <div className="center">Memuat…</div>;

  return (
    <div>
      <header className="page-head">
        <h1>Shares — Event #{eventId}</h1>
        <div className="btn-row">
          <Link to={`/admin/event/${eventId}`} className="btn btn-ghost">← Event</Link>
          <Link to={`/event/${eventId}/shares`} className="btn btn-ghost" hidden />
        </div>
      </header>

      {data.shares.length === 0 ? (
        <section className="card"><p className="muted">Belum ada share di event ini.</p></section>
      ) : (
        <div className="photo-grid">
          {data.shares.map((p) => {
            const isVideo = /\.(mp4|mov|webm)$/i.test(p.filename || '');
            return (
              <div key={p.id} className="photo-card">
                {isVideo ? (
                  <video src={p.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={p.url} alt={p.filename} loading="lazy" />
                )}
                <div className="photo-actions">
                  <a className="link" href={`/shares/${p.id}`} target="_blank" rel="noreferrer">Lihat</a>
                  <button
                    className="link"
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/shares/${p.id}`).then(() => alert('Link disalin!'))}
                  >
                    Salin link
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
