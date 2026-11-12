import type { AssetClass, TradeStatus } from '@/types';

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  crypto: '加密货币',
  fx: '外汇',
  equity: '股票',
  commodity: '商品',
  bond: '债券',
};

export const ASSET_CLASS_EN: Record<AssetClass, string> = {
  crypto: 'CRYPTO',
  fx: 'FX',
  equity: 'EQUITY',
  commodity: 'COMMODITY',
  bond: 'BOND',
};

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  crypto: '#00f0ff',
  fx: '#ff2bd6',
  equity: '#ffb547',
  commodity: '#7b5cff',
  bond: '#5f7fa3',
};

export const ASSET_CLASS_ORDER: AssetClass[] = ['crypto', 'fx', 'equity', 'commodity', 'bond'];

export const STATUS_LABELS: Record<TradeStatus, string> = {
  filled: 'FILLED',
  pending: 'PENDING',
  failed: 'FAILED',
  flagged: 'FLAGGED',
};

export const STATUS_COLORS: Record<TradeStatus, string> = {
  filled: '#39ff9e',
  pending: '#ffb547',
  failed: '#ff4d6d',
  flagged: '#ff2bd6',
};

export const NODE_STATUS_COLORS: Record<'normal' | 'busy' | 'alert', string> = {
  normal: '#39ff9e',
  busy: '#ffb547',
  alert: '#ff4d6d',
};

export const ALERT_LEVEL_COLORS: Record<'info' | 'warn' | 'critical', string> = {
  info: '#00f0ff',
  warn: '#ffb547',
  critical: '#ff4d6d',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  large_trade: '大额交易',
  latency_spike: '延迟异常',
  risk_hit: '风控命中',
  node_offline: '节点离线',
};

export const THEME_LABELS = {
  cyan: '青紫 / CYBER',
  amber: '琥珀 / AMBER',
  ice: '冰蓝 / ICE',
} as const;

export const ASSET_OPTIONS = [
  'BTC/USD',
  'ETH/USD',
  'EUR/USD',
  'USD/JPY',
  'GBP/USD',
  '600519.SH',
  '000001.SZ',
  'AAPL',
  'NVDA',
  'XAU/USD',
  'XAG/USD',
  'US10Y',
] as const;
