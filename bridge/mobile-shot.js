/**
 * Screenshot + audit mobile lewat Chrome DevTools Protocol.
 * Pakai: node mobile-shot.js <url> <out.png> [width] [height] [fullPage]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const [url, out, wArg, hArg, full] = process.argv.slice(2);
const W = Number(wArg || 390);
const H = Number(hArg || 844);
const PORT = 9334;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('devtools tidak merespons');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(2500);
  if (full === 'full') {
    const m = await send('Page.getLayoutMetrics');
    const h = Math.min(4000, Math.ceil(m.result.cssContentSize.height));
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 2, mobile: true });
    await sleep(600);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));

  const ev = await send('Runtime.evaluate', {
    expression: `JSON.stringify({iw:innerWidth,sw:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})`,
    returnByValue: true,
  });
  console.log('viewport/scrollWidth/height:', ev.result.result.value, '->', out);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
