// 验证所有页面在流式布局下铺满视口，且无 DOM 嵌套错误
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123', remember: true }),
  });
  const { data } = await res.json();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
    defaultViewport: { width: 1284, height: 806, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('validateDOMNesting') || t.includes('Uncaught') || t.includes('TypeError')) errors.push(t);
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(400);
  await page.evaluate((v) => localStorage.setItem('nexus.auth', JSON.stringify(v)), { ...data, v: 1 });

  const pages = ['/', '/map', '/trades', '/admin'];
  const results = {};
  for (const path of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await sleep(2600);
    results[path] = await page.evaluate(() => {
      const canvas = document.querySelector('[class*="canvas"]');
      const r = canvas?.getBoundingClientRect();
      const overflowX = document.documentElement.scrollWidth;
      return {
        fills: r ? Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2 : false,
        canvas: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : null,
        viewport: `${innerWidth}x${innerHeight}`,
        hasScale: canvas ? getComputedStyle(canvas).transform !== 'none' : null,
        hOverflow: overflowX > innerWidth + 1,
      };
    });
    await page.screenshot({ path: `/tmp/nexus-${path.replace(/\//g, '') || 'home'}-fluid.png` });
  }

  console.log(JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
