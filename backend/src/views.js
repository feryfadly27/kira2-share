/**
 * Tampilan publik (galeri & halaman QR).
 *
 * Gaya: editorial / neo-brutal minimal —
 *  - palet kertas + tinta, satu warna aksen
 *  - garis tebal, sudut tajam, bayangan keras (tanpa blur)
 *  - tipografi sans untuk judul, mono untuk label/meta
 *  - tanpa gradien, tanpa emoji, tanpa "glassmorphism"
 *
 * Semua layout dibuat mobile-first-safe: tidak ada elemen yang bisa memaksa
 * halaman lebih lebar dari layar (grid pakai minmax(0,1fr), teks flex punya
 * min-width:0, tidak ada ukuran berbasis vw untuk konten vital).
 */

export const PALETTE = {
  paper: '#F2EFE8',
  ink: '#16130F',
  accent: '#FF3B00',
};

const BASE_CSS = `
  :root{
    --paper:${PALETTE.paper};
    --ink:${PALETTE.ink};
    --accent:${PALETTE.accent};
    --line:2px solid var(--ink);
    --sans: ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono: ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
    --pad: 18px;
  }
  *{box-sizing:border-box}
  html,body{max-width:100%;overflow-x:hidden}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0;background:var(--paper);color:var(--ink);
    font-family:var(--sans);
    -webkit-font-smoothing:antialiased;
    touch-action:manipulation;
    -webkit-tap-highlight-color:transparent;
  }
  img,video,svg{max-width:100%}
  a{color:inherit}
  .bar{
    display:flex;align-items:center;justify-content:space-between;gap:10px;
    flex-wrap:wrap;row-gap:4px;
    border-bottom:var(--line);padding:12px var(--pad);
  }
  .mark{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-size:12px;
        letter-spacing:.16em;text-transform:uppercase;font-weight:700;min-width:0}
  .dot{width:11px;height:11px;background:var(--accent);border:var(--line);display:inline-block;flex:0 0 auto}
  .meta{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;
        opacity:.72;white-space:nowrap}
  .kicker{font-family:var(--mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;
          color:var(--accent);margin:0 0 10px}
  h1{margin:0;font-size:clamp(28px,8.4vw,60px);line-height:.95;letter-spacing:-.035em;
     font-weight:800;overflow-wrap:break-word}
  .lede{margin:14px 0 0;max-width:min(46ch,100%);font-size:16px;line-height:1.5;opacity:.78}
  .btn{
    display:inline-block;border:var(--line);background:var(--ink);color:var(--paper);
    padding:14px 22px;font-family:var(--mono);font-size:12px;letter-spacing:.12em;
    text-transform:uppercase;text-decoration:none;font-weight:700;min-height:48px;
    box-shadow:4px 4px 0 var(--accent);transition:transform .08s ease,box-shadow .08s ease;
  }
  .btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--accent)}
  .btn:active{transform:translate(1px,1px);box-shadow:2px 2px 0 var(--accent)}
  .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
  .tab{border:var(--line);padding:8px 12px;font-family:var(--mono);font-size:11px;
       letter-spacing:.1em;text-transform:uppercase;text-decoration:none;background:#fff}
  .tab.on{background:var(--ink);color:var(--paper)}
  footer{border-top:var(--line);margin-top:40px;padding:16px var(--pad);
         padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));
         display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
         font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
  footer a{text-decoration:none;display:inline-flex;align-items:center;min-height:34px;
           padding:0 10px;border:2px solid var(--ink);background:#fff}
  footer a:hover{background:var(--ink);color:var(--paper)}
  footer a:active{background:var(--accent);color:#fff;border-color:var(--accent)}
  @media print{ body{background:#fff} .btn{display:none} }
`;

const isVideo = (f) => /\.(mp4|mov|webm)$/i.test(f || '');
const isAnim = (f) => /_mp4\.jpg$/i.test(f || '');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/**
 * Halaman galeri.
 */
