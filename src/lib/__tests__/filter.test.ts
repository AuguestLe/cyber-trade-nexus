import { describe, expect, it } from 'vitest';
import { filterTrades, matchesTrade, nodeRelatedTrade } from '../filter';
import type { TradeDTO } from '@/types';

const trade: TradeDTO = {
  id: 'tx_1',
  ts: 1_763_000_000_000,
  fromNodeId: 'n_sh',
  toNodeId: 'n_nyc',
  fromNodeName: '上海',
  toNodeName: '纽约',
  asset: 'BTC/USD',
  assetClass: 'crypto',
  side: 'sell',
  amount: 1000,
  price: 68000,
  status: 'filled',
  latencyMs: 40,
  riskScore: 20,
};

describe('matchesTrade', () => {
  it('单条件与多条件组合', () => {
    expect(matchesTrade(trade, { assetClass: 'crypto' })).toBe(true);
    expect(matchesTrade(trade, { assetClass: 'fx' })).toBe(false);
    expect(matchesTrade(trade, { status: 'filled', side: 'sell', minAmount: 100 })).toBe(true);
    expect(matchesTrade(trade, { minAmount: 2000 })).toBe(false);
    expect(matchesTrade(trade, { maxAmount: 500 })).toBe(false);
    expect(matchesTrade(trade, { nodeId: 'n_sh' })).toBe(true);
    expect(matchesTrade(trade, { nodeId: 'n_ldn' })).toBe(false);
    expect(matchesTrade(trade, { search: 'btc/usd' })).toBe(true);
    expect(matchesTrade(trade, { search: '上海' })).toBe(true);
    expect(matchesTrade(trade, { search: 'n_ldn' })).toBe(false);
    expect(matchesTrade(trade, { from: trade.ts - 1000, to: trade.ts + 1000 })).toBe(true);
    expect(matchesTrade(trade, { from: trade.ts + 1000 })).toBe(false);
  });

  it('filterTrades 返回匹配子集', () => {
    const other = { ...trade, id: 'tx_2', assetClass: 'fx' as const, status: 'pending' as const };
    expect(filterTrades([trade, other], { status: 'filled' })).toHaveLength(1);
    expect(filterTrades([trade, other], {})).toHaveLength(2);
  });

  it('nodeRelatedTrade 在无节点时放行', () => {
    expect(nodeRelatedTrade(trade, null)).toBe(true);
    expect(nodeRelatedTrade(trade, 'n_nyc')).toBe(true);
    expect(nodeRelatedTrade(trade, 'n_ldn')).toBe(false);
  });
});
