import { describe, expect, it } from 'vitest';
import { arcCurveness, arcMidpoint, findArcForTrade, groupTradesToArcs } from '../arc';
import type { TradeDTO } from '@/types';

function makeTrade(overrides: Partial<TradeDTO> = {}): TradeDTO {
  return {
    id: 't1',
    ts: 1_763_000_000_000,
    fromNodeId: 'n_sh',
    toNodeId: 'n_nyc',
    fromNodeName: '上海',
    toNodeName: '纽约',
    asset: 'BTC/USD',
    assetClass: 'crypto',
    side: 'sell',
    amount: 100,
    price: 68000,
    status: 'filled',
    latencyMs: 40,
    riskScore: 20,
    ...overrides,
  };
}

describe('arcCurveness', () => {
  it('落在 0.18~0.55 区间且距离越远越大', () => {
    const near = arcCurveness(121, 31, 114, 22);
    const far = arcCurveness(-74, 40, 121, 31);
    expect(near).toBeGreaterThanOrEqual(0.18);
    expect(far).toBeLessThanOrEqual(0.55);
    expect(far).toBeGreaterThan(near);
  });
});

describe('arcMidpoint', () => {
  it('与 ECharts curveness 控制点公式一致（向上弯曲）', () => {
    const [lon, lat] = arcMidpoint([0, 0], [10, 0], 0.3);
    expect(lon).toBeCloseTo(5, 6);
    // controlY = midY - dx * curveness = -3；二次贝塞尔中点 = -1.5
    expect(lat).toBeCloseTo(-1.5, 6);
  });

  it('起点与终点互换时中点纬度一致、经度镜像', () => {
    const a = arcMidpoint([0, 0], [10, 4], 0.25);
    const b = arcMidpoint([10, 4], [0, 0], 0.25);
    expect(a[0] + b[0]).toBeCloseTo(10, 6);
  });

  it('零距离退化不产生 NaN', () => {
    const [lon, lat] = arcMidpoint([10, 10], [10, 10], 0.2);
    expect(Number.isFinite(lon)).toBe(true);
    expect(Number.isFinite(lat)).toBe(true);
  });
});

describe('groupTradesToArcs', () => {
  it('按端点与类别聚合，金额求和且状态取最严重', () => {
    const arcs = groupTradesToArcs([
      makeTrade({ amount: 100, status: 'filled' }),
      makeTrade({ id: 't2', amount: 200, status: 'pending' }),
      makeTrade({ id: 't3', amount: 300, assetClass: 'fx', asset: 'EUR/USD' }),
    ]);
    expect(arcs).toHaveLength(2);
    const crypto = arcs.find((arc) => arc.assetClass === 'crypto');
    expect(crypto?.amount).toBe(300);
    expect(crypto?.count).toBe(2);
    expect(crypto?.status).toBe('pending');
    expect(crypto?.fromNodeName).toBe('上海');
  });

  it('limit 截断并按金额降序', () => {
    const arcs = groupTradesToArcs(
      [
        makeTrade({ amount: 100, assetClass: 'fx' }),
        makeTrade({ id: 't2', amount: 900, assetClass: 'crypto' }),
      ],
      1,
    );
    expect(arcs).toHaveLength(1);
    expect(arcs[0].assetClass).toBe('crypto');
  });
});

describe('findArcForTrade', () => {
  const arcs = [
    { id: 'a_sh_nyc_crypto', fromNodeId: 'n_sh', toNodeId: 'n_nyc', assetClass: 'crypto' },
    { id: 'a_sh_nyc_fx', fromNodeId: 'n_sh', toNodeId: 'n_nyc', assetClass: 'fx' },
    { id: 'a_sg_lon_crypto', fromNodeId: 'n_sg', toNodeId: 'n_lon', assetClass: 'crypto' },
  ] as const;

  it('按端点 + 类别三元组命中同一条弧线', () => {
    const trade = { fromNodeId: 'n_sh', toNodeId: 'n_nyc', assetClass: 'fx' as const };
    const found = findArcForTrade(trade, arcs as never);
    expect(found?.id).toBe('a_sh_nyc_fx');
  });

  it('同端点不同类别命中不同弧线', () => {
    const trade = { fromNodeId: 'n_sh', toNodeId: 'n_nyc', assetClass: 'crypto' as const };
    const found = findArcForTrade(trade, arcs as never);
    expect(found?.id).toBe('a_sh_nyc_crypto');
  });

  it('无匹配时返回 undefined', () => {
    const trade = { fromNodeId: 'n_zz', toNodeId: 'n_nyc', assetClass: 'crypto' as const };
    expect(findArcForTrade(trade, arcs as never)).toBeUndefined();
  });

  it('空弧线列表返回 undefined', () => {
    expect(findArcForTrade({ fromNodeId: 'n_sh', toNodeId: 'n_nyc', assetClass: 'crypto' }, [])).toBeUndefined();
  });
});
