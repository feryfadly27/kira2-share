export default function Placeholder({ title }) {
  return (
    <div>
      <header className="page-head"><h1>{title}</h1></header>
      <section className="card">
        <p className="muted">
          Halaman <strong>{title}</strong> adalah route dari blueprint asli yang belum diisi.
        </p>
        <p className="muted">
          Rute ini sudah terpetakan di <code>src/App.jsx</code> — tinggal ganti komponen ini dengan
          implementasi fiturnya.
        </p>
      </section>
    </div>
  );
}
