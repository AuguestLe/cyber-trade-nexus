import type { ArcDTO, AssetClass, NodeDTO, TradeDTO, TradeStatus } from '@/types';

const STATUS_RANK: Record<TradeStatus, number> = {
  filled: 0,
  pending: 1,
  failed: 2,
  flagged: 3,
};

/** 弧线弧度：与两地距离正相关，限制在 0.18~0.55。 */
export function arcCurveness(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const distance = Math.hypot(lon2 - lon1, lat2 - lat1);
  return Math.min(0.55, Math.max(0.18, distance / 9000 + 0.18));
}

export const ARC_LAYOUT = { minCurveness: 0.18, maxCurveness: 0.55 } as const;

/**
 * 二次贝塞尔中点，控制点与 ECharts lines 的 curveness 公式完全一致：
 * ctrlX = (x0+x1)/2 - (y0-y1) * curveness
 * ctrlY = (y0+y1)/2 - (x1-x0) * curveness
 * 用于在曲线上定位透明命中点，保证 hover/click 与视觉线重合。
 */
export function arcMidpoint(
  from: [number, number],
  to: [number, number],
  curveness = arcCurveness(from[0], from[1], to[0], to[1]),
): [number, number] {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const controlLon = (lon1 + lon2) / 2 - (lat1 - lat2) * curveness;
  const controlLat = (lat1 + lat2) / 2 - (lon2 - lon1) * curveness;
  return [
    0.25 * lon1 + 0.5 * controlLon + 0.25 * lon2,
    0.25 * lat1 + 0.5 * controlLat + 0.25 * lat2,
  ];
}

export function groupTradesToArcs(
  trades: TradeDTO[],
  limit = 180,
  nodes?: NodeDTO[],
): ArcDTO[] {
  const nodeMap = new Map((nodes ?? []).map((node) => [node.id, node]));
  const groups = new Map<string, ArcDTO>();

  for (const trade of trades) {
    const key = `${trade.fromNodeId}|${trade.toNodeId}|${trade.assetClass}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: `a_${trade.fromNodeId}_${trade.toNodeId}_${trade.assetClass}`,
        fromNodeId: trade.fromNodeId,
        toNodeId: trade.toNodeId,
        fromNodeName: trade.fromNodeName || nodeMap.get(trade.fromNodeId)?.name || trade.fromNodeId,
        toNodeName: trade.toNodeName || nodeMap.get(trade.toNodeId)?.name || trade.toNodeId,
        assetClass: trade.assetClass,
        status: trade.status,
        amount: trade.amount,
        count: 1,
        maxLatency: trade.latencyMs,
        riskScore: trade.riskScore,
        latestTs: trade.ts,
      });
      continue;
    }
    existing.amount += trade.amount;
    existing.count += 1;
    existing.maxLatency = Math.max(existing.maxLatency, trade.latencyMs);
    existing.riskScore = Math.max(existing.riskScore, trade.riskScore);
    existing.latestTs = Math.max(existing.latestTs, trade.ts);
    if (STATUS_RANK[trade.status] > STATUS_RANK[existing.status]) existing.status = trade.status;
  }

  return [...groups.values()]
    .map((arc) => ({ ...arc, amount: Math.round(arc.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function arcsByAssetClass(arcs: ArcDTO[], assetClass: AssetClass): ArcDTO[] {
  return arcs.filter((arc) => arc.assetClass === assetClass);
}

export function arcTone(arc: Pick<ArcDTO, 'status' | 'assetClass'>): 'danger' | 'warn' | 'normal' {
  if (arc.status === 'failed' || arc.status === 'flagged') return 'danger';
  if (arc.status === 'pending') return 'warn';
  return 'normal';
}
