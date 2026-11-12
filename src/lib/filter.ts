import type { AssetClass, Side, TradeDTO, TradeStatus } from '@/types';

export interface TradeFilterInput {
  assetClass?: AssetClass | null;
  status?: TradeStatus | null;
  side?: Side | null;
  nodeId?: string | null;
  country?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  from?: number | null;
  to?: number | null;
  search?: string;
}

/** 前端侧过滤：用于 SSE 增量数据与地图回放，口径与服务端保持一致。 */
export function matchesTrade(trade: TradeDTO, filters: TradeFilterInput): boolean {
  if (filters.assetClass && trade.assetClass !== filters.assetClass) return false;
  if (filters.status && trade.status !== filters.status) return false;
  if (filters.side && trade.side !== filters.side) return false;
  if (filters.minAmount != null && trade.amount < filters.minAmount) return false;
  if (filters.maxAmount != null && trade.amount > filters.maxAmount) return false;
  if (filters.from != null && trade.ts < filters.from) return false;
  if (filters.to != null && trade.ts > filters.to) return false;
  if (filters.nodeId && trade.fromNodeId !== filters.nodeId && trade.toNodeId !== filters.nodeId) {
    return false;
  }
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    const haystack = `${trade.id} ${trade.asset} ${trade.fromNodeName} ${trade.toNodeName}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function filterTrades(trades: TradeDTO[], filters: TradeFilterInput): TradeDTO[] {
  return trades.filter((trade) => matchesTrade(trade, filters));
}

export function nodeRelatedTrade(trade: TradeDTO, nodeId: string | null): boolean {
  if (!nodeId) return true;
  return trade.fromNodeId === nodeId || trade.toNodeId === nodeId;
}
