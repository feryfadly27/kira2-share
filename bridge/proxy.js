/**
 * LumaBooth Bridge — MITM proxy lokal untuk self-hosting link share dslrBooth.
 *
 * CARA KERJA
 *  1. dslrBooth meminta link share:
 *       GET https://mobileapi.fotoshare.co/mobileapi/album/link?event_id=...
 *       Authorization: Bearer <token>
 *  2. Bridge membalas:
 *       { "success": true, "url": "http://<IP-LAN>:4000/gallery/<id>", "error": "" }
 *  3. dslrBooth meng-encode URL itu ke QR code  =>  QR menunjuk ke server kita.
 *  4. Foto diambil dari disk lokal dslrBooth oleh backend/src/booth.js.
 *
 * CATATAN PENTING
 *  - Hanya host yang masuk INTERCEPT_HOSTS yang di-MITM (sertifikat CA kita).
 *    Host lain di-*tunnel* apa adanya (byte murni) sehingga browser & aplikasi
 *    lain tidak terpengaruh sama sekali.
 *  - TIDAK ada pemalsuan validasi lisensi: endpoint lisensi diteruskan utuh
 *    ke server asli. Yang kita ubah hanya tujuan link share.
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CA_DIR = path.join(__dirname, 'ca');
const PORT = Number(process.env.BRIDGE_PORT || 8888);
const BACKEND = process.env.BRIDGE_BACKEND || 'http://127.0.0.1:4000';

// Host yang responses-nya kita ints_ep (tidak semua request ke host ini di-MITM).
const INTERCEPT_HOSTS = new Set([
  'mobileapi.fotoshare.co',
  'api.fotoshare.co',
  'guest.fotoshare.co',
  'fotoshare.co',
]);

// ---------------------------------------------------------------- CA & sertifikat
async function ensureCA() {
  fs.mkdirSync(CA_DIR, { recursive: true });
  const keyPath = path.join(CA_DIR, 'ca.key');
  const certPath = path.join(CA_DIR, 'ca.crt');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
  }
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'LumaBooth Self-Host Bridge CA' }],
    {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true, keyEncipherment: true },
      ],
    }
  );
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

const ca = await ensureCA();
const leafCache = new Map();

async function leafFor(host) {
  if (leafCache.has(host)) return leafCache.get(host);
  const pems = await selfsigned.generate([{ name: 'commonName', value: host }], {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    ca: { cert: ca.cert, key: ca.key },
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: host },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  });
  const leaf = { key: pems.private, cert: pems.cert };
  leafCache.set(host, leaf);
  return leaf;
}

function secureContextFor(servername, fallback) {
  const l = leafCache.get(servername) || fallback;
  return tls.createSecureContext({ key: l.key, cert: l.cert, minVersion: 'TLSv1.2' });
}

// ---------------------------------------------------------------- URL galeri self-host
// Tidak di-cache: sesi foto berubah setiap capture, jadi URL harus selalu segar.
async function galleryUrl() {
  try {
    const res = await fetch(`${BACKEND}/api/booth/gallery-url`);
    const j = await res.json();
    if (j.url) return j.url;
  } catch (e) {
    console.error('[bridge] gagal ambil url galeri dari backend:', e.message);
  }
  return null;
}

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a);
}

// ---------------------------------------------------------------- header bersih
const HOP_BY_HOP = new Set([
  'proxy-connection', 'proxy-authorization', 'te', 'trailer',
  'transfer-encoding', 'upgrade', 'connection', 'keep-alive',
]);

function cleanHeaders(h, host) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'host') out[k] = v;
  }
  out.host = host;
  return out;
}

// ---------------------------------------------------------------- aturan intersep
async function maybeIntercept(req, res, host) {
  let u;
  try { u = new URL(req.url, `https://${host}`); } catch { return false; }
  const p = u.pathname;

  // Endpoint yang mengembalikan link share -> inilah yang jadi isi QR.
  if (host === 'mobileapi.fotoshare.co' && p === '/mobileapi/album/link') {
    const url = await galleryUrl();
    if (!url) {
      log('! album/link: backend belum punya foto booth -> diteruskan ke server asli');
      return false;
    }
    const payload = {
      success: true,
      url,
      error: '',
      fotoshare_url: url,
      fotoshare_url_encoded: encodeURIComponent(url),
    };
    log(`* INTERSEP album/link -> ${url}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
    return true;
  }

  // Halaman tamu (QR guest control) -> arahkan juga ke galeri kita.
  if (host === 'guest.fotoshare.co' && p === '/') {
    const url = await galleryUrl();
    if (!url) return false;
    log(`* INTERSEP guest.fotoshare.co/ -> ${url}`);
    res.writeHead(302, { location: url });
    res.end();
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- penerusan ke server asli
// ---------------------------------------------------------------- penerusan + rewrite
// Untuk host target: teruskan ke server asli, tapi bila respons JSON-nya
// memuat link share (fotoshare.co / guest.fotoshare.co), ganti ke galeri kita.
function forwardAndRewrite(req, res, host) {
  const chunks = [];
  const preq = https.request(
    {
      host,
      port: 443,
      method: req.method,
      path: req.url,
      headers: cleanHeaders(req.headers, host),
    },
    (pres) => {
      const ct = String(pres.headers['content-type'] || '');
      if (!ct.includes('json')) {
        res.writeHead(pres.statusCode, pres.headers);
        pres.pipe(res);
        return;
      }
      pres.on('data', (c) => chunks.push(c));
      pres.on('end', async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        let out = body;
        try {
          const j = JSON.parse(body);
          const url = await galleryUrl();
          let changed = false;
          if (url && j && typeof j === 'object' && !Array.isArray(j)) {
            const isShare = (v) => typeof v === 'string' && /fotoshare\.co|fotoshare\.co\/(i|bp)\//i.test(v);
            if (isShare(j.url)) { j.url = url; changed = true; }
            if (isShare(j.fotoshare_url)) { j.fotoshare_url = url; changed = true; }
            if (Array.isArray(j.links) && j.links.some(isShare)) {
              j.links = j.links.map((v) => (isShare(v) ? url : v));
              changed = true;
            }
          }
          if (changed) {
            out = JSON.stringify(j);
            log(`* REWRITE link share -> ${url}`);
          }
        } catch {
          /* bukan JSON valid -> teruskan mentah */
        }
        const headers = { ...pres.headers };
        headers['content-length'] = Buffer.byteLength(out);
        res.writeHead(pres.statusCode, headers);
        res.end(out);
      });
    }
  );
  preq.on('error', (e) => {
    log(`! upstream ${host} gagal: ${e.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('bridge: upstream error');
  });
  req.pipe(preq);
}

function forward(req, res, host, port, protocol) {
  const isHttps = protocol === 'https';
  const lib = isHttps ? https : http;
  const opts = {
    host,
    port: port || (isHttps ? 443 : 80),
    method: req.method,
    path: req.url,
    headers: cleanHeaders(req.headers, host),
  };
  const preq = lib.request(opts, (pres) => {
    const headers = { ...pres.headers };
    for (const k of HOP_BY_HOP) delete headers[k];
    res.writeHead(pres.statusCode, headers);
    pres.pipe(res);
  });
  preq.on('error', (e) => {
    log(`! upstream ${host} gagal: ${e.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('bridge: upstream error');
  });
  req.pipe(preq);
}

// ---------------------------------------------------------------- server dalam (setelah TLS di-terminate)
const inner = http.createServer(async (req, res) => {
  const host = String(req.headers.host || '').split(':')[0];
  log(`-> ${req.method} https://${host}${req.url}`);
  try {
    if (INTERCEPT_HOSTS.has(host)) {
      if (await maybeIntercept(req, res, host)) return;
      forwardAndRewrite(req, res, host);
      return;
    }
  } catch (e) {
    log('! error intersep:', e.message);
  }
  forward(req, res, host, 443, 'https');
});

// ---------------------------------------------------------------- server TLS untuk MITM
const mitmServer = tls.createServer({
  minVersion: 'TLSv1.2',
  SNICallback: async (servername, cb) => {
    try {
      const leaf = await leafFor(servername || 'localhost');
      cb(null, secureContextFor(servername, leaf));
    } catch (e) {
      cb(e);
    }
  },
});
mitmServer.on('tlsClientError', (err) => log('! tls client error:', err.message));
mitmServer.on('secureConnection', (sock) => {
  log('  [mitm] TLS aman, SNI ok');
  sock.on('error', () => {});
  inner.emit('connection', sock);
});

// ---------------------------------------------------------------- proxy utama
const proxy = http.createServer((req, res) => {
  // Request HTTP biasa (proxy form absolut)
  let u;
  try { u = new URL(req.url); } catch { res.writeHead(400); res.end('bad request'); return; }
  const host = u.hostname;
  if (INTERCEPT_HOSTS.has(host)) {
    // arahkan ke versi HTTPS host yang sama
    const target = `https://${host}${u.pathname}${u.search}`;
    log(`-> ${req.method} ${target}`);
    const headers = cleanHeaders(req.headers, host);
    const preq = https.request(
      { host, port: 443, method: req.method, path: u.pathname + u.search, headers },
      (pres) => {
        const h = { ...pres.headers };
        for (const k of HOP_BY_HOP) delete h[k];
        res.writeHead(pres.statusCode, h);
        pres.pipe(res);
      }
    );
    preq.on('error', () => { res.writeHead(502); res.end('bridge error'); });
    req.pipe(preq);
    return;
  }
  if (process.env.BRIDGE_DEBUG) log(`-> ${req.method} ${req.url} (tunnel)`);
  forward(req, res, host, u.port || 80, u.protocol.replace(':', ''));
});

proxy.on('connect', (req, clientSocket, head) => {
  const [host, portStr] = String(req.url).split(':');
  const port = Number(portStr || 443);
  clientSocket.on('error', () => {});

  if (INTERCEPT_HOSTS.has(host)) {
    log(`= CONNECT ${host}:${port}  (MITM)`);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: luma-bridge\r\n\r\n');
    if (head && head.length) clientSocket.unshift(head);
    mitmServer.emit('connection', clientSocket);
    return;
  }

  // Tunnel murni: tidak disentuh sama sekali (tanpa sertifikat CA).
  if (process.env.BRIDGE_DEBUG) log(`= CONNECT ${host}:${port}  (tunnel)`);
  const upstream = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) upstream.write(head);
    clientSocket.pipe(upstream);
    upstream.pipe(clientSocket);
  });
  upstream.on('error', (e) => {
    log(`! tunnel ${host} gagal: ${e.message}`);
    try { clientSocket.destroy(); } catch {}
  });
  clientSocket.on('error', () => {
    try { upstream.destroy(); } catch {}
  });
});

proxy.listen(PORT, '127.0.0.1', () => {
  log(`bridge aktif di http://127.0.0.1:${PORT}`);
  log(`CA: ${path.join(CA_DIR, 'ca.crt')}`);
});
