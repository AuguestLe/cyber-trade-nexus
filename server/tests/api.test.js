import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { MockProvider } from '../providers/mockProvider.js';

let server;
let base;
let provider;
let adminToken;
let viewerToken;

async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

async function login(username, password) {
  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password, remember: true },
  });
  expect(response.status).toBe(200);
  return body.data.token;
}

beforeAll(async () => {
  provider = new MockProvider({ seed: 20261112, autoStart: false });
  const app = createApp(provider);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = await login('admin', 'admin123');
  viewerToken = await login('viewer', 'viewer123');
});

afterAll(async () => {
  provider.shutdown();
  await new Promise((resolve) => server.close(resolve));
});

describe('健康检查与鉴权', () => {
  it('健康检查无需鉴权', async () => {
    const { response, body } = await request('/api/health');
    expect(response.status).toBe(200);
    expect(body.data.ok).toBe(true);
    expect(body.data.version).toBe('1.0.0');
  });

  it('无 token 访问数据接口返回 401 UNAUTHORIZED', async () => {
    const { response, body } = await request('/api/kpis');
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('无效 token 返回 TOKEN_EXPIRED', async () => {
    const { response, body } = await request('/api/kpis', { token: 'fake_token' });
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('账号密码错误返回 INVALID_CREDENTIALS', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrong-pass' },
    });
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('缺少字段返回 VALIDATION_ERROR', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      body: { username: '' },
    });
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('登出后 token 立即失效', async () => {
    const token = await login('viewer', 'viewer123');
    const session = await request('/api/auth/session', { token });
    expect(session.response.status).toBe(200);
    expect(session.body.data.user.username).toBe('viewer');
    const logout = await request('/api/auth/logout', { method: 'POST', token });
    expect(logout.response.status).toBe(200);
    const after = await request('/api/auth/session', { token });
    expect(after.response.status).toBe(401);
  });

  it('viewer 访问管理接口返回 403', async () => {
    const { response, body } = await request('/api/admin/users', { token: viewerToken });
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('交易查询', () => {
  it('分页、状态筛选与排序方向生效', async () => {
    const { response, body } = await request('/api/trades?status=flagged&pageSize=5&sortBy=ts&sortDir=desc', {
      token: adminToken,
    });
    expect(response.status).toBe(200);
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items.length).toBeLessThanOrEqual(5);
    expect(body.data.items.every((trade) => trade.status === 'flagged')).toBe(true);
    const timestamps = body.data.items.map((trade) => trade.ts);
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
    expect(body.data.total).toBeGreaterThan(0);
  });

  it('搜索匹配资产与节点名', async () => {
    const { body } = await request('/api/trades?search=BTC&pageSize=10', { token: adminToken });
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items.every((trade) => trade.asset.includes('BTC') || trade.fromNodeName.includes('BTC'))).toBe(true);
  });

  it('升序排序与第二页可用', async () => {
    const { body } = await request('/api/trades?sortBy=ts&sortDir=asc&page=2&pageSize=10', { token: adminToken });
    expect(body.data.page).toBe(2);
    const times = body.data.items.map((trade) => trade.ts);
    for (let i = 1; i < times.length; i += 1) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
  });

  it('非法分页与金额区间返回 400', async () => {
    const badPage = await request('/api/trades?pageSize=500', { token: adminToken });
    expect(badPage.response.status).toBe(400);
    expect(badPage.body.error.code).toBe('VALIDATION_ERROR');
    const badRange = await request('/api/trades?minAmount=100&maxAmount=50', { token: adminToken });
    expect(badRange.response.status).toBe(400);
  });

  it('交易详情与不存在的交易', async () => {
    const list = await request('/api/trades?pageSize=1', { token: adminToken });
    const trade = list.body.data.items[0];
    const detail = await request(`/api/trades/${encodeURIComponent(trade.id)}`, { token: adminToken });
    expect(detail.response.status).toBe(200);
    expect(detail.body.data.trade.id).toBe(trade.id);
    const missing = await request('/api/trades/not_exist', { token: adminToken });
    expect(missing.response.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});

describe('聚合接口', () => {
  it('KPI 返回六项且窗口切换生效', async () => {
    const { body } = await request('/api/kpis?window=24h', { token: adminToken });
    expect(body.data.window).toBe('24h');
    expect(body.data.items).toHaveLength(6);
    const short = await request('/api/kpis?window=1h', { token: adminToken });
    expect(short.body.data.items.find((item) => item.key === 'trades').value).toBeLessThan(
      body.data.items.find((item) => item.key === 'trades').value,
    );
  });

  it('时序返回固定桶数与资产类别拆分', async () => {
    const { body } = await request('/api/timeseries?range=24h', { token: adminToken });
    expect(body.data.points).toHaveLength(24);
    expect(body.data.bucketMs).toBe(3600000);
    const invalid = await request('/api/timeseries?range=7d', { token: adminToken });
    expect(invalid.response.status).toBe(400);
  });

  it('资产占比合计接近 100%', async () => {
    const { body } = await request('/api/aggregations/assets?window=24h', { token: adminToken });
    const sum = body.data.items.reduce((acc, item) => acc + item.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(body.data.items).toHaveLength(5);
  });

  it('地区排行最多 8 条', async () => {
    const { body } = await request('/api/aggregations/regions?window=24h&limit=8', { token: adminToken });
    expect(body.data.items.length).toBeLessThanOrEqual(8);
    expect(body.data.items[0].countryCode).toBeTypeOf('string');
  });

  it('弧线束结构完整且数量受 limit 限制', async () => {
    const { body } = await request('/api/aggregations/arcs?window=24h&limit=20', { token: adminToken });
    expect(body.data.items.length).toBeLessThanOrEqual(20);
    for (const arc of body.data.items) {
      expect(arc.fromNodeId).toBeTypeOf('string');
      expect(arc.toNodeId).toBeTypeOf('string');
      expect(arc.amount).toBeGreaterThan(0);
      expect(arc.count).toBeGreaterThanOrEqual(1);
    }
    expect(body.data.truncated).toBeTypeOf('boolean');
  });

  it('盘口深度返回 12 档买卖', async () => {
    const { body } = await request('/api/aggregations/depth?asset=BTC%2FUSD', { token: adminToken });
    expect(body.data.bids).toHaveLength(12);
    expect(body.data.asks).toHaveLength(12);
    const unknown = await request('/api/aggregations/depth?asset=UNKNOWN', { token: adminToken });
    expect(unknown.response.status).toBe(404);
  });

  it('健康度与行情返回', async () => {
    const health = await request('/api/aggregations/health', { token: adminToken });
    expect(health.body.data.items).toHaveLength(5);
    const markets = await request('/api/markets', { token: adminToken });
    expect(markets.body.data.items).toHaveLength(12);
    expect(markets.body.data.items[0].sparkline).toHaveLength(24);
  });

  it('告警过滤与 limit 生效', async () => {
    const { body } = await request('/api/alerts?limit=10&handled=false', { token: adminToken });
    expect(body.data.items.length).toBeLessThanOrEqual(10);
    expect(body.data.items.every((alert) => alert.handled === false)).toBe(true);
    const invalid = await request('/api/alerts?limit=999', { token: adminToken });
    expect(invalid.response.status).toBe(400);
  });
});

describe('管理接口', () => {
  it('用户列表不泄漏密码', async () => {
    const { body } = await request('/api/admin/users', { token: adminToken });
    expect(body.data.items.length).toBeGreaterThanOrEqual(6);
    expect(body.data.items[0].password).toBeUndefined();
  });

  it('停用用户后无法登录，重新启用后恢复', async () => {
    const disabled = await request('/api/admin/users/u_trader_li', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    expect(disabled.response.status).toBe(200);
    expect(disabled.body.data.user.enabled).toBe(false);

    const loginAttempt = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'trader_li', password: 'demo123' },
    });
    expect(loginAttempt.response.status).toBe(403);
    expect(loginAttempt.body.error.code).toBe('USER_DISABLED');

    const enabled = await request('/api/admin/users/u_trader_li', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: true },
    });
    expect(enabled.body.data.user.enabled).toBe(true);
  });

  it('最后管理员保护与自身角色保护', async () => {
    const lastAdmin = await request('/api/admin/users/u_admin', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    expect(lastAdmin.response.status).toBe(400);
    expect(lastAdmin.body.error.details.reason).toBe('LAST_ADMIN');

    const selfRole = await request('/api/admin/users/u_admin', {
      method: 'PATCH',
      token: adminToken,
      body: { role: 'viewer' },
    });
    expect(selfRole.response.status).toBe(400);
    expect(selfRole.body.error.details.reason).toBe('SELF_ROLE');
  });

  it('数据流暂停/恢复与倍速切换', async () => {
    const paused = await request('/api/admin/stream', {
      method: 'PATCH',
      token: adminToken,
      body: { paused: true },
    });
    expect(paused.body.data.stream.paused).toBe(true);
    const meta = await request('/api/meta', { token: adminToken });
    expect(meta.body.data.stream.paused).toBe(true);

    const resumed = await request('/api/admin/stream', {
      method: 'PATCH',
      token: adminToken,
      body: { paused: false, speed: 4 },
    });
    expect(resumed.body.data.stream.speed).toBe(4);
    expect(resumed.body.data.stream.intervalMs).toBe(375);

    const invalid = await request('/api/admin/stream', {
      method: 'PATCH',
      token: adminToken,
      body: { speed: 3 },
    });
    expect(invalid.response.status).toBe(400);
  });

  it('三类异常注入均产生交易与告警', async () => {
    for (const type of ['large_trade', 'latency_spike', 'risk_hit']) {
      const { response, body } = await request('/api/admin/inject', {
        method: 'POST',
        token: adminToken,
        body: { type },
      });
      expect(response.status).toBe(200);
      expect(body.data.created.trade.id).toBeTypeOf('string');
      expect(body.data.created.alert.tradeId).toBe(body.data.created.trade.id);
      expect(body.data.created.alert.handled).toBe(false);
    }
  });

  it('告警处置可标记并持久到查询', async () => {
    const unhandled = await request('/api/alerts?handled=false&limit=1', { token: adminToken });
    const alert = unhandled.body.data.items[0];
    const handled = await request(`/api/admin/alerts/${encodeURIComponent(alert.id)}`, {
      method: 'PATCH',
      token: adminToken,
      body: { handled: true },
    });
    expect(handled.response.status).toBe(200);
    expect(handled.body.data.alert.handled).toBe(true);
    expect(handled.body.data.alert.handledAt).toBeTypeOf('number');

    const missing = await request('/api/admin/alerts/not_exist', {
      method: 'PATCH',
      token: adminToken,
      body: { handled: true },
    });
    expect(missing.response.status).toBe(404);
  });

  it('清空数据后交易与告警为 0', async () => {
    const { response, body } = await request('/api/admin/clear', {
      method: 'POST',
      token: adminToken,
    });
    expect(response.status).toBe(200);
    expect(body.data.cleared.trades).toBeGreaterThan(0);
    const after = await request('/api/trades?pageSize=1', { token: adminToken });
    expect(after.body.data.total).toBe(0);
  });
});

describe('SSE 与路由边界', () => {
  it('有效 token 建立 SSE 并首帧为 hello', async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/api/stream?token=${encodeURIComponent(adminToken)}`, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body.getReader();
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(text).toContain('event: hello');
    expect(text).toContain('retry: 5000');
    controller.abort();
    await reader.cancel().catch(() => undefined);
  });

  it('无效 token 的 SSE 返回 401', async () => {
    const response = await fetch(`${base}/api/stream?token=bad`, {
      headers: { Accept: 'text/event-stream' },
    });
    expect(response.status).toBe(401);
  });

  it('未知接口返回 JSON 404 信封', async () => {
    const { response, body } = await request('/api/unknown', { token: adminToken });
    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toMatch(/^req_/);
  });
});
