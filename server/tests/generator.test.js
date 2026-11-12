import { describe, expect, it } from 'vitest';
import { MockGenerator } from '../core/generator.js';
import { TRADE_NODES } from '../core/seed.js';
import { ASSET_CLASSES, TRADE_STATUSES } from '../config.js';

const NOW = 1_763_000_000_000;

function makeGenerator() {
  return new MockGenerator(20261112, NOW);
}

describe('MockGenerator 历史数据', () => {
  it('同 seed 生成可复现的历史交易', () => {
    const a = makeGenerator().createHistory(NOW);
    const b = makeGenerator().createHistory(NOW);
    expect(a.trades).toHaveLength(1200);
    expect(a.trades.map((t) => t.id)).toEqual(b.trades.map((t) => t.id));
    expect(a.trades.map((t) => t.amount)).toEqual(b.trades.map((t) => t.amount));
    expect(a.markets).toEqual(b.markets);
  });

  it('历史交易字段合法且时间落在 24h 窗口内', () => {
    const { trades } = makeGenerator().createHistory(NOW);
    const ids = new Set();
    for (const trade of trades) {
      expect(trade.id).toMatch(/^tx_/);
      ids.add(trade.id);
      expect(TRADE_NODES.some((node) => node.id === trade.fromNodeId)).toBe(true);
      expect(TRADE_NODES.some((node) => node.id === trade.toNodeId)).toBe(true);
      expect(trade.fromNodeId).not.toBe(trade.toNodeId);
      expect(ASSET_CLASSES).toContain(trade.assetClass);
      expect(TRADE_STATUSES).toContain(trade.status);
      expect(trade.amount).toBeGreaterThanOrEqual(20_000);
      expect(trade.amount).toBeLessThanOrEqual(20_000_000);
      expect(trade.latencyMs).toBeGreaterThanOrEqual(5);
      expect(trade.riskScore).toBeGreaterThan(0);
      expect(trade.ts).toBeGreaterThanOrEqual(NOW - 86_400_000);
      expect(trade.ts).toBeLessThanOrEqual(NOW);
    }
    expect(ids.size).toBe(trades.length);
  });

  it('历史告警数量落在 60~400 区间且字段完整', () => {
    const { alerts } = makeGenerator().createHistory(NOW);
    expect(alerts.length).toBeGreaterThanOrEqual(60);
    expect(alerts.length).toBeLessThanOrEqual(400);
    for (const alert of alerts) {
      expect(['info', 'warn', 'critical']).toContain(alert.level);
      expect(['large_trade', 'latency_spike', 'risk_hit', 'node_offline']).toContain(alert.type);
      expect(alert.message.length).toBeGreaterThan(2);
      expect(alert.tradeId === null || typeof alert.tradeId === 'string').toBe(true);
    }
  });
});

describe('MockGenerator 实时与注入', () => {
  it('实时交易 ID 不重复', () => {
    const generator = makeGenerator();
    const first = generator.createTrade(NOW);
    const second = generator.createTrade(NOW + 1);
    expect(first.id).not.toBe(second.id);
  });

  it('大额注入生成 filled 交易与 warn 告警', () => {
    const generator = makeGenerator();
    const { trade, alert } = generator.inject('large_trade', NOW);
    expect(trade.amount).toBeGreaterThanOrEqual(8_000_000);
    expect(trade.status).toBe('filled');
    expect(alert.type).toBe('large_trade');
    expect(alert.level).toBe('warn');
    expect(alert.handled).toBe(false);
    expect(alert.tradeId).toBe(trade.id);
  });

  it('延迟注入生成 pending 交易与 latency_spike 告警', () => {
    const { trade, alert } = makeGenerator().inject('latency_spike', NOW);
    expect(trade.latencyMs).toBeGreaterThanOrEqual(900);
    expect(trade.status).toBe('pending');
    expect(alert.type).toBe('latency_spike');
  });

  it('风控注入生成 flagged 交易与 critical 告警', () => {
    const { trade, alert } = makeGenerator().inject('risk_hit', NOW);
    expect(trade.status).toBe('flagged');
    expect(trade.riskScore).toBeGreaterThanOrEqual(85);
    expect(alert.level).toBe('critical');
  });

  it('未知注入类型抛错', () => {
    expect(() => makeGenerator().inject('node_offline', NOW)).toThrow();
  });

  it('行情快照为 12 个资产、24 点 sparkline，且 tick 后末点更新', () => {
    const generator = makeGenerator();
    const before = generator.buildMarkets(NOW);
    expect(before).toHaveLength(12);
    expect(before[0].sparkline).toHaveLength(24);
    const after = generator.tickMarkets(NOW + 5000);
    expect(after[0].price).toBe(after[0].sparkline[23]);
    expect(after[0].changePct).toBeTypeOf('number');
  });
});
