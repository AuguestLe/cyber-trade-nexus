import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

/**
 * 生成 README 内嵌的整页截图。
 * 前置：npm run dev（Mock API 8787 + Vite 5173）。
 * 输出：docs/screenshots/readme/*.jpg，1600×900。
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve('docs/screenshots/readme');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(username, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember: true }),
  });
  if (!response.ok) throw new Error(`login failed: ${response.status}`);
  const body = await response.json();
  return { ...body.data, v: 1 };
}

fs.mkdirSync(OUT, { recursive: true });
const admin = await login('admin', 'admin123');
const viewer = await login('viewer', 'viewer123');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('favicon')) {
    errors.push(message.text().slice(0, 160));
  }
});

const shot = async (name) => {
  const file = path.join(OUT, `${name}.jpg`);
  await page.screenshot({ type: 'jpeg', quality: 90, path: file });
  console.log(`captured ${path.relative(process.cwd(), file)}`);
};

const seed = async (record) => {
  await page.evaluate((value) => localStorage.setItem('nexus.auth', JSON.stringify(value)), record);
};

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await sleep(1200);
await shot('00-login');

await seed(admin);
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await sleep(6000);
await shot('01-dashboard');

await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await sleep(7000);
await shot('02-map');

await page.goto(`${BASE}/trades`, { waitUntil: 'domcontentloaded' });
await sleep(4000);
await shot('03-trades');

// 交易详情抽屉
await page.evaluate(() => {
  document.querySelector('[role="button"][aria-label^="查看交易"]')?.click();
});
await page.waitForFunction(() => document.body.innerText.includes('交易详情'), { timeout: 8000 });
await sleep(700);
await shot('06-trades-drawer');

await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await sleep(3500);
await shot('04-admin');

// 琥珀主题（切换后立即生效并持久化）
await page.evaluate(() => {
  const target = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('琥珀'));
  target?.click();
});
await sleep(700);
await shot('07-admin-amber');
await page.evaluate(() => {
  const target = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('青紫'));
  target?.click();
});

// 地图热力（按航线）
await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await sleep(6000);
await page.evaluate(() => {
  const target = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '航线');
  target?.click();
});
await sleep(1200);
await shot('08-map-heat');

await seed(viewer);
await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
await sleep(1500);
await shot('05-forbidden');

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
