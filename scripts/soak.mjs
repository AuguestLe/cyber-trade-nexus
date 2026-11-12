import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = 'http://127.0.0.1:8787';
const DURATION_MS = 10 * 60 * 1000;
const login = async (u, p) => {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p, remember: true }),
  });
  return { ...(await r.json()).data, v: 1 };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const record = await login('admin', 'admin123');
await fetch(BASE + '/api/admin/stream', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${record.token}` },
  body: JSON.stringify({ speed: 4 }),
});

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate((r) => localStorage.setItem('nexus.auth', JSON.stringify(r)), record);
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await sleep(3000);

const safe = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    errors.push(`measure-fail: ${error?.message ?? String(error)}`);
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await sleep(1000);
    } catch {
      /* ignore */
    }
    return null;
  }
};

const measure = () =>
  safe(() =>
    page.evaluate(() => ({
      ts: Date.now(),
      heapMB: performance.memory ? Math.round((performance.memory.usedJSHeapSize / 1048576) * 10) / 10 : null,
      canvases: document.querySelectorAll('canvas').length,
      tapeRows: document.querySelectorAll('[class*="tapeRow"]').length,
      connected: document.body.innerText.includes('STREAM / LIVE'),
    })),
  );

const samples = [];
const started = Date.now();
samples.push(await measure());
while (Date.now() - started < DURATION_MS) {
  await sleep(45_000);
  samples.push(await measure());
}

const fps = await safe(
  () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames += 1;
            if (performance.now() - start < 5000) requestAnimationFrame(tick);
            else resolve(Math.round((frames / (performance.now() - start)) * 1000));
          };
          requestAnimationFrame(tick);
        }),
    ),
);

await page.screenshot({ path: 'docs/screenshots/12-soak-10min.png' }).catch(() => undefined);
const valid = samples.filter(Boolean);
const result = {
  durationMs: Date.now() - started,
  speed: 4,
  samples: valid,
  firstHeapMB: valid.find((s) => s && s.heapMB != null)?.heapMB ?? null,
  lastHeapMB: valid.length ? valid[valid.length - 1].heapMB : null,
  maxHeapMB: valid.length ? Math.max(...valid.map((s) => s.heapMB ?? 0)) : null,
  fps,
  errors,
};
fs.writeFileSync('docs/screenshots/soak.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await fetch(BASE + '/api/admin/stream', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${record.token}` },
  body: JSON.stringify({ speed: 1 }),
}).catch(() => undefined);
await browser.close();
