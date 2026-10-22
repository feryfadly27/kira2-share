/**
 * Uji mobile-friendly via Chrome DevTools Protocol.
 * Mengecek overflow horizontal (scrollWidth > innerWidth) + ukuran elemen.
 * Pakai: node mobile-check.js <url> [width] [height]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2];
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const PORT = 9333;

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${W},${H}`,
  'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  // tunggu devtools siap
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(300);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      targets = list.find((t) => t.type === 'page');
    } catch { /* belum siap */ }
  }
  if (!targets) throw new Error('devtools tidak merespons');

  ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 2, mobile: true,
  });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(2500);

  const expr = `(() => {
    const d = document.documentElement;
    const over = [...document.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map(el => el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ').join('.') : '') + ' right=' + Math.round(el.getBoundingClientRect().right));
    const small = [...document.querySelectorAll('a,button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 32; })
      .slice(0, 8)
      .map(el => el.tagName + '.' + String(el.className) + ' h=' + Math.round(el.getBoundingClientRect().height));
    return JSON.stringify({
      innerWidth: window.innerWidth,
      scrollWidth: d.scrollWidth,
      overflow: d.scrollWidth > window.innerWidth + 1,
      docHeight: d.scrollHeight,
      overflowing: over,
      smallTapTargets: small,
    });
  })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 2));
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
