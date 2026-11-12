import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload(): void;
}

interface ResourceOptions {
  enabled?: boolean;
  refreshMs?: number;
}

/**
 * 统一请求生命周期：可取消、静默轮询、错误归一化、手动重试。
 * deps 变化时重建请求；refreshMs 轮询不会闪烁 loading。
 */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: ResourceOptions = {},
): Resource<T> {
  const { enabled = true, refreshMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;

    const run = async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const result = await loader(controller.signal);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : '数据加载失败');
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    void run(false);
    const timer = refreshMs ? window.setInterval(() => void run(true), refreshMs) : undefined;

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, refreshMs, reloadKey]);

  return { data, loading, error, reload };
}
