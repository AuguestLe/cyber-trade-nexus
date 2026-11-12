export type Role = 'admin' | 'viewer';
export type AssetClass = 'fx' | 'equity' | 'crypto' | 'bond' | 'commodity';
export type TradeStatus = 'filled' | 'pending' | 'failed' | 'flagged';
export type Side = 'buy' | 'sell';
export type AlertLevel = 'info' | 'warn' | 'critical';
export type AlertType = 'large_trade' | 'latency_spike' | 'risk_hit' | 'node_offline';
export type WindowKey = '1h' | '6h' | '24h';
export type ThemeKey = 'cyan' | 'amber' | 'ice';
export type MotionMode = 'full' | 'reduced';
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'retrying' | 'closed';
export type StreamSpeed = 0.5 | 1 | 2 | 4;
export type InjectType = 'large_trade' | 'latency_spike' | 'risk_hit';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  lastLoginAt: number | null;
}

export interface NodeDTO {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  countryCode: string;
  lon: number;
  lat: number;
  type: 'exchange' | 'clearing' | 'gateway';
  status: 'normal' | 'busy' | 'alert';
  volume24h: number;
  tradeCount24h: number;
  inCount24h: number;
  outCount24h: number;
  health: number;
}

export interface TradeDTO {
  id: string;
  ts: number;
  fromNodeId: string;
  toNodeId: string;
  fromNodeName: string;
  toNodeName: string;
  asset: string;
  assetClass: AssetClass;
  side: Side;
  amount: number;
  price: number;
  status: TradeStatus;
  latencyMs: number;
  riskScore: number;
}

export interface AlertDTO {
  id: string;
  ts: number;
  level: AlertLevel;
  type: AlertType;
  tradeId: string | null;
  nodeId: string | null;
  message: string;
  handled: boolean;
  handledAt: number | null;
}

export interface KpiDTO {
  key: 'volume' | 'trades' | 'successRate' | 'activeNodes' | 'avgLatency' | 'riskIndex';
  label: string;
  value: number;
  unit: 'USD' | 'count' | 'pct' | 'ms' | 'index';
  deltaPct: number;
  trend: 'up' | 'down' | 'flat';
}

export interface TimeseriesPoint {
  ts: number;
  total: number;
  fx: number;
  equity: number;
  crypto: number;
  bond: number;
  commodity: number;
}

export interface TimeseriesDTO {
  range: WindowKey;
  bucketMs: number;
  points: TimeseriesPoint[];
}

export interface AssetShareDTO {
  assetClass: AssetClass;
  label: string;
  amount: number;
  tradeCount: number;
  pct: number;
}

export interface RegionDTO {
  country: string;
  countryCode: string;
  amount: number;
  tradeCount: number;
  pct: number;
  topNodeId: string;
}

export interface DepthDTO {
  asset: string;
  price: number;
  spread: number;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  generatedAt: number;
}

export interface HealthDTO {
  key: 'gateway' | 'matching' | 'clearing' | 'risk' | 'datalink';
  label: string;
  score: number;
  status: 'normal' | 'busy' | 'alert';
}

export interface MarketDTO {
  asset: string;
  assetClass: AssetClass;
  price: number;
  changePct: number;
  sparkline: number[];
}

export interface ArcDTO {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromNodeName: string;
  toNodeName: string;
  assetClass: AssetClass;
  status: TradeStatus;
  amount: number;
  count: number;
  maxLatency: number;
  riskScore: number;
  latestTs: number;
}

export interface StreamStatusDTO {
  paused: boolean;
  speed: number;
  intervalMs: number;
  clients: number;
  uptimeMs: number;
}

export interface MetaDTO {
  demo: true;
  seed: number;
  version: string;
  startedAt: number;
  stream: { paused: boolean; speed: number; intervalMs: number };
  clients: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiEnvelope<T> {
  data: T;
  serverTime: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    requestId?: string;
  };
  serverTime?: number;
}

export interface AuthPayload {
  token: string;
  expiresAt: number;
  user: User;
}

export interface TradeQuery {
  search?: string;
  assetClass?: AssetClass | null;
  status?: TradeStatus | null;
  side?: Side | null;
  nodeId?: string | null;
  country?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  from?: number | null;
  to?: number | null;
  sortBy?: 'ts' | 'amount' | 'price' | 'latencyMs' | 'riskScore';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ArcQuery {
  window?: WindowKey;
  assetClass?: AssetClass | null;
  status?: TradeStatus | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  nodeId?: string | null;
  country?: string | null;
  from?: number | null;
  to?: number | null;
  limit?: number;
}

export interface MapLayers {
  borders: boolean;
  grid: boolean;
  nodes: boolean;
  arcs: boolean;
  heat: boolean;
  labels: boolean;
}

export type MapAdapterEvent =
  | { type: 'arc-hover'; arcId: string | null }
  | { type: 'arc-click'; arcId: string }
  | { type: 'node-hover'; nodeId: string | null }
  | { type: 'node-click'; nodeId: string };

export interface MapNodePoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  status: NodeDTO['status'];
  volume24h: number;
}

export interface MapArcPoint {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  assetClass: AssetClass;
  status: TradeStatus;
  amount: number;
  count: number;
  maxLatency: number;
  fromNodeName: string;
  toNodeName: string;
}

export interface ToastItem {
  id: string;
  tone: 'info' | 'success' | 'warn' | 'danger';
  message: string;
}

export interface DrawerState {
  kind: 'trade' | 'node' | null;
  id: string | null;
}

export interface Preferences {
  theme: ThemeKey;
  motion: MotionMode;
  refreshMs: 1000 | 2000 | 5000;
  watermark: boolean;
}
