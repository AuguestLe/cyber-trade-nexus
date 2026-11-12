import { ASSET_CLASSES, ASSET_CLASS_LABELS, CONFIG } from '../config.js';
import { ASSETS, TRADE_NODES, countryOfNode } from './seed.js';
import { clamp, mulberry32, roundTo, seedFor } from './rng.js';

const STATUS_RANK = { filled: 0, pending: 1, failed: 2, flagged: 3 };
const HEALTH_LABELS = {
  gateway: '网关',
  matching: '撮合',
  clearing: '清算',
  risk: '风控',
  datalink: '数据链路',
};

export function windowBounds(windowKey, now) {
  const span = CONFIG.windows[windowKey];
  if (!span) throw new Error(`invalid window: ${windowKey}`);
  return { from: now - span, to: now };
}

export function filterByTime(trades, from, to) {
  return trades.filter((trade) => trade.ts >= from && trade.ts <= to);
}

export function filterTrades(trades, query = {}) {
  return trades.filter((trade) => {
    if (query.assetClass && trade.assetClass !== query.assetClass) return false;
    if (query.status && trade.status !== query.status) return false;
    if (query.side && trade.side !== query.side) return false;
    if (query.minAmount != null && trade.amount < query.minAmount) return false;
    if (query.maxAmount != null && trade.amount > query.maxAmount) return false;
    if (query.from != null && trade.ts < query.from) return false;
    if (query.to != null && trade.ts > query.to) return false;
    if (query.nodeId && trade.fromNodeId !== query.nodeId && trade.toNodeId !== query.nodeId) {
      return false;
    }
    if (query.country) {
      const fromCountry = countryOfNode(trade.fromNodeId);
      const toCountry = countryOfNode(trade.toNodeId);
      if (fromCountry !== query.country && toCountry !== query.country) return false;
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      const haystack = `${trade.id} ${trade.asset} ${trade.fromNodeName ?? ''} ${trade.toNodeName ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

function deltaPct(current, previous) {
  // 无对比窗口（例如 24h 视图的上一窗口尚无数据）时返回 0，避免出现千倍级假同比
  if (previous <= 0) return 0;
  return roundTo(((current - previous) / previous) * 100, 1);
}

function trendOf(delta) {
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'flat';
}

function computeWindowStats(trades) {
  const total = trades.length;
  const filled = trades.filter((trade) => trade.status === 'filled');
  const flagged = trades.filter((trade) => trade.status === 'flagged').length;
  const nodes = new Set();
  let latencySum = 0;
  let riskSum = 0;
  let volume = 0;
  for (const trade of trades) {
    nodes.add(trade.fromNodeId);
    nodes.add(trade.toNodeId);
    latencySum += trade.latencyMs;
    riskSum += trade.riskScore;
    if (trade.status === 'filled') volume += trade.amount;
  }
  return {
    total,
    volume,
    successRate: total === 0 ? 0 : (filled.length / total) * 100,
    activeNodes: nodes.size,
    avgLatency: total === 0 ? 0 : latencySum / total,
    riskIndex: total === 0 ? 0 : (riskSum / total) * 0.7 + (flagged / total) * 100 * 0.3,
  };
}

export function computeKpis(trades, now, windowKey = '24h') {
  const span = CONFIG.windows[windowKey];
  const current = computeWindowStats(filterByTime(trades, now - span, now));
  const previous = computeWindowStats(filterByTime(trades, now - span * 2, now - span));

  // 24h 视图的上一窗口通常没有足够样本；样本不足时不做同比，避免出现千倍级假环比
  const baseline = previous.total >= 1 && previous.total >= current.total * 0.05;
  const deltaVolume = baseline ? deltaPct(current.volume, previous.volume) : 0;
  const deltaTrades = baseline ? deltaPct(current.total, previous.total) : 0;
  const deltaSuccess = baseline ? roundTo(current.successRate - previous.successRate, 2) : 0;
  const deltaNodes = baseline ? roundTo(current.activeNodes - previous.activeNodes, 1) : 0;
  const deltaLatency = baseline ? deltaPct(current.avgLatency, previous.avgLatency) : 0;
  const deltaRisk = baseline ? roundTo(current.riskIndex - previous.riskIndex, 1) : 0;

  const prefix = windowKey.toUpperCase();
  return [
    {
      key: 'volume',
      label: `${prefix} 成交额`,
      value: Math.round(current.volume),
      unit: 'USD',
      deltaPct: deltaVolume,
      trend: trendOf(deltaVolume),
    },
    {
      key: 'trades',
      label: '成交笔数',
      value: current.total,
      unit: 'count',
      deltaPct: deltaTrades,
      trend: trendOf(deltaTrades),
    },
    {
      key: 'successRate',
      label: '成功率',
      value: roundTo(current.successRate, 2),
      unit: 'pct',
      deltaPct: deltaSuccess,
      trend: trendOf(deltaSuccess),
    },
    {
      key: 'activeNodes',
      label: '活跃节点',
      value: current.activeNodes,
      unit: 'count',
      deltaPct: deltaNodes,
      trend: trendOf(deltaNodes),
    },
    {
      key: 'avgLatency',
      label: '平均延迟',
      value: Math.round(current.avgLatency),
      unit: 'ms',
      deltaPct: deltaLatency,
      trend: trendOf(deltaLatency),
    },
    {
      key: 'riskIndex',
      label: '风险指数',
      value: roundTo(current.riskIndex, 1),
      unit: 'index',
      deltaPct: deltaRisk,
      trend: trendOf(deltaRisk),
    },
  ];
}

export function computeTimeseries(trades, now, range = '24h') {
  const bucketMs = CONFIG.buckets[range];
  const count = Math.round(CONFIG.windows[range] / bucketMs);
  const end = Math.floor(now / bucketMs) * bucketMs;
  const start = end - (count - 1) * bucketMs;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      ts: start + i * bucketMs,
      total: 0,
      fx: 0,
      equity: 0,
      crypto: 0,
      bond: 0,
      commodity: 0,
    });
  }
  for (const trade of trades) {
    if (trade.status !== 'filled' || trade.ts < start || trade.ts > now) continue;
    const index = Math.floor((trade.ts - start) / bucketMs);
    const point = points[index];
    if (!point) continue;
    point[trade.assetClass] += trade.amount;
    point.total += trade.amount;
  }
  for (const point of points) {
    for (const key of ['total', ...ASSET_CLASSES]) {
      point[key] = Math.round(point[key]);
    }
  }
  return { range, bucketMs, points };
}

export function computeAssetShares(trades, now, windowKey = '24h') {
  const { from } = windowBounds(windowKey, now);
  const scope = filterByTime(trades, from, now).filter((trade) => trade.status === 'filled');
  const total = scope.reduce((sum, trade) => sum + trade.amount, 0);
  let items = ASSET_CLASSES.map((assetClass) => {
    const rows = scope.filter((trade) => trade.assetClass === assetClass);
    const amount = rows.reduce((sum, trade) => sum + trade.amount, 0);
    const pct = total === 0 ? 0 : roundTo((amount / total) * 100, 1);
    return {
      assetClass,
      label: ASSET_CLASS_LABELS[assetClass],
      amount: Math.round(amount),
      tradeCount: rows.length,
      pct,
    };
  }).sort((a, b) => b.amount - a.amount);

  if (total > 0) {
    const sum = roundTo(items.reduce((acc, item) => acc + item.pct, 0), 1);
    const diff = roundTo(100 - sum, 1);
    if (items.length > 0) items[0].pct = roundTo(items[0].pct + diff, 1);
  } else {
    items = items.map((item) => ({ ...item, pct: 0 }));
  }
  return { window: windowKey, items };
}

export function computeRegionRanking(trades, now, windowKey = '24h', limit = 8) {
  const { from } = windowBounds(windowKey, now);
  const scope = filterByTime(trades, from, now).filter((trade) => trade.status === 'filled');
  const total = scope.reduce((sum, trade) => sum + trade.amount, 0);
  const map = new Map();

  for (const trade of scope) {
    const country = countryOfNode(trade.fromNodeId);
    if (!map.has(country)) {
      map.set(country, { amount: 0, tradeCount: 0, nodes: new Map() });
    }
    const bucket = map.get(country);
    bucket.amount += trade.amount;
    bucket.tradeCount += 1;
    bucket.nodes.set(trade.fromNodeId, (bucket.nodes.get(trade.fromNodeId) ?? 0) + trade.amount);
  }

  const items = [...map.entries()]
    .map(([country, bucket]) => {
      let topNodeId = null;
      let topAmount = -1;
      for (const [nodeId, amount] of bucket.nodes.entries()) {
        if (amount > topAmount) {
          topAmount = amount;
          topNodeId = nodeId;
        }
      }
      return {
        country,
        countryCode: countryCodeOf(topNodeId),
        amount: Math.round(bucket.amount),
        tradeCount: bucket.tradeCount,
        pct: total === 0 ? 0 : roundTo((bucket.amount / total) * 100, 1),
        topNodeId: topNodeId ?? 'n_sh',
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  return { items };
}

function countryCodeOf(nodeId) {
  if (!nodeId) return 'UN';
  const node = TRADE_NODES.find((item) => item.id === nodeId);
  return node?.countryCode ?? 'UN';
}

export function computeNodeStats(nodes, trades, alerts, now) {
  const { from } = windowBounds('24h', now);
  const scope = filterByTime(trades, from, now);
  const hourAlerts = alerts.filter((alert) => alert.ts >= now - 3_600_000);

  return nodes.map((node) => {
    const related = scope.filter(
      (trade) => trade.fromNodeId === node.id || trade.toNodeId === node.id,
    );
    const volume24h = related
      .filter((trade) => trade.status === 'filled')
      .reduce((sum, trade) => sum + trade.amount, 0);
    const inCount24h = related.filter((trade) => trade.toNodeId === node.id).length;
    const outCount24h = related.filter((trade) => trade.fromNodeId === node.id).length;
    const nodeAlerts = hourAlerts.filter((alert) => alert.nodeId === node.id);
    const criticalAlerts = nodeAlerts.filter((alert) => alert.level === 'critical').length;
    const latency = related.length
      ? related.reduce((sum, trade) => sum + trade.latencyMs, 0) / related.length
      : 30;
    // 高流量节点按负载扣分，使状态色在演示中呈现 normal / busy / alert 的真实差异
    const loadPenalty = related.length > 130 ? 7 : related.length > 90 ? 3 : 0;
    const health = Math.round(
      clamp(100 - latency / 12 - nodeAlerts.length * 2 - criticalAlerts * 8 - loadPenalty, 40, 100),
    );
    const status = health >= 92 ? 'normal' : health >= 80 ? 'busy' : 'alert';
    return {
      id: node.id,
      name: node.name,
      nameEn: node.nameEn,
      country: node.country,
      countryCode: node.countryCode,
      lon: node.lon,
      lat: node.lat,
      type: node.type,
      status,
      volume24h: Math.round(volume24h),
      tradeCount24h: related.length,
      inCount24h,
      outCount24h,
      health,
    };
  });
}

export function computeArcs(nodes, trades, query = {}) {
  const windowKey = query.window ?? '24h';
  const limit = query.limit ?? 120;
  const from = query.from ?? null;
  const to = query.to ?? Date.now();
  const lower = from ?? windowBounds(windowKey, to).from;

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const groups = new Map();

  for (const trade of trades) {
    if (trade.ts < lower || trade.ts > to) continue;
    if (query.assetClass && trade.assetClass !== query.assetClass) continue;
    if (query.status && trade.status !== query.status) continue;
    if (query.minAmount != null && trade.amount < query.minAmount) continue;
    if (query.maxAmount != null && trade.amount > query.maxAmount) continue;
    if (query.nodeId && trade.fromNodeId !== query.nodeId && trade.toNodeId !== query.nodeId) continue;
    if (query.country) {
      const fromCountry = countryOfNode(trade.fromNodeId);
      const toCountry = countryOfNode(trade.toNodeId);
      if (fromCountry !== query.country && toCountry !== query.country) continue;
    }

    const key = `${trade.fromNodeId}|${trade.toNodeId}|${trade.assetClass}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `a_${trade.fromNodeId}_${trade.toNodeId}_${trade.assetClass}`,
        fromNodeId: trade.fromNodeId,
        toNodeId: trade.toNodeId,
        fromNodeName: nodeMap.get(trade.fromNodeId)?.name ?? trade.fromNodeId,
        toNodeName: nodeMap.get(trade.toNodeId)?.name ?? trade.toNodeId,
        assetClass: trade.assetClass,
        status: trade.status,
        amount: 0,
        count: 0,
        maxLatency: 0,
        riskScore: 0,
        latestTs: 0,
      });
    }
    const group = groups.get(key);
    group.amount += trade.amount;
    group.count += 1;
    group.maxLatency = Math.max(group.maxLatency, trade.latencyMs);
    group.riskScore = Math.max(group.riskScore, trade.riskScore);
    group.latestTs = Math.max(group.latestTs, trade.ts);
    if (STATUS_RANK[trade.status] > STATUS_RANK[group.status]) group.status = trade.status;
  }

  const all = [...groups.values()].map((group) => ({
    ...group,
    amount: Math.round(group.amount),
  }));
  all.sort((a, b) => b.amount - a.amount);
  return { items: all.slice(0, limit), truncated: all.length > limit, totalGroups: all.length };
}

