import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Stage, Layer, Rect, Text, Circle } from 'react-konva';

const TYPES = ['photo', 'boomerang', 'gif', 'video'];

// Halaman pengaturan experience: CRUD + editor overlay (Konva).
export default function ExperienceSettings() {
  const { eventid, experienceKey } = useParams();
  const [exps, setExps] = useState([]);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const overlay = useMemo(() => {
    try { return { text: 'Kira2-Share', size: 40, color: '#16130F', bg: '#FF3B00', ...(sel?.overlay ? JSON.parse(sel.overlay) : {}) }; }
    catch { return { text: 'Kira2-Share', size: 40, color: '#16130F', bg: '#FF3B00' }; }
  }, [sel]);

  function load() {
    api(`/event/${eventid}/experiences`)
      .then((list) => {
        setExps(list);
        const key = experienceKey;
        const found =
          list.find((e) => String(e.id) === String(key)) ||
          list.find((e) => e.type === key) ||
          list[0] ||
          null;
        setSel(found);
      })
      .catch((e) => setErr(e.message));
  }
  useEffect(load, [eventid, experienceKey]);

  function updateOverlay(patch) {
    setSel((s) => ({ ...s, overlay: JSON.stringify({ ...overlay, ...patch }) }));
  }

  async function save() {
    if (!sel) return;
    const body = { name: sel.name, type: sel.type, overlay: JSON.parse(sel.overlay || '{}') };
    await api(`/event/${eventid}/experiences/${sel.id}`, { method: 'PUT', body });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    load();
  }

  async function addExperience() {
    const name = prompt('Nama experience baru:', 'Experience baru');
    if (!name) return;
    const created = await api(`/event/${eventid}/experiences`, { method: 'POST', body: { name, type: 'photo' } });
    load();
    setTimeout(() => setSel(created), 0);
  }

  async function removeExp() {
    if (!sel || !confirm(`Hapus experience "${sel.name}"?`)) return;
    await api(`/event/${eventid}/experiences/${sel.id}`, { method: 'DELETE' });
    setSel(null);
    load();
  }

  return (
    <div>
      <header className="page-head">
        <h1>Experience Settings</h1>
        <div className="btn-row">
          <Link to={`/admin/event/${eventid}`} className="btn btn-ghost">← Event</Link>
          <button className="btn btn-primary" onClick={addExperience}>+ Experience</button>
        </div>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="exp-layout">
        {/* Daftar experience */}
        <aside className="card exp-list">
          <h2>Daftar</h2>
          {exps.length === 0 && <p className="muted">Belum ada experience.</p>}
          {exps.map((e) => (
            <button
              key={e.id}
              className={'exp-item' + (sel?.id === e.id ? ' active' : '')}
              onClick={() => setSel(e)}
            >
              <strong>{e.name}</strong>
              <span className="pill">{e.type}</span>
            </button>
          ))}
        </aside>

        {/* Editor */}
        <section className="card">
          {!sel ? (
            <p className="muted">Pilih atau buat experience.</p>
          ) : (
            <>
              <div className="field-row">
                <label className="field">
                  <span>Nama</span>
                  <input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Tipe</span>
                  <select value={sel.type} onChange={(e) => setSel({ ...sel, type: e.target.value })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              <h2>Overlay (Editor Canvas)</h2>
              <div className="field-row">
                <label className="field">
                  <span>Teks</span>
                  <input value={overlay.text} onChange={(e) => updateOverlay({ text: e.target.value })} />
                </label>
                <label className="field">
                  <span>Ukuran font</span>
                  <input type="number" min="12" max="96" value={overlay.size} onChange={(e) => updateOverlay({ size: +e.target.value })} />
                </label>
                <label className="field">
                  <span>Warna teks</span>
                  <input type="color" value={overlay.color} onChange={(e) => updateOverlay({ color: e.target.value })} />
                </label>
                <label className="field">
                  <span>Warna latar</span>
                  <input type="color" value={overlay.bg} onChange={(e) => updateOverlay({ bg: e.target.value })} />
                </label>
              </div>

              {/* Preview Konva */}
              <div className="konva-wrap">
                <Stage width={360} height={270}>
                  <Layer>
                    <Rect x={0} y={0} width={360} height={270} fill="#F2EFE8" />
                    <Rect x={30} y={40} width={300} height={190} fill={overlay.bg} cornerRadius={0} opacity={0.95} />
                    <Rect x={30} y={40} width={300} height={190} stroke="#16130F" strokeWidth={3} cornerRadius={0} />
                    <Circle x={180} y={110} radius={34} fill="#FFD400" stroke="#16130F" strokeWidth={3} />
                    <Text
                      x={0}
                      y={245}
                      width={360}
                      align="center"
                      text={overlay.text}
                      fontSize={overlay.size}
                      fill={overlay.color}
                      fontStyle="bold"
                    />
                  </Layer>
                </Stage>
              </div>

              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={save}>Simpan</button>
                <button className="btn btn-ghost" onClick={removeExp}>Hapus experience</button>
                {saved && <span className="saved">Tersimpan ✓</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
