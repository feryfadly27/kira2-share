/**
 * Login otomatis + screenshot halaman admin (lewat Chrome DevTools Protocol).
 * Pakai: node admin-shot.js <outDir> [width] [height] [page1,page2,...]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = process.argv[2] || 'C:\\Users\\Fery\\AppData\\Local\\Temp\\opencode\\admin';
const W = Number(process.argv[3] || 1280);
const H = Number(process.argv[4] || 900);
const PAGES = (process.argv[5] || 'admin,event/all,event/create,admin/shares/5,admin/subscriptions,admin/subscriptions/ai-credits,admin/sms-health,admin/account,admin/settings,admin/experiences').split(',');
const PORT = 9335;
const BASE = 'http://localhost:5173';

mkdirSync(outDir, { recursive: true });
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
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Runtime.enable');

  // --- login ---
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2000);
  const loginResult = await evalJs(`(async () => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')];
    const email = inputs.find(i => /email|user/i.test(i.name + i.type + i.placeholder));
    const pass = inputs.find(i => /pass/i.test(i.name + i.type + i.placeholder));
    if (!email || !pass) return 'input tidak ditemukan: ' + inputs.map(i => i.type + '/' + i.name).join(',');
    setVal(email, 'demo@local');
    setVal(pass, 'demo1234');
    const form = email.closest('form');
    if (form) { form.requestSubmit(); } else {
      const btn = [...document.querySelectorAll('button')].find(b => /masuk|login|sign/i.test(b.textContent));
      if (btn) btn.click();
    }
    await new Promise(r => setTimeout(r, 1800));
    return 'ok -> ' + location.pathname;
  })()`);
  console.log('login:', loginResult);

  // --- screenshot tiap halaman ---
  for (const p of PAGES) {
    const url = p.startsWith('http') ? p : `${BASE}/${p}`;
    await send('Page.navigate', { url });
    await sleep(1600);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = p.replace(/[^a-z0-9]+/gi, '_') + '.png';
    writeFileSync(`${outDir}\\${name}`, Buffer.from(shot.result.data, 'base64'));
    const info = await evalJs(`JSON.stringify({path:location.pathname, sw:document.documentElement.scrollWidth, iw:innerWidth, h:document.documentElement.scrollHeight})`);
    console.log(`  ${p.padEnd(32)} ${info}`);
  }
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
