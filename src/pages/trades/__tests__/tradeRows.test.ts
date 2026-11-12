import { describe, expect, it } from 'vitest';
import type { TradeDTO } from '@/types';
import {
  buildTradesCsv,
  computeVirtualWindow,
  escapeCsvField,
  mergeTradeRows,
  summarizeTrades,
} from '../tradeRows';

function makeTrade(overrides: Partial<TradeDTO> = {}): TradeDTO {
  return {
    id: 'TXN-7C42-E91A',
    ts: 1763000000000,
    fromNodeId: 'n_ny',
    toNodeId: 'n_hk',
    fromNodeName: '纽约',
    toNodeName: '香港',
    asset: 'BTC/USD',
    assetClass: 'crypto',
    side: 'sell',
    amount: 3840000,
    price: 96842.17,
    status: 'filled',
    latencyMs: 43,
    riskScore: 87.4,
    ...overrides,
  };
}

describe('computeVirtualWindow', () => {
  const ROW = 48;

  it('空数组返回零窗口', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 480,
      rowHeight: ROW,
      total: 0,
      overscan: 6,
    });
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.offsetY).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it('滚动为 0 时从首行开始并覆盖首屏 + overscan', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 480,
      rowHeight: ROW,
      total: 100,
      overscan: 6,
    });
    expect(result.start).toBe(0);
    expect(result.end).toBe(17); // ceil(480/48)+1 = 11 可视行，再加 6 行 overscan
    expect(result.offsetY).toBe(0);
    expect(result.totalHeight).toBe(4800);
  });

  it('滚动到中间时上下各留 overscan', () => {
    const result = computeVirtualWindow({
      scrollTop: 2400, // 第 50 行
      viewportHeight: 480,
      rowHeight: ROW,
      total: 1000,
      overscan: 6,
    });
    expect(result.start).toBe(44);
    expect(result.end).toBe(67);
    expect(result.offsetY).toBe(44 * ROW);
    expect(result.totalHeight).toBe(1000 * ROW);
  });

  it('滚到末尾时 end 收敛为 total', () => {
    const result = computeVirtualWindow({
      scrollTop: 300 * ROW - 480, // 最大滚动量
      viewportHeight: 480,
      rowHeight: ROW,
      total: 300,
      overscan: 6,
    });
    expect(result.start).toBe(284);
    expect(result.end).toBe(300);
    expect(result.offsetY).toBe(284 * ROW);
  });

  it('滚动偏移超出 total 时收敛到末尾', () => {
    const result = computeVirtualWindow({
      scrollTop: 999_999,
      viewportHeight: 480,
      rowHeight: ROW,
      total: 300,
      overscan: 6,
    });
    expect(result.start).toBe(284);
    expect(result.end).toBe(300);
    expect(result.offsetY).toBe(284 * ROW);
    expect(result.totalHeight).toBe(300 * ROW);
  });

  it('数据量不足一屏时窗口覆盖全部行', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 480,
      rowHeight: ROW,
      total: 5,
      overscan: 6,
    });
    expect(result.start).toBe(0);
    expect(result.end).toBe(5);
    expect(result.totalHeight).toBe(5 * ROW);
  });

  it('overscan 为 0 时只渲染可视区', () => {
    const result = computeVirtualWindow({
      scrollTop: 2400,
      viewportHeight: 480,
      rowHeight: ROW,
      total: 1000,
      overscan: 0,
    });
    expect(result.start).toBe(50);
    expect(result.end).toBe(61);
  });

  it('任意偏移下窗口始终落在合法区间', () => {
    for (const scrollTop of [-100, 0, 777, 5000, 8_888, 1_000_000]) {
      const result = computeVirtualWindow({
        scrollTop,
        viewportHeight: 700,
        rowHeight: ROW,
        total: 137,
        overscan: 6,
      });
      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeLessThanOrEqual(137);
      expect(result.start).toBeLessThanOrEqual(result.end);
      expect(result.totalHeight).toBe(137 * ROW);
    }
  });
});

describe('CSV 拼接与转义', () => {
  it('普通字段不加引号', () => {
    expect(escapeCsvField('上海')).toBe('上海');
    expect(escapeCsvField('TXN-001')).toBe('TXN-001');
  });

  it('逗号字段整体加引号', () => {
    expect(escapeCsvField('上海, 中国')).toBe('"上海, 中国"');
  });

  it('引号字段翻倍转义', () => {
    expect(escapeCsvField('ACME "Alpha"')).toBe('"ACME ""Alpha"""');
  });

  it('换行字段加引号', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('导出文本带 BOM、表头、CRLF 与末尾换行', () => {
    const csv = buildTradesCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('时间,交易ID,卖方,买方,资产,类别,方向,金额,价格,状态,延迟,风险分');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace('\uFEFF', '').split('\r\n')).toEqual([
      '时间,交易ID,卖方,买方,资产,类别,方向,金额,价格,状态,延迟,风险分',
      '',
    ]);
  });

  it('导出两行并转义含逗号/引号的节点名', () => {
    const csv = buildTradesCsv([
      makeTrade({ id: 'TXN-001', fromNodeName: '上海, 中国', toNodeName: 'ACME "Alpha"' }),
      makeTrade({ id: 'TXN-002', status: 'failed', side: 'buy', latencyMs: 126, riskScore: 61.1 }),
    ]);
    const lines = csv.replace('\uFEFF', '').split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"上海, 中国"');
    expect(lines[1]).toContain('"ACME ""Alpha"""');
    expect(lines[1]).toContain('TXN-001');
    expect(lines[1]).toContain('卖出');
    expect(lines[1]).toContain('3840000.00');
    expect(lines[1]).toContain('96842.17');
    expect(lines[1]).toContain('FILLED');
    expect(lines[1]).toContain('43ms');
    expect(lines[2]).toContain('TXN-002');
    expect(lines[2]).toContain('买入');
    expect(lines[2]).toContain('FAILED');
    expect(lines[2]).toContain('61.1');
  });
});

describe('汇总与直播行合并', () => {
  it('汇总总成交额、异常率与延迟中位数', () => {
    const summary = summarizeTrades([
      makeTrade({ latencyMs: 38 }),
      makeTrade({ id: 'TXN-2', latencyMs: 42, status: 'flagged' }),
      makeTrade({ id: 'TXN-3', latencyMs: 50, amount: 100 }),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.amount).toBe(3840000 + 3840000 + 100);
    expect(summary.medianLatency).toBe(42);
    expect(summary.anomalyRate).toBeCloseTo((1 / 3) * 100, 5);
  });

  it('偶数行延迟中位数取中间两值均值，空数组安全', () => {
    expect(
      summarizeTrades([makeTrade({ id: 'a', latencyMs: 20 }), makeTrade({ id: 'b', latencyMs: 40 })])
        .medianLatency,
    ).toBe(30);
    expect(summarizeTrades([])).toEqual({ count: 0, amount: 0, anomalyRate: 0, medianLatency: 0 });
  });

  it('直播行在前且与分页行按 id 去重', () => {
    const live = [makeTrade({ id: 'live-1' }), makeTrade({ id: 'shared' })];
    const server = [makeTrade({ id: 'shared' }), makeTrade({ id: 'server-2' })];
    const merged = mergeTradeRows(live, server);
    expect(merged.map((trade) => trade.id)).toEqual(['live-1', 'shared', 'server-2']);
  });
});
