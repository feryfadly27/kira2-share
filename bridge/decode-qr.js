/**
 * Decoder QR dari file PNG (untuk memeriksa isi QR yang tampil di dslrBooth).
 * Pakai: node decode-qr.js <file.png> [kiri] [atas] [lebar] [tinggi]
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const file = process.argv[2];
if (!file) {
  console.log('Pakai: node decode-qr.js <file.png>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(file));
const regions = [];

if (process.argv.length >= 7) {
  const [l, t, w, h] = process.argv.slice(3, 7).map(Number);
  regions.push({ name: 'wilayah', data: crop(png, l, t, w, h) });
} else {
  regions.push({ name: 'penuh', data: png });
}

for (const r of regions) {
  const code = jsQR(new Uint8ClampedArray(r.data.data), r.data.width, r.data.height);
  console.log(`[${r.name} ${r.data.width}x${r.data.height}] => ${code ? code.data : '(QR tidak ditemukan)'}`);
}

function crop(src, left, top, width, height) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = ((top + y) * src.width + (left + x)) << 2;
      const di = (y * width + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}
