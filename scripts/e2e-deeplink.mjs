// 端到端验证：交易明细 → 在地图定位 深链闭环（运行于已启动的 Vite 5173）
// 用法：node scripts/e2e-deeplink.mjs
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[e2e] ${new Date().toISOString()} ${msg}`);

async function main() {
  log('登录获取 token');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123', remember: true }),
  });
  if (!loginRes.ok) throw new Error(`login failed ${loginRes.status}`);
  const { data: record } = await loginRes.json();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  // 先访问到目标 origin，才能对 localStorage 写入

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => log(`goto login 失败: ${e.message}`));
  await sleep(600);
  await page.evaluate(
    (value) => localStorage.setItem('nexus.auth', JSON.stringify({ ...value, v: 1 })),
    record,
  );
  log('已写入登录态');

  const results = {};

  // 1) 交易明细页
  log(`打开交易明细页 ${BASE}/trades`);
  await page.goto(`${BASE}/trades`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => log(`goto trades 失败: ${e.message}`));
  await sleep(3500);
  const rowExists = await page.evaluate(() => {
    const row = document.querySelector('[role="button"][aria-label^="查看交易"]');
    row?.click();
    return Boolean(row);
  });
  log(`行存在=${rowExists}`);
  results.trades = { rowExists, virtualScroll: await page.evaluate(() => document.body.innerText.includes('VIRTUAL SCROLL ACTIVE')) };

  // 2) 抽屉打开
  log('等待交易详情抽屉');
  await page.waitForFunction(() => document.body.innerText.includes('交易详情'), { timeout: 6000 }).catch((e) => log(`等待抽屉失败: ${e.message}`));
  await sleep(700);
  results.drawerOpen = await page.evaluate(() => document.body.innerText.includes('交易详情'));
  log(`抽屉打开=${results.drawerOpen}`);

  // 3) 点「在地图定位」
  log('点击在地图定位');
  const locClicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const target = buttons.find((b) => b.textContent?.includes('在地图定位'));
    target?.click();
    return Boolean(target);
  });
  log(`定位按钮找到=${locClicked}`);
  await sleep(1800); // 等地图底图异步加载 + 深链消费

  log('读取深链结果');
  await sleep(500); // 等弧线就绪后的清理效果
  const selectedStat = await page.evaluate(() => {
    const matches = document.body.innerText.match(/SELECTED\s+\d+/);
    return matches ? matches[0] : null;
  });
  results.deepLink = {
    locButtonFound: locClicked,
    pathname: await page.evaluate(() => location.pathname),
    paramAfter: await page.evaluate(() => new URLSearchParams(location.search).get('trade')),
    paramCleared: await page.evaluate(() => !new URLSearchParams(location.search).get('trade')),
    drawerReopened: await page.evaluate(() => document.body.innerText.includes('交易详情')),
    selectedStat,
    drawerHasTxnId: await page.evaluate(() => /tx_\w+/.test(document.body.innerText)),
  };

  // 4) 截图（存到 /tmp 便于核对）
  log('截图');
  await page.screenshot({ path: '/tmp/e2e-deeplink-final.png' });

  results.errors = errors;
  log('完成');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});