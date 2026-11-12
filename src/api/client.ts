import type { ApiEnvelope, ApiErrorBody } from '@/types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | null;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * 唯一网络出口：统一信封解析、错误归一化、401 广播。
 * 页面禁止直接调用 fetch。
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, query } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', '无法连接 Mock 服务，请确认 API 进程已启动', 0, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  let payload: ApiEnvelope<T> | ApiErrorBody | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T> | ApiErrorBody;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    const code = errorBody?.error?.code ?? 'HTTP_ERROR';
    const message = errorBody?.error?.message ?? `请求失败（HTTP ${response.status}）`;
    if (response.status === 401 && !path.endsWith('/login')) {
      window.dispatchEvent(new CustomEvent('nexus:auth-expired'));
    }
    throw new ApiError(code, message, response.status, errorBody?.error?.details ?? null);
  }

  if (!payload || !('data' in payload)) {
    throw new ApiError('BAD_RESPONSE', '服务返回了非预期格式', response.status);
  }
  return payload.data;
}
