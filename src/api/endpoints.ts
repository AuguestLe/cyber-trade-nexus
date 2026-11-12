import { request } from './client';
import type {
  AlertDTO,
  ArcDTO,
  ArcQuery,
  AssetShareDTO,
  AuthPayload,
  DepthDTO,
  HealthDTO,
  KpiDTO,
  MarketDTO,
  MetaDTO,
  NodeDTO,
  PageResult,
  RegionDTO,
  StreamStatusDTO,
  TimeseriesDTO,
  TradeDTO,
  TradeQuery,
  User,
  WindowKey,
} from '@/types';

export const authApi = {
  login: (username: string, password: string, remember: boolean) =>
    request<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: { username, password, remember },
    }),
  session: (token: string) =>
    request<{ user: User; expiresAt: number }>('/api/auth/session', { token }),
  logout: (token: string) => request<{ ok: true }>('/api/auth/logout', { method: 'POST', token }),
  impersonate: (token: string, userId: string) =>
    request<AuthPayload>('/api/auth/impersonate', { method: 'POST', token, body: { userId } }),
};

export const dataApi = {
  meta: (token: string) => request<MetaDTO>('/api/meta', { token }),
  nodes: (token: string, signal?: AbortSignal) =>
    request<{ nodes: NodeDTO[] }>('/api/nodes', { token, signal }),
  trades: (token: string, query: TradeQuery, signal?: AbortSignal) =>
    request<PageResult<TradeDTO>>('/api/trades', { token, query: { ...query }, signal }),
  trade: (token: string, id: string, signal?: AbortSignal) =>
    request<{ trade: TradeDTO }>(`/api/trades/${encodeURIComponent(id)}`, { token, signal }),
  alerts: (
    token: string,
    params: { level?: string | null; handled?: boolean | null; limit?: number } = {},
  ) => request<{ items: AlertDTO[] }>('/api/alerts', { token, query: params }),
  kpis: (token: string, windowKey: WindowKey, signal?: AbortSignal) =>
    request<{ window: WindowKey; items: KpiDTO[] }>('/api/kpis', { token, query: { window: windowKey }, signal }),
  timeseries: (token: string, range: WindowKey, signal?: AbortSignal) =>
    request<TimeseriesDTO>('/api/timeseries', { token, query: { range }, signal }),
  assetShares: (token: string, windowKey: WindowKey, signal?: AbortSignal) =>
    request<{ window: WindowKey; items: AssetShareDTO[] }>('/api/aggregations/assets', {
      token,
      query: { window: windowKey },
      signal,
    }),
  regions: (token: string, windowKey: WindowKey, limit = 8, signal?: AbortSignal) =>
    request<{ items: RegionDTO[] }>('/api/aggregations/regions', {
      token,
      query: { window: windowKey, limit },
      signal,
    }),
  depth: (token: string, asset: string, signal?: AbortSignal) =>
    request<DepthDTO>('/api/aggregations/depth', { token, query: { asset }, signal }),
  health: (token: string, signal?: AbortSignal) =>
    request<{ items: HealthDTO[] }>('/api/aggregations/health', { token, signal }),
  arcs: (token: string, query: ArcQuery, signal?: AbortSignal) =>
    request<{ window: WindowKey; items: ArcDTO[]; truncated: boolean }>('/api/aggregations/arcs', {
      token,
      query: { ...query },
      signal,
    }),
  markets: (token: string, signal?: AbortSignal) =>
    request<{ items: MarketDTO[] }>('/api/markets', { token, signal }),
};

export const adminApi = {
  users: (token: string) => request<{ items: User[] }>('/api/admin/users', { token }),
  updateUser: (token: string, id: string, patch: { enabled?: boolean; role?: string }) =>
    request<{ user: User }>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: patch,
    }),
  stream: (token: string, patch: { paused?: boolean; speed?: number }) =>
    request<{ stream: StreamStatusDTO }>('/api/admin/stream', { method: 'PATCH', token, body: patch }),
  inject: (token: string, type: string, assetClass?: string, nodeId?: string) =>
    request<{ created: { trade: TradeDTO; alert: AlertDTO } }>('/api/admin/inject', {
      method: 'POST',
      token,
      body: { type, assetClass, nodeId },
    }),
  reset: (token: string, seed?: number) =>
    request<{ meta: MetaDTO }>('/api/admin/reset', { method: 'POST', token, body: seed ? { seed } : {} }),
  clear: (token: string) =>
    request<{ cleared: { trades: number; alerts: number } }>('/api/admin/clear', { method: 'POST', token }),
  handleAlert: (token: string, id: string, handled: boolean) =>
    request<{ alert: AlertDTO }>(`/api/admin/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: { handled },
    }),
};
