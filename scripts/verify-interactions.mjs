import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = 'http://127.0.0.1:8787';
const login = async (u, p) => {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p, remember: true }),
  });
  return { ...(await r.json()).data, v: 1 };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const admin = await login('admin', 'admin123');
const viewer = await login('viewer', 'viewer123');

// 1. 登录验证码本地校验（错误验证码必须留在登录页并给出行内错误）
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.type('#username', 'admin');
await page.type('#password', 'admin123');
await page.type('#captcha', 'ZZZZ');
await page.click('button[type="submit"]');
await sleep(700);
results.loginCaptchaError = await page.evaluate(() => document.body.innerText.includes('验证码不正确'));
results.loginStayed = await page.evaluate(() => location.pathname === '/login');

// 2. viewer 只读：可查看明细但无导出、无控制台入口
await page.evaluate((r) => localStorage.setItem('nexus.auth', JSON.stringify(r)), viewer);
await page.goto(`${BASE}/trades`, { waitUntil: 'domcontentloaded' });
await sleep(2500);
results.viewerNoExport = await page.evaluate(() => !document.body.innerText.includes('导出 CSV'));
results.viewerReadOnlyBadge = await page.evaluate(() => document.body.innerText.includes('READ ONLY'));
results.viewerNoConsoleNav = await page.evaluate(() => !document.body.innerText.includes('控制台'));

// 3. 地图热力 / 回放 / 节点筛选 / 弧线抽屉
await page.evaluate((r) => localStorage.setItem('nexus.auth', JSON.stringify(r)), admin);
await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
await sleep(3200);
results.heatMode = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '航线');
  btn?.click();
  return Boolean(btn);
});
await sleep(800);
await page.screenshot({ path: 'docs/screenshots/09-map-heat.png' });

await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')];
  buttons.find((b) => b.textContent?.trim() === 'OFF')?.click();
  buttons.find((b) => b.textContent?.includes('时间回放'))?.click();
});
await sleep(2600);
await page.screenshot({ path: 'docs/screenshots/10-map-replay.png' });
results.replayActive = await page.evaluate(() => document.body.innerText.includes('回放中'));
await page.evaluate(() => {
  const exit = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '退出回放');
  exit?.click();
});
await sleep(1000);

const geometry = await page.evaluate(async () => {
  const auth = JSON.parse(localStorage.getItem('nexus.auth'));
  const headers = { Authorization: `Bearer ${auth.token}` };
  const [nodesBody, arcsBody] = await Promise.all([
    fetch('/api/nodes', { headers }).then((r) => r.json()),
    fetch('/api/aggregations/arcs?window=24h&limit=80', { headers }).then((r) => r.json()),
  ]);
  const nodes = nodesBody.data.nodes;
  const arcs = arcsBody.data.items;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const el = document.querySelector('[aria-label="全球交易地图与空中弧线"]');
  const chart = el?.__nxMapChart;
  const rect = el.getBoundingClientRect();
  const mid = (a, b) => {
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const c = Math.min(0.55, Math.max(0.18, distance / 9000 + 0.18));
    const lonc = (a[0] + b[0]) / 2 - (a[1] - b[1]) * c;
    const latc = (a[1] + b[1]) / 2 - (b[0] - a[0]) * c;
    return [0.25 * a[0] + 0.5 * lonc + 0.25 * b[0], 0.25 * a[1] + 0.5 * latc + 0.25 * b[1]];
  };
  const points = [];
  for (const arc of arcs) {
    const from = nodeMap.get(arc.fromNodeId);
    const to = nodeMap.get(arc.toNodeId);
    if (!from || !to) continue;
    const px = chart?.convertToPixel({ geoIndex: 0 }, mid([from.lon, from.lat], [to.lon, to.lat]));
    if (!px) continue;
    const x = px[0] + rect.x;
    const y = px[1] + rect.y;
    if (x > 340 && x < 1880 && y > 200 && y < 1000) points.push({ x, y, id: arc.id });
  }
  const sh = nodeMap.get('n_sh');
  const shp = chart?.convertToPixel({ geoIndex: 0 }, [sh.lon, sh.lat]);
  return {
    arc: points[0] ?? null,
    node: shp ? { x: shp[0] + rect.x, y: shp[1] + rect.y } : null,
    count: points.length,
  };
});

const arcPoints = await page.evaluate(async () => {
  const auth = JSON.parse(localStorage.getItem('nexus.auth'));
  const headers = { Authorization: `Bearer ${auth.token}` };
  const [nodesBody, arcsBody] = await Promise.all([
    fetch('/api/nodes', { headers }).then((r) => r.json()),
    fetch('/api/aggregations/arcs?window=24h&limit=80', { headers }).then((r) => r.json()),
  ]);
  const nodeMap = new Map(nodesBody.data.nodes.map((node) => [node.id, node]));
  const el = document.querySelector('[aria-label="全球交易地图与空中弧线"]');
  const chart = el?.__nxMapChart;
  const rect = el.getBoundingClientRect();
  const points = [];
  for (const arc of arcsBody.data.items) {
    const from = nodeMap.get(arc.fromNodeId);
    const to = nodeMap.get(arc.toNodeId);
    if (!from || !to || !chart) continue;
    const distance = Math.hypot(to.lon - from.lon, to.lat - from.lat);
    const c = Math.min(0.55, Math.max(0.18, distance / 9000 + 0.18));
    const lonc = (from.lon + to.lon) / 2 - (from.lat - to.lat) * c;
    const latc = (from.lat + to.lat) / 2 - (to.lon - from.lon) * c;
    const m = [0.25 * from.lon + 0.5 * lonc + 0.25 * to.lon, 0.25 * from.lat + 0.5 * latc + 0.25 * to.lat];
    const px = chart.convertToPixel({ geoIndex: 0 }, m);
    if (px) {
      const x = px[0] + rect.x;
      const y = px[1] + rect.y;
      if (x > 340 && x < 1880 && y > 200 && y < 1000) points.push({ x, y, id: arc.id });
    }
  }
  return points.slice(0, 10);
});

for (const point of arcPoints) {
  await page.mouse.click(point.x, point.y);
  await sleep(500);
  results.arcDrawer = await page.evaluate(
    () => document.body.innerText.includes('交易详情') || document.body.innerText.includes('航线详情'),
  );
  if (results.arcDrawer) {
    await page.screenshot({ path: 'docs/screenshots/11-map-drawer.png' });
    await page.keyboard.press('Escape');
    await sleep(500);
    break;
  }
}

if (geometry.node) {
  await page.mouse.click(geometry.node.x, geometry.node.y);
  await sleep(700);
  results.nodeFilter = await page.evaluate(() => document.body.innerText.includes('RELATED TO / 关联节点'));
}

results.errors = errors;
fs.writeFileSync('docs/screenshots/interactions.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
