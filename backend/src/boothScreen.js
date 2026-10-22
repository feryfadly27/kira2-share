/**
 * LumaBooth Screen Bridge
 *
 * Menampilkan QR self-host (bukan QR cloud fotoshare.co) di layar dslrBooth:
 *  - SharingScreenTemplates : layar setelah foto (tempat tamu memindai)
 *  - StartScreenTemplates   : layar awal booth
 *
 * Cara kerja: dslrBooth menyimpan template layar sebagai XML. Kita sisipkan
 * elemen <Image> yang menunjuk file PNG QR miliktua sendiri, dan (opsional)
 * menyembunyikan tombol QR bawaan dslrBooth yang mengarah ke fotoshare.co.
 *
 * File PNG QR dan template di-patch ulang secara berkala karena dslrBooth
 * kadang menulis ulang template saat menyimpan.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';

const APPDATA = process.env.APPDATA || '';
const DSLR_DIR = join(APPDATA, 'dslrBooth');
const QR_NAME = 'selfhost-qr.png';
const MARK = `ImagePath="${QR_NAME}"`;
// File ini ada = patch layar dimatikan (dan template dikembalikan ke aslinya).
const OFF_FLAG = join(DSLR_DIR, '.lumabooth_screen_off');
// Lokasi stabil untuk PNG QR (dipakai overlay popup & cetak).
export const QR_FILE = 'C:\\dslrBooth\\lumabooth-qr.png';

// Lebar QR di tiap layar (sesuai ukuran kanvas 1920x1080)
const LAYOUT = {
  SharingScreenTemplates: { width: 420, height: 420, top: 480, left: 20 },
  StartScreenTemplates: { width: 240, height: 240, top: 14, left: 1090 },
};

function templateFiles() {
  const out = [];
  for (const sub of Object.keys(LAYOUT)) {
    const base = join(DSLR_DIR, sub);
    if (!existsSync(base)) continue;
    let entries = [];
    try { entries = readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      const dir = join(base, d.name);
      const file = join(dir, 'template.xml');
      if (existsSync(file)) out.push({ kind: sub, dir, file });
    }
  }
  return out;
}

async function writeQrPng(dir, url) {
  const dest = join(dir, QR_NAME);
  await QRCode.toFile(dest, url, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFFFF' },
  });
  return dest;
}

function patchTemplate(file, kind) {
  const L = LAYOUT[kind];
  let xml = readFileSync(file, 'utf8');
  let changed = false;

  // Simpan salinan asli (tanpa QR self-host) sebagai cadangan.
  const origPath = file.replace('template.xml', 'template.orig.xml');
  if (!existsSync(origPath)) {
    const orig = xml
      .replace(new RegExp(`\\s*<Image[^>]*${QR_NAME.replace('.', '\\.')}[^>]*/>`), '')
      .replace(/(<SharingScanQRButton\b[^>]*?)IsVisible="False"/, '$1IsVisible="True"');
    try { writeFileSync(origPath, orig, 'utf8'); } catch { /* abaikan */ }
  }

  if (!xml.includes(MARK)) {
    const el =
      `    <Image Name="SelfHost QR" IsVisible="True" Opacity="100" ShadowEnabled="False" ` +
      `ShadowColor="#FF000000" ShadowDepth="10" ShadowRadius="20" ShadowDirection="-45" ` +
      `Width="${L.width}" Height="${L.height}" Top="${L.top}" Left="${L.left}" ` +
      `ImagePath="${QR_NAME}" KeepAspect="True" Thickness="0" StrokeColor="#FF000000" ZIndex="20" />`;
    if (xml.includes('  </Elements>')) {
      xml = xml.replace('  </Elements>', `${el}\n  </Elements>`);
      changed = true;
    }
  }

  // Sembunyikan tombol QR cloud dslrBooth di layar sharing (menggantikan
  // QR bawaan yang mengarah ke fotoshare.co).
  if (kind === 'SharingScreenTemplates') {
    const before = xml;
    xml = xml.replace(
      /(<SharingScanQRButton\b[^>]*?)IsVisible="True"/,
      '$1IsVisible="False"'
    );
    if (xml !== before) changed = true;
  }

  if (changed) writeFileSync(file, xml, 'utf8');
  return changed;
}

let lastUrl = null;

async function apply(url) {
  const files = templateFiles();
  const off = existsSync(OFF_FLAG);

  // Selalu tulis PNG QR ke lokasi stabil (dipakai overlay popup QR & cetak),
  // berisi URL per-sesi terbaru.
  try {
    await QRCode.toFile(QR_FILE, url, {
      width: 900,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFFFF' },
    });
  } catch (e) {
    console.error('[screen] gagal tulis QR png:', e.message);
  }

  if (files.length === 0) return { patched: 0 };
  let patched = 0;
  for (const f of files) {
    try {
      if (off) {
        // kembalikan template asli
        const origPath = f.file.replace('template.xml', 'template.orig.xml');
        if (existsSync(origPath)) {
          const orig = readFileSync(origPath, 'utf8');
          if (readFileSync(f.file, 'utf8') !== orig) {
            writeFileSync(f.file, orig, 'utf8');
            patched++;
          }
        }
        continue;
      }
      await writeQrPng(f.dir, url);
      if (patchTemplate(f.file, f.kind)) patched++;
    } catch (e) {
      console.error('[screen] gagal patch', f.file, e.message);
    }
  }
  return { patched, total: files.length };
}

export function startScreenWatcher(getUrl, intervalMs = 4000) {
  const run = async () => {
    try {
      const url = await getUrl();
      if (!url) return;
      if (url !== lastUrl) {
        lastUrl = url;
        const r = await apply(url);
        if (r.patched) console.log(`[screen] QR self-host dipasang ke ${r.patched} template (${url})`);
      } else {
        // URL sama -> tetap pastikan QR & template up-to-date
        await apply(url);
      }
    } catch (e) {
      console.error('[screen] error:', e.message);
    }
  };
  run();
  const t = setInterval(run, intervalMs);
  if (typeof t.unref === 'function') t.unref();
  console.log(`[screen] watcher QR layar aktif (${DSLR_DIR})`);
}

export { QR_NAME, templateFiles };
