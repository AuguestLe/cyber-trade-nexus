export const CONFIG = {
  port: Number.parseInt(process.env.PORT ?? '8787', 10),
  seed: Number.parseInt(process.env.DEMO_SEED ?? '20261112', 10),
  provider: process.env.DATA_PROVIDER ?? 'mock',
  demo: true,
  version: '1.0.0',
  tradeCap: 6000,
  alertCap: 400,
  defaultIntervalMs: 1500,
  sessionTtl: 8 * 3600_000,
  sessionTtlRemember: 7 * 86400_000,
  windows: {
    '1h': 3_600_000,
    '6h': 21_600_000,
    '24h': 86_400_000,
  },
  buckets: {
    '1h': 60_000,
    '6h': 900_000,
    '24h': 3_600_000,
  },
  ranges: ['1h', '6h', '24h'],
  speeds: [0.5, 1, 2, 4],
  arcLimit: 180,
  historyTrades: 1200,
  historyWindowMs: 86_400_000,
  kpiIntervalMs: 2000,
  marketIntervalMs: 5000,
  heartbeatMs: 15_000,
};

export const ASSET_CLASSES = ['fx', 'equity', 'crypto', 'bond', 'commodity'];
export const TRADE_STATUSES = ['filled', 'pending', 'failed', 'flagged'];
export const ALERT_LEVELS = ['info', 'warn', 'critical'];
export const ALERT_TYPES = ['large_trade', 'latency_spike', 'risk_hit', 'node_offline'];
export const NODE_TYPES = ['exchange', 'clearing', 'gateway'];
export const ROLES = ['admin', 'viewer'];
export const SORT_FIELDS = ['ts', 'amount', 'price', 'latencyMs', 'riskScore'];
export const SORT_DIRS = ['asc', 'desc'];

export const ASSET_CLASS_LABELS = {
  fx: '外汇',
  equity: '股票',
  crypto: '加密货币',
  bond: '债券',
  commodity: '商品',
};
