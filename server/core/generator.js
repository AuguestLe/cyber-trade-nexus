import { ASSETS, ALERT_MESSAGES, TRADE_NODES } from './seed.js';
import {
  clamp,
  exponential,
  mulberry32,
  pick,
  randInt,
  roundTo,
  seedFor,
  weightedPick,
} from './rng.js';

const HISTORY_TRADES = 1200;
const HISTORY_WINDOW = 86_400_000;

/**
 * Mock 数据生成器：历史预生成 + 实时 tick + 异常注入。
 * 所有随机都走独立 RNG，同 seed 同序列。
 */
export class MockGenerator {
  constructor(seed = 20261112, now = Date.now()) {
    this.reset(seed, now);
  }

  reset(seed, now = Date.now()) {
    this.seed = seed >>> 0;
    this.now = now;
    this.seq = 0;
    this.alertSeq = 0;
    this.tradeRng = mulberry32(seedFor(seed, 'trades'));
    this.alertRng = mulberry32(seedFor(seed, 'alerts'));
    this.marketRng = mulberry32(seedFor(seed, 'markets'));
    this.injectRng = mulberry32(seedFor(seed, 'inject'));
    this.markets = this.buildMarkets(now);
    this.nodeWeights = TRADE_NODES.map((node) => node.weight);
  }

  /** 生成近 24h 历史交易与告警。 */
  createHistory(now = Date.now()) {
    this.seq = 0;
    this.alertSeq = 0;
    const trades = [];
    const alerts = [];
    const start = now - HISTORY_WINDOW;
    const span = HISTORY_WINDOW - 120_000;

    for (let i = 0; i < HISTORY_TRADES; i += 1) {
      const ts = start + Math.round((i / (HISTORY_TRADES - 1)) * span) + randInt(this.tradeRng, -15_000, 15_000);
      const trade = this.createTrade(Math.min(ts, now - 30_000));
      trades.push(trade);

      const conditional = this.alertForTrade(trade);
      if (conditional) alerts.push(conditional);
      if (i % 16 === 0) {
        alerts.push(this.createRandomAlert(trade.ts, trade));
      }
    }

    const sortedAlerts = alerts.sort((a, b) => b.ts - a.ts).slice(0, 400);
    return { trades, alerts: sortedAlerts, markets: this.markets };
  }

  createTrade(ts = Date.now(), overrides = {}, rng = this.tradeRng) {
    const from = weightedPick(rng, TRADE_NODES, this.nodeWeights);
    let to = weightedPick(rng, TRADE_NODES, this.nodeWeights);
    while (to.id === from.id) {
      to = weightedPick(rng, TRADE_NODES, this.nodeWeights);
    }
    const asset = weightedPick(rng, ASSETS, ASSETS.map((item) => item.weight));

    const roll = rng();
    let status = 'filled';
    if (roll >= 0.999) status = 'flagged';
    else if (roll >= 0.997) status = 'failed';
    else if (roll >= 0.99) status = 'pending';

    const amount = clamp(
      Math.round(exponential(rng, 1_200_000) + 40_000),
      20_000,
      20_000_000,
    );
    let riskScore = roundTo(2 + rng() ** 2 * 58, 1);
    if (status === 'flagged') riskScore = roundTo(82 + rng() * 17, 1);

    const latencyMs = clamp(Math.round(8 + exponential(rng, 22)), 5, 2_000);
    const side = rng() < 0.5 ? 'sell' : 'buy';
    const price = roundTo(asset.price * (1 + (rng() - 0.5) * 0.004), asset.decimals);

    const trade = {
      id: `tx_${ts.toString(36)}_${(this.seq += 1).toString(36)}`,
      ts,
      fromNodeId: from.id,
      toNodeId: to.id,
      fromNodeName: from.name,
      toNodeName: to.name,
      asset: asset.asset,
      assetClass: asset.assetClass,
      side,
      amount,
      price,
      status,
      latencyMs,
      riskScore,
    };
    return Object.assign(trade, overrides);
  }

  /** 单笔交易可能触发告警（大额 / 延迟 / 风控）。 */
  alertForTrade(trade) {
    let type = null;
    let level = 'info';
    if (trade.status === 'flagged' || trade.riskScore >= 80) {
      type = 'risk_hit';
      level = 'critical';
    } else if (trade.latencyMs >= 180) {
      type = 'latency_spike';
      level = 'warn';
    } else if (trade.amount >= 5_000_000) {
      type = 'large_trade';
      level = 'warn';
    }
    if (!type) return null;
    return this.buildAlert(trade.ts, type, level, trade);
  }

