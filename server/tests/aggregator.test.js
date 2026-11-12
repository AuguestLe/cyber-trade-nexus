import { describe, expect, it } from 'vitest';
import {
  computeArcs,
  computeAssetShares,
  computeDepth,
  computeHealth,
  computeKpis,
  computeNodeStats,
  computeRegionRanking,
  computeTimeseries,
  filterTrades,
} from '../core/aggregator.js';
import { TRADE_NODES } from '../core/seed.js';

const NOW = 1_763_000_000_000;

let seq = 0;
function makeTrade(overrides = {}) {
  seq += 1;
  return {
    id: `t_${seq}`,
    ts: NOW - 10 * 60_000,
    fromNodeId: 'n_sh',
    toNodeId: 'n_nyc',
    asset: 'BTC/USD',
    assetClass: 'crypto',
    side: 'sell',
    amount: 100,
    price: 68000,
    status: 'filled',
    latencyMs: 20,
    riskScore: 10,
    fromNodeName: '上海',
    toNodeName: '纽约',
    ...overrides,
  };
}

describe('computeKpis', () => {
  it('按窗口口径计算六项 KPI 与环比', () => {
    const trades = [
      makeTrade({ ts: NOW - 10 * 60_000, amount: 100, latencyMs: 20, riskScore: 10 }),
      makeTrade({ ts: NOW - 20 * 60_000, amount: 200, latencyMs: 40, riskScore: 20, fromNodeId: 'n_nyc', toNodeId: 'n_ldn' }),
      makeTrade({ ts: NOW - 30 * 60_000, amount: 300, latencyMs: 60, riskScore: 30, status: 'pending', fromNodeId: 'n_sh', toNodeId: 'n_tyo' }),
      makeTrade({ ts: NOW - 90 * 60_000, amount: 100, latencyMs: 20, riskScore: 10 }),
    ];
    const items = computeKpis(trades, NOW, '1h');
    expect(items).toHaveLength(6);
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]));

    expect(byKey.volume.value).toBe(300); // 仅 filled
    expect(byKey.trades.value).toBe(3);
    expect(byKey.successRate.value).toBeCloseTo(66.67, 2);
    expect(byKey.activeNodes.value).toBe(4);
    expect(byKey.avgLatency.value).toBe(40);
    // mean risk = 20, flagged 0 => 20 * 0.7
    expect(byKey.riskIndex.value).toBeCloseTo(14, 1);
    // 上一窗口 100 -> 当前 300
    expect(byKey.volume.deltaPct).toBe(200);
    expect(byKey.volume.trend).toBe('up');
    expect(byKey.trades.deltaPct).toBe(200);
  });

  it('无数据窗口返回 0 且不产生 NaN', () => {
    const items = computeKpis([], NOW, '24h');
    for (const item of items) {
      expect(Number.isFinite(item.value)).toBe(true);
      expect(Number.isFinite(item.deltaPct)).toBe(true);
      expect(item.trend).toBe('flat');
    }
  });
});

describe('computeTimeseries', () => {
  it('24h 返回 96 个 15 分钟桶并只累计 filled', () => {
    const trades = [
      makeTrade({ ts: NOW - 20 * 60_000, amount: 500, status: 'filled' }),
      makeTrade({ ts: NOW - 20 * 60_000, amount: 500, status: 'pending' }),
      makeTrade({ ts: NOW - 5 * 60_000, amount: 200, status: 'filled' }),
      makeTrade({ ts: NOW - 3 * 86_400_000, amount: 999, status: 'filled' }),
    ];
    const series = computeTimeseries(trades, NOW, '24h');
    expect(series.points).toHaveLength(24);
    const total = series.points.reduce((sum, point) => sum + point.total, 0);
    expect(total).toBe(700);
    for (const point of series.points) {
      const classSum = point.fx + point.equity + point.crypto + point.bond + point.commodity;
      expect(classSum).toBe(point.total);
    }
  });

  it('1h 返回 60 个 1 分钟桶', () => {
    const series = computeTimeseries([], NOW, '1h');
    expect(series.points).toHaveLength(60);
    expect(series.bucketMs).toBe(60_000);
  });
});

