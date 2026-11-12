import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve('docs/screenshots');
const V = 1;

async function login(username, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember: true }),
  });
  if (!response.ok) throw new Error(`login failed ${response.status}`);
  const body = await response.json();
  return { ...body.data, v: V };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attachErrorCapture(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/api/')) errors.push(`requestfailed: ${url} ${request.failure()?.errorText ?? ''}`);
  });
  return errors;
}

async function seedAuth(page, record) {
  await page.evaluate((value) => {
    localStorage.setItem('nexus.auth', JSON.stringify(value));
  }, record);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const adminRecord = await login('admin', 'admin123');
  const viewerRecord = await login('viewer', 'viewer123');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();
  const errors = attachErrorCapture(page);
  const results = {};
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    return `/docs/screenshots/${name }.png`;
  };

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await screenshot('01-login');
  results.login = { title: await page.title(), hasForm: await page.$('#username') !== null };

  await seedAuth(page, adminRecord);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2600);
  await screenshot('02-dashboard');
  results.dashboard = {
    connection: await page.evaluate(() => document.body.innerText.includes('STREAM / LIVE')),
    hasKpi: await page.evaluate(() => document.body.innerText.includes('24H 成交额') || document.body.innerText.includes('核心指标')),
    demoMark: await page.evaluate(() => document.body.innerText.includes('DEMO')),
  };

  await page.keyboard.press('2');
  await sleep(400);
  results.hotkeyMap = await page.evaluate(() => location.pathname);
  await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
  await sleep(3600);
  await screenshot('03-map');
  results.map = {
    hasCanvas: await page.evaluate(() => Boolean(document.querySelector('canvas'))),
    hasFilters: await page.evaluate(() => document.body.innerText.includes('线路筛选')),
    nodesLoaded: await page.evaluate(() => /NODES\s+\d+/.test(document.body.innerText)),
  };

  const searchInput = await page.$('input[aria-label="搜索城市或交易所"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.type('上海');
    await sleep(500);
    const result = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const target = buttons.find((button) => button.textContent?.includes('SHANGHAI'));
      target?.click();
      return Boolean(target);
    });
    await sleep(600);
    results.mapSearch = result;
  }

  await page.keyboard.press('3');
  await sleep(400);
  await page.goto(`${BASE}/trades`, { waitUntil: 'domcontentloaded' });
  await sleep(3600);
  await screenshot('04-trades');
  const rowExists = await page.evaluate(() => {
    const row = document.querySelector('[role="button"][aria-label^="查看交易"]');
    row?.click();
    return Boolean(row);
  });
  if (rowExists) {
    await page.waitForFunction(() => document.body.innerText.includes('交易详情'), { timeout: 5000 });
    await sleep(600);
    await screenshot('05-trades-drawer');
    await page.keyboard.press('Escape');
    await sleep(500);
  }
  results.trades = { rowExists, totalVisible: await page.evaluate(() => document.body.innerText.includes('VIRTUAL')) };

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await screenshot('06-admin');
  results.admin = {
    access: await page.evaluate(() => document.body.innerText.includes('管理员控制台')),
    themeApplied: await page.evaluate(() => document.documentElement.dataset.theme),
  };
  const themeClicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const target = buttons.find((button) => button.textContent?.includes('琥珀'));
    target?.click();
    return Boolean(target);
  });
  if (themeClicked) {
    await sleep(500);
    results.adminTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await screenshot('07-admin-amber');
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const target = buttons.find((button) => button.textContent?.includes('青紫'));
      target?.click();
    });
  }

  await seedAuth(page, viewerRecord);
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await screenshot('08-viewer-403');
  results.viewer403 = await page.evaluate(() => document.body.innerText.includes('访问被拒绝'));

  await seedAuth(page, adminRecord);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  results.errors = errors;
  results.pages = Object.keys(results);
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
