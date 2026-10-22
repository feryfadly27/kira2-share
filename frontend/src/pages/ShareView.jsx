import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

// Halaman share PUBLIK — tanpa login, meniru /shares/:id asli.
export default function ShareView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d);
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="center error" style={{ margin: 40 }}>{err}</div>;
  if (!data) return <div className="center">Memuat…</div>;

  return (
    <div className="share-wrap">
      <div className="share-card">
        <div className="share-brand">
          <span className="brand-logo"></span> Kira2<em>-Share</em>
        </div>
        {data.event && (
          <div className="share-event">
            <Link to={`/admin/event/${data.event.id}`} className="link">
              {data.event.name}
            </Link>
            <span className="pill">{data.event.app}</span>
          </div>
        )}
        <img className="share-img" src={data.url} alt={data.filename} />
        <div className="share-meta">Dibagikan {data.created_at}</div>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <a className="btn btn-primary" href={data.url} download>⬇ Unduh</a>
          <button
            className="btn btn-ghost"
            onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => alert('Link disalin!'))}
          >
            Bagikan
          </button>
        </div>
      </div>
    </div>
  );
}