describe('computeAssetShares', () => {
  it('按资产类别汇总且 pct 合计为 100', () => {
    const trades = [
      makeTrade({ amount: 100, assetClass: 'crypto' }),
      makeTrade({ amount: 200, assetClass: 'fx', asset: 'EUR/USD' }),
      makeTrade({ amount: 300, assetClass: 'equity', status: 'pending' }),
    ];
    const result = computeAssetShares(trades, NOW, '24h');
    const total = result.items.reduce((sum, item) => sum + item.pct, 0);
    expect(total).toBeCloseTo(100, 1);
    expect(result.items[0].amount).toBe(200);
    expect(result.items.find((item) => item.assetClass === 'equity').amount).toBe(0);
    expect(result.items.find((item) => item.assetClass === 'equity').tradeCount).toBe(0);
  });

  it('空窗口返回全 0 而非 NaN', () => {
    const result = computeAssetShares([], NOW, '1h');
    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.pct === 0 && item.amount === 0)).toBe(true);
  });
});

describe('computeRegionRanking', () => {
  it('按卖方节点国家排行并输出 topNodeId', () => {
    const trades = [
      makeTrade({ amount: 100, fromNodeId: 'n_sh', toNodeId: 'n_nyc' }),
      makeTrade({ amount: 200, fromNodeId: 'n_sh', toNodeId: 'n_hk' }),
      makeTrade({ amount: 300, status: 'pending', fromNodeId: 'n_hk' }),
      makeTrade({ amount: 400, fromNodeId: 'n_nyc', toNodeId: 'n_ldn' }),
    ];
    const { items } = computeRegionRanking(trades, NOW, '24h', 8);
    expect(items[0].country).toBe('美国');
    expect(items[0].amount).toBe(400);
    expect(items[0].topNodeId).toBe('n_nyc');
    const china = items.find((item) => item.country === '中国');
    expect(china.amount).toBe(300);
    expect(china.topNodeId).toBe('n_sh');
    expect(china.countryCode).toBe('CN');
    expect(items[0].pct).toBeGreaterThan(0);
  });
});