export function renderGallery({ title, photos, tabsHtml = '', qrHref = '', sessionNote = '' }) {
  const cards = photos
    .map((p, i) => {
      const num = String(i + 1).padStart(2, '0');
      const media = isVideo(p.filename)
        ? `<video src="${esc(p.url)}" controls playsinline preload="metadata"></video>`
        : `<img src="${esc(p.url)}" loading="lazy" alt="Foto ${num}">`;
      const badge = isVideo(p.filename)
        ? '<span class="badge">VIDEO</span>'
        : isAnim(p.filename)
        ? '<span class="badge">GIF</span>'
        : '';
      return `
      <figure class="card">
        <a class="frame" href="${esc(p.url)}" target="_blank" rel="noopener">
          ${media}
          <span class="idx">${num}</span>
          ${badge}
        </a>
        <figcaption>
          <span class="fname">${esc(p.filename)}</span>
          <a class="dl" href="${esc(p.url)}" download>unduh</a>
        </figcaption>
      </figure>`;
    })
    .join('');

  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${PALETTE.paper}">
<title>${esc(title)} · Foto</title>
<style>
${BASE_CSS}
  .hero{padding:34px var(--pad) 22px;border-bottom:var(--line)}
  .grid{
    padding:22px var(--pad) 8px;display:grid;gap:16px;
    grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));
  }
  .card{margin:0;min-width:0;background:#fff;border:var(--line);box-shadow:5px 5px 0 var(--ink);
        transition:transform .08s ease,box-shadow .08s ease}
  .card:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 var(--accent)}
  .frame{position:relative;display:block;overflow:hidden;background:#EDE9E0;
         border-bottom:var(--line);aspect-ratio:4/3}
  .frame img,.frame video{width:100%;height:100%;object-fit:cover;display:block}
  .idx{position:absolute;top:0;left:0;background:var(--ink);color:var(--paper);
       font-family:var(--mono);font-size:11px;padding:4px 7px;letter-spacing:.08em}
  .badge{position:absolute;top:0;right:0;background:var(--accent);color:#fff;
         font-family:var(--mono);font-size:10px;padding:4px 7px;letter-spacing:.1em}
  figcaption{min-width:0;display:flex;align-items:center;justify-content:space-between;
             gap:8px;padding:9px 10px}
  .fname{min-width:0;flex:1 1 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
         font-family:var(--mono);font-size:11px;opacity:.7}
  .dl{flex:0 0 auto;min-height:34px;display:inline-flex;align-items:center;justify-content:center;
       padding:0 10px;border:2px solid var(--ink);background:#fff;
       font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;
       text-decoration:none}
  .dl:hover{background:var(--ink);color:var(--paper)}
  .dl:active{background:var(--accent);color:#fff;border-color:var(--accent)}
  .empty{padding:40px var(--pad);text-align:center;font-family:var(--mono);font-size:13px;opacity:.6}

  @media (max-width:640px){
    :root{--pad:14px}
    .bar{padding:10px var(--pad)}
    .hero{padding:24px var(--pad) 18px}
    .lede{font-size:15px}
    .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px var(--pad) 4px}
    .frame{aspect-ratio:1/1}
    .card{box-shadow:3px 3px 0 var(--ink)}
    figcaption{flex-direction:column;align-items:stretch;gap:7px;padding:8px}
    .fname{font-size:10px}
    .dl{min-height:38px}
    .idx{font-size:10px;padding:3px 6px}
    .badge{font-size:9px;padding:3px 6px}
  }
  @media (max-width:359px){
    .grid{grid-template-columns:1fr}
  }
</style></head>
<body>
  <div class="bar">
    <span class="mark"><span class="dot"></span>Kira2-Share · self-hosted</span>
    <span class="meta">${photos.length} foto</span>
  </div>

  <section class="hero">
    <p class="kicker">${esc(sessionNote || 'Sesi foto')}</p>
    <h1>Foto kamu,<br>siap diunduh.</h1>
    <p class="lede">Semua hasil sesi ini — original, hasil print, sampai video animated — ada di sini.
       Ketuk foto untuk melihat ukuran penuh.</p>
    ${tabsHtml}
  </section>

  ${photos.length ? `<main class="grid">${cards}</main>` : '<p class="empty">Belum ada foto.</p>'}

  <footer>
    <span>Powered by Kira2-Share · self-hosted</span>
    <span>${qrHref ? `<a href="${esc(qrHref)}" style="text-decoration:none">Tampilkan QR</a>` : ''}</span>
  </footer>
</body></html>`;
}

/**
 * Halaman QR besar (untuk ditampilkan di booth / dicetak).
 */
export function renderQrPage({ title, svg, galleryUrl, count }) {
  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${PALETTE.paper}">
<title>Scan untuk foto · ${esc(title)}</title>
<style>
${BASE_CSS}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100svh;padding:26px var(--pad) calc(26px + env(safe-area-inset-bottom,0px));
       text-align:center}
  .stage{width:min(100%,320px);background:#fff;border:var(--line);
         box-shadow:8px 8px 0 var(--accent);padding:16px;margin:20px 0 16px}
  .stage svg{width:100%;height:auto;display:block;image-rendering:pixelated}
  .url{font-family:var(--mono);font-size:12px;letter-spacing:.04em;opacity:.7;
       word-break:break-all;max-width:100%;margin:6px 0 0}
  h1{font-size:clamp(26px,7.6vw,46px);line-height:1;margin:0}
  .sub{margin:12px 0 0;opacity:.75;font-size:15px;max-width:34ch}
  .row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:24px}
  @media (max-width:640px){
    .stage{box-shadow:5px 5px 0 var(--accent);padding:12px;margin:16px 0 14px}
  }
</style></head>
<body>
  <p class="kicker">${count ? `${count} foto tersedia` : 'Self-hosted photo gallery'}</p>
  <h1>Scan untuk<br>lihat fotomu.</h1>
  <p class="sub">Buka dengan kamera HP. Tidak perlu aplikasi apa pun.</p>
  <div class="stage">${svg}</div>
  <p class="url">${esc(galleryUrl)}</p>
  <div class="row">
    <a class="btn" href="${esc(galleryUrl)}">Buka galeri</a>
  </div>
</body></html>`;
}
