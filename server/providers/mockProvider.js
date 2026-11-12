import { CONFIG } from '../config.js';
import { MockGenerator } from '../core/generator.js';
import { MockStore } from '../core/store.js';
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
import { TRADE_NODES, nodeById } from '../core/seed.js';

/**
 * Mock 数据提供者：实现 DataProvider 接口。
 * 上层路由只依赖此接口；接真实行情时新增 RealProvider 并切换 DATA_PROVIDER。
 */
export class MockProvider {
  constructor({ seed = CONFIG.seed, now = Date.now(), autoStart = true } = {}) {
    this.store = new MockStore();
    this.generator = new MockGenerator(seed, now);
    this.cache = new Map();
    this.timers = { trade: null, kpi: null, market: null };
    this.autoStart = autoStart;
    this.boot(seed, now);
  }

  boot(seed, now = Date.now()) {
    this.store.setSeed(seed);
    this.generator.reset(seed, now);
    const history = this.generator.createHistory(now);
    this.store.bootstrap(history);
    this.cache.clear();
    if (this.autoStart) this.startTimers();
  }

  startTimers() {
    this.stopTimers();
    const scheduleTrade = () => {
      this.timers.trade = setTimeout(() => {
        if (!this.store.stream.paused) this.tickTrade();
        if (!this.store.stream.paused) scheduleTrade();
      }, this.store.stream.intervalMs);
    };
    scheduleTrade();

    this.timers.kpi = setInterval(() => {
      const now = Date.now();
      this.store.emit('kpi', { window: '24h', items: computeKpis(this.store.trades, now, '24h') });
    }, CONFIG.kpiIntervalMs);

    this.timers.market = setInterval(() => {
      const now = Date.now();
      const items = this.generator.tickMarkets(now);
      this.store.setMarkets(items);
      this.store.emit('market', { items });
    }, CONFIG.marketIntervalMs);
  }

  stopTimers() {
    if (this.timers.trade) clearTimeout(this.timers.trade);
    if (this.timers.kpi) clearInterval(this.timers.kpi);
    if (this.timers.market) clearInterval(this.timers.market);
    this.timers = { trade: null, kpi: null, market: null };
  }

  tickTrade(now = Date.now()) {
    const trade = this.generator.createTrade(now);
    this.store.addTrade(trade);
    const alert = this.generator.alertForTrade(trade);
    if (alert) this.store.addAlert(alert);
    return trade;
  }

  toTradeDTO(trade) {
    if (!trade) return null;
    return {
      ...trade,
      fromNodeName: nodeById(trade.fromNodeId)?.name ?? trade.fromNodeId,
      toNodeName: nodeById(trade.toNodeId)?.name ?? trade.toNodeId,
    };
  }

  cached(key, compute) {
    const cacheKey = `${key}:${this.store.version}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const value = compute();
    this.cache.set(cacheKey, value);
    if (this.cache.size > 64) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    return value;
  }

  clearCache() {
    this.cache.clear();
  }

  getMeta() {
    return this.store.meta();
  }

  getNodes() {
    return this.cached('nodes', () =>
      computeNodeStats(TRADE_NODES, this.store.trades, this.store.alerts, Date.now()),
    );
  }

  getTrades(query = {}) {
    const now = Date.now();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const sortBy = query.sortBy ?? 'ts';
    const sortDir = query.sortDir ?? 'desc';
    const items = this.store.trades
      .map((trade) => this.toTradeDTO(trade))
      .filter((trade) => filterTrades([trade], query).length > 0);
    items.sort((a, b) => {
      const delta = a[sortBy] - b[sortBy];
      return sortDir === 'asc' ? delta : -delta;
    });
    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      serverTime: now,
    };
  }

  getTradeById(id) {
    const trade = this.store.trades.find((item) => item.id === id);
    return this.toTradeDTO(trade);
  }

  getAlerts(query = {}) {
    const limit = query.limit ?? 60;
    let items = this.store.alerts.slice();
    if (query.level) items = items.filter((alert) => alert.level === query.level);
    if (query.handled != null) items = items.filter((alert) => alert.handled === query.handled);
    items.sort((a, b) => b.ts - a.ts);
    return { items: items.slice(0, limit) };
  }

  getKpis(windowKey = '24h') {
    return this.cached(`kpis:${windowKey}`, () => ({
      window: windowKey,
      items: computeKpis(this.store.trades, Date.now(), windowKey),
    }));
  }

  getTimeseries(range = '24h') {
    return this.cached(`timeseries:${range}`, () => computeTimeseries(this.store.trades, Date.now(), range));
  }

  getAssetShares(windowKey = '24h') {
    return this.cached(`shares:${windowKey}`, () => computeAssetShares(this.store.trades, Date.now(), windowKey));
  }

  getRegionRanking(windowKey = '24h', limit = 8) {
    return this.cached(`regions:${windowKey}:${limit}`, () =>
      computeRegionRanking(this.store.trades, Date.now(), windowKey, limit),
    );
  }

  getArcs(query = {}) {
    return this.cached(`arcs:${JSON.stringify(query)}`, () =>
      computeArcs(TRADE_NODES, this.store.trades, query),
    );
  }

  getDepth(assetCode) {
    return this.cached(`depth:${assetCode}`, () => computeDepth(assetCode, Date.now(), this.store.seed));
  }

  getHealth() {
    return this.cached('health', () => ({
      items: computeHealth(this.store.trades, this.store.alerts, Date.now()),
    }));
  }

  getMarkets() {
    return { items: this.store.markets };
  }

  subscribe(listener) {
    return this.store.subscribe(listener);
  }

  control(action) {
    switch (action.type) {
      case 'stream': {
        const partial = {};
        if (typeof action.paused === 'boolean') partial.paused = action.paused;
        if (typeof action.speed === 'number') partial.speed = action.speed;
        this.store.setStream(partial);
        if (this.autoStart) this.startTimers();
        return { stream: this.store.streamStatus() };
      }
      case 'inject': {
        const result = this.generator.inject(action.injectType, Date.now(), {
          assetClass: action.assetClass,
          nodeId: action.nodeId,
        });
        this.store.addTrade(result.trade);
        this.store.addAlert(result.alert);
        return { created: result };
      }
      case 'reset': {
        const seed = action.seed ?? CONFIG.seed;
        this.boot(seed);
        this.store.setStream({ paused: false, speed: 1 });
        return { meta: this.store.meta() };
      }
      case 'clear': {
        const cleared = this.store.clear();
        this.clearCache();
        return { cleared };
      }
      case 'handleAlert': {
        const alert = this.store.handleAlert(action.alertId, action.handled);
        return alert ? { alert } : null;
      }
      case 'updateUser': {
        const user = this.store.updateUser(action.userId, action.patch);
        return user ? { user } : null;
      }
      default:
        throw new Error(`unsupported control action: ${action.type}`);
    }
  }

  shutdown() {
    this.stopTimers();
  }
}

export const Provider = MockProvider;