describe('computeArcs', () => {
  const nodes = TRADE_NODES.map((node) => ({ id: node.id, name: node.name }));
  it('按端点与资产类别分组，金额求和且状态取最严重', () => {
    const trades = [
      makeTrade({ amount: 100, status: 'filled' }),
      makeTrade({ amount: 200, status: 'pending' }),
      makeTrade({ amount: 300, assetClass: 'fx', asset: 'EUR/USD', status: 'filled' }),
    ];
    const result = computeArcs(nodes, trades, { window: '24h', limit: 10, to: NOW });
    expect(result.items).toHaveLength(2);
    const crypto = result.items.find((item) => item.assetClass === 'crypto');
    expect(crypto.amount).toBe(300);
    expect(crypto.count).toBe(2);
    expect(crypto.status).toBe('pending');
    expect(crypto.fromNodeName).toBe('上海');
    expect(result.truncated).toBe(false);
  });

  it('limit 与 maxAmount 过滤生效并标记 truncated', () => {
    const result = computeArcs(nodes, [makeTrade({ amount: 100 }), makeTrade({ amount: 900 })], {
      window: '24h',
      to: NOW,
      limit: 1,
      maxAmount: 500,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(100);
    expect(result.truncated).toBe(false);
    const truncated = computeArcs(
      nodes,
      [makeTrade({ amount: 100 }), makeTrade({ amount: 900 }), makeTrade({ amount: 500, assetClass: 'fx', asset: 'EUR/USD' })],
      { window: '24h', to: NOW, limit: 1 },
    );
    expect(truncated.truncated).toBe(true);
    expect(truncated.totalGroups).toBe(2);
  });

  it('节点与国家筛选生效', () => {
    const trades = [makeTrade(), makeTrade({ fromNodeId: 'n_ldn', toNodeId: 'n_fra', assetClass: 'fx', asset: 'EUR/USD' })];
    const result = computeArcs(nodes, trades, { window: '24h', to: NOW, nodeId: 'n_sh' });
    expect(result.items).toHaveLength(1);
    const uk = computeArcs(nodes, trades, { window: '24h', to: NOW, country: '英国' });
    expect(uk.items).toHaveLength(1);
    expect(uk.items[0].fromNodeId).toBe('n_ldn');
  });
});

describe('computeHealth', () => {
  it('五项评分按公式输出并映射状态', () => {
    const trades = [
      makeTrade({ ts: NOW - 10 * 60_000, status: 'filled', latencyMs: 30, riskScore: 20 }),
      makeTrade({ ts: NOW - 10 * 60_000, status: 'filled', latencyMs: 30, riskScore: 20 }),
      makeTrade({ ts: NOW - 10 * 60_000, status: 'failed', latencyMs: 30, riskScore: 20 }),
    ];
    const alerts = [
      { ts: NOW - 5 * 60_000, level: 'critical' },
      { ts: NOW - 5 * 60_000, level: 'warn' },
      { ts: NOW - 5 * 60_000, level: 'warn' },
    ];
    const [gateway, matching, clearing, risk, datalink] = computeHealth(trades, alerts, NOW);
    expect(gateway.score).toBe(96);
    expect(matching.score).toBe(67);
    expect(clearing.score).toBe(40);
    expect(risk.score).toBe(86);
    expect(datalink.score).toBe(97);
    expect(matching.status).toBe('alert');
    expect(risk.status).toBe('busy');
    expect(gateway.status).toBe('normal');
  });
});

describe('computeNodeStats', () => {
  it('按节点统计 IN/OUT、成交额与健康度', () => {
    const trades = [
      makeTrade({ fromNodeId: 'n_sh', toNodeId: 'n_nyc', amount: 100, status: 'filled' }),
      makeTrade({ fromNodeId: 'n_nyc', toNodeId: 'n_sh', amount: 200, status: 'filled' }),
      makeTrade({ fromNodeId: 'n_sh', toNodeId: 'n_tyo', amount: 300, status: 'pending' }),
    ];
    const alerts = [{ ts: NOW - 5 * 60_000, nodeId: 'n_sh', level: 'critical' }];
    const nodes = TRADE_NODES.slice(0, 3).map((node) => ({ ...node }));
    const stats = computeNodeStats(nodes, trades, alerts, NOW);
    const sh = stats.find((node) => node.id === 'n_sh');
    expect(sh.volume24h).toBe(300);
    expect(sh.inCount24h).toBe(1);
    expect(sh.outCount24h).toBe(2);
    expect(sh.health).toBeLessThan(95);
    expect(['normal', 'busy', 'alert']).toContain(sh.status);
  });
});

describe('computeDepth', () => {
  it('同一分钟同资产盘口确定且买卖档有序', () => {
    const now = NOW;
    const a = computeDepth('BTC/USD', now, 20261112);
    const b = computeDepth('BTC/USD', now, 20261112);
    expect(a).toEqual(b);
    expect(a.bids).toHaveLength(12);
    expect(a.asks).toHaveLength(12);
    for (let i = 1; i < a.bids.length; i += 1) {
      expect(a.bids[i][0]).toBeLessThan(a.bids[i - 1][0]);
      expect(a.bids[i][1]).toBeGreaterThanOrEqual(a.bids[i - 1][1]);
    }
    for (let i = 1; i < a.asks.length; i += 1) {
      expect(a.asks[i][0]).toBeGreaterThan(a.asks[i - 1][0]);
      expect(a.asks[i][1]).toBeGreaterThanOrEqual(a.asks[i - 1][1]);
    }
    expect(a.spread).toBeGreaterThan(0);
  });

  it('未知资产返回 null', () => {
    expect(computeDepth('UNKNOWN', NOW, 20261112)).toBeNull();
  });
});

describe('filterTrades', () => {
  const trades = [makeTrade(), makeTrade({ assetClass: 'fx', asset: 'EUR/USD', fromNodeId: 'n_ldn', toNodeId: 'n_fra' })];
  it('按类别/状态/金额/搜索/端点过滤', () => {
    expect(filterTrades(trades, { assetClass: 'fx' })).toHaveLength(1);
    expect(filterTrades(trades, { status: 'pending' })).toHaveLength(0);
    expect(filterTrades(trades, { minAmount: 500 })).toHaveLength(0);
    expect(filterTrades(trades, { search: 'euro' })).toHaveLength(0);
    expect(filterTrades(trades, { search: 'EUR/USD' })).toHaveLength(1);
    expect(filterTrades(trades, { nodeId: 'n_sh' })).toHaveLength(1);
    expect(filterTrades(trades, { country: '英国' })).toHaveLength(1);
    expect(filterTrades(trades, { from: NOW, to: NOW + 1000 })).toHaveLength(0);
  });
});