  createRandomAlert(ts, trade) {
    const rng = this.alertRng;
    const type = weightedPick(rng, ['latency_spike', 'large_trade', 'risk_hit', 'node_offline'], [5, 4, 3, 2]);
    const level = type === 'risk_hit' ? 'critical' : type === 'node_offline' ? 'info' : 'warn';
    return this.buildAlert(ts, type, level, trade, type === 'node_offline' ? trade.fromNodeId : null);
  }

  buildAlert(ts, type, level, trade = null, nodeId = null) {
    this.alertSeq += 1;
    const message = `${pick(this.alertRng, ALERT_MESSAGES[type])} · ${trade?.asset ?? 'NEXUS'}`;
    const handled = this.alertRng() < 0.3;
    return {
      id: `al_${ts.toString(36)}_${this.alertSeq.toString(36)}`,
      ts,
      level,
      type,
      tradeId: trade?.id ?? null,
      nodeId: nodeId ?? trade?.fromNodeId ?? null,
      message,
      handled,
      handledAt: handled ? ts + 60_000 : null,
    };
  }

  /** 管理员注入异常交易。 */
  inject(type, now = Date.now(), options = {}) {
    const rng = this.injectRng;
    const candidates = options.assetClass
      ? ASSETS.filter((item) => item.assetClass === options.assetClass)
      : ASSETS;
    const assetList = candidates.length > 0 ? candidates : ASSETS;
    const asset = pick(rng, assetList);
    const base = this.createTrade(now, {
      asset: asset.asset,
      assetClass: asset.assetClass,
      price: roundTo(asset.price * (1 + (rng() - 0.5) * 0.002), asset.decimals),
      amount: Math.round(300_000 + rng() * 3_000_000),
      latencyMs: clamp(Math.round(8 + exponential(rng, 22)), 5, 2_000),
      status: 'filled',
      riskScore: roundTo(2 + rng() * 40, 1),
    }, rng);

    if (options.nodeId && TRADE_NODES.some((node) => node.id === options.nodeId)) {
      const forced = TRADE_NODES.find((node) => node.id === options.nodeId);
      base.fromNodeId = options.nodeId;
      base.fromNodeName = forced.name;
      if (base.toNodeId === options.nodeId) {
        const replacement = pick(rng, TRADE_NODES.filter((node) => node.id !== options.nodeId));
        base.toNodeId = replacement.id;
        base.toNodeName = replacement.name;
      }
    }

    let alert;
    if (type === 'large_trade') {
      base.amount = Math.round(8_000_000 + rng() * 12_000_000);
      base.status = 'filled';
      alert = this.buildAlert(now, 'large_trade', 'warn', base);
      alert.message = `大额成交注入 · ${base.asset} · $${(base.amount / 1_000_000).toFixed(1)}M`;
    } else if (type === 'latency_spike') {
      base.latencyMs = Math.round(900 + rng() * 700);
      base.status = 'pending';
      alert = this.buildAlert(now, 'latency_spike', 'warn', base);
      alert.message = `延迟尖峰注入 · ${base.asset} · ${base.latencyMs}ms`;
    } else if (type === 'risk_hit') {
      base.riskScore = roundTo(85 + rng() * 14, 1);
      base.status = 'flagged';
      alert = this.buildAlert(now, 'risk_hit', 'critical', base);
      alert.message = `风控命中注入 · ${base.asset} · RISK ${base.riskScore}`;
    } else {
      throw new Error(`unsupported inject type: ${type}`);
    }
    alert.handled = false;
    alert.handledAt = null;
    return { trade: base, alert };
  }

  buildMarkets(now) {
    const rng = this.marketRng;
    return ASSETS.map((asset) => {
      let price = asset.price * (1 + (rng() - 0.5) * 0.02);
      const points = [roundTo(price, asset.decimals)];
      for (let i = 1; i < 24; i += 1) {
        price = price * (1 + (rng() - 0.5) * 0.012);
        points.push(roundTo(price, asset.decimals));
      }
      const last = points[points.length - 1];
      return {
        asset: asset.asset,
        assetClass: asset.assetClass,
        price: last,
        changePct: roundTo(((last / points[0] - 1) * 100), 2),
        sparkline: points,
        generatedAt: now,
      };
    });
  }

  tickMarkets(now = Date.now()) {
    const rng = this.marketRng;
    this.markets = this.markets.map((tick, index) => {
      const asset = ASSETS[index];
      const nextPrice = roundTo(tick.price * (1 + (rng() - 0.5) * 0.004), asset.decimals);
      const sparkline = tick.sparkline.slice(0, -1).concat(nextPrice);
      return {
        ...tick,
        price: nextPrice,
        sparkline,
        changePct: roundTo(((nextPrice / sparkline[0] - 1) * 100), 2),
        generatedAt: now,
      };
    });
    return this.markets;
  }
}