export function computeHealth(trades, alerts, now) {
  const hour = filterByTime(trades, now - 3_600_000, now);
  const stats = computeWindowStats(hour);
  const recentAlerts = alerts.filter((alert) => alert.ts >= now - 600_000);
  const critical = recentAlerts.filter((alert) => alert.level === 'critical').length;
  const warn = recentAlerts.filter((alert) => alert.level === 'warn').length;
  const failed = hour.filter((trade) => trade.status === 'failed' || trade.status === 'flagged').length;

  const scores = {
    gateway: Math.round(clamp(100 - stats.avgLatency / 8, 50, 100)),
    matching: Math.round(clamp(stats.successRate, 0, 100)),
    clearing: Math.round(clamp(100 - (stats.total === 0 ? 0 : (failed / stats.total) * 200), 40, 100)),
    risk: Math.round(clamp(100 - stats.riskIndex, 0, 100)),
    datalink: Math.round(clamp(100 - critical * 2 - warn * 0.5, 50, 100)),
  };

  return Object.keys(HEALTH_LABELS).map((key) => {
    const score = scores[key];
    return {
      key,
      label: HEALTH_LABELS[key],
      score,
      status: score >= 92 ? 'normal' : score >= 80 ? 'busy' : 'alert',
    };
  });
}

export function computeDepth(assetCode, now, seed) {
  const asset = ASSETS.find((item) => item.asset === assetCode);
  if (!asset) return null;
  const minute = Math.floor(now / 60_000);
  const rng = mulberry32(seedFor(seed, `depth:${asset.asset}:${minute}`));
  const price = roundTo(asset.price * (1 + (rng() - 0.5) * 0.0012), asset.decimals);
  const spread = roundTo(price * 0.0003, Math.max(2, asset.decimals));
  const tick = price * 0.00015;

  const buildSide = (direction) => {
    let cumulative = 0;
    const levels = [];
    for (let i = 0; i < 12; i += 1) {
      cumulative += roundTo(0.4 + rng() ** 2 * 7, 2);
      const levelPrice = roundTo(price + direction * (spread / 2 + i * tick), asset.decimals);
      levels.push([levelPrice, roundTo(cumulative, 2)]);
    }
    return levels;
  };

  return {
    asset: asset.asset,
    price,
    spread,
    bids: buildSide(-1),
    asks: buildSide(1),
    generatedAt: now,
  };
}
