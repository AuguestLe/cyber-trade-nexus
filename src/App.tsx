import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { adminApi, dataApi } from '@/api/endpoints';
import { streamClient } from '@/api/sse';
import { ScaleStage } from '@/components/ScaleStage';
import { useFullscreen } from '@/hooks/useCountUp';
import { useHotkeys } from '@/hooks/useHotkeys';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AdminPage } from '@/pages/AdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { LoginPage } from '@/pages/LoginPage';
import { TradeMapPage } from '@/pages/TradeMapPage';
import { TradesPage } from '@/pages/TradesPage';
import { RequireAuth, RequireRole } from '@/routes/guards';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useStreamStore } from '@/store/streamStore';
import type { AlertDTO, KpiDTO, MarketDTO, MetaDTO, StreamStatusDTO, TradeDTO } from '@/types';

async function loadSnapshot(token: string): Promise<void> {
  const store = useStreamStore.getState();
  const [trades, alerts, markets, kpis, meta] = await Promise.allSettled([
    dataApi.trades(token, { pageSize: 200, sortBy: 'ts', sortDir: 'desc' }),
    dataApi.alerts(token, { limit: 80 }),
    dataApi.markets(token),
    dataApi.kpis(token, '24h'),
    dataApi.meta(token),
  ]);
  if (trades.status === 'fulfilled') store.hydrateSnapshot(trades.value.items, store.alerts);
  if (alerts.status === 'fulfilled') store.hydrateSnapshot(useStreamStore.getState().trades, alerts.value.items);
  if (markets.status === 'fulfilled') store.replaceMarkets(markets.value.items);
  if (kpis.status === 'fulfilled') store.replaceKpis(kpis.value.items);
  if (meta.status === 'fulfilled') {
    store.setMeta(meta.value);
    store.setStreamStatus({ ...meta.value.stream, clients: meta.value.clients, uptimeMs: 0 });
  }
}

export function App() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const { toggle: toggleFullscreen } = useFullscreen();

  useEffect(() => {
    if (!token) {
      streamClient.stop();
      useStreamStore.getState().resetStream();
      return undefined;
    }

    void loadSnapshot(token);
    streamClient.start(token, {
      onConnection: (state) => useStreamStore.getState().setConnection(state),
      onEvent: (event, data) => {
        const store = useStreamStore.getState();
        switch (event) {
          case 'hello': {
            const payload = data as { meta: MetaDTO; status: StreamStatusDTO };
            store.setMeta(payload.meta);
            store.setStreamStatus(payload.status);
            break;
          }
          case 'trade':
            store.pushTrade(data as TradeDTO);
            break;
          case 'alert':
            store.pushAlert(data as AlertDTO);
            break;
          case 'kpi':
            store.replaceKpis((data as { items: KpiDTO[] }).items);
            break;
          case 'market':
            store.replaceMarkets((data as { items: MarketDTO[] }).items);
            break;
          case 'status':
            store.setStreamStatus(data as StreamStatusDTO);
            break;
          default:
            break;
        }
      },
    });

    return () => streamClient.stop();
  }, [token]);

  useEffect(() => {
    const onExpired = () => {
      useAuthStore.getState().clear();
      useStreamStore.getState().resetStream();
      useUiStore.getState().toast('warn', '会话已过期，请重新登录');
      navigate('/login', { replace: true });
    };
    window.addEventListener('nexus:auth-expired', onExpired);
    return () => window.removeEventListener('nexus:auth-expired', onExpired);
  }, [navigate]);

  const hotkeys = useMemo(
    () => ({
      onPage: (index: number) => {
        const targets = ['/', '/map', '/trades', '/admin'];
        const target = targets[index - 1];
        if (!target) return;
        const user = useAuthStore.getState().user;
        if (target === '/admin' && user?.role !== 'admin') {
          useUiStore.getState().toast('warn', '控制台仅对管理员开放');
          return;
        }
        navigate(target);
      },
      onPauseToggle: () => {
        const user = useAuthStore.getState().user;
        const sessionToken = useAuthStore.getState().token;
        if (!user || user.role !== 'admin' || !sessionToken) {
          useUiStore.getState().toast('warn', '只读模式：仅管理员可暂停数据流');
          return;
        }
        const paused = useStreamStore.getState().streamStatus?.paused ?? false;
        adminApi
          .stream(sessionToken, { paused: !paused })
          .then((result) => {
            useStreamStore.getState().setStreamStatus(result.stream);
            useUiStore.getState().toast('info', result.stream.paused ? '数据流已暂停' : '数据流已恢复');
          })
          .catch(() => useUiStore.getState().toast('danger', '数据流控制失败'));
      },
      onFullscreen: () => void toggleFullscreen(),
      onEscape: () => closeDrawer(),
    }),
    [navigate, closeDrawer, toggleFullscreen],
  );

  useHotkeys(hotkeys);

  return (
    <ScaleStage>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<TradeMapPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AdminPage />
                </RequireRole>
              }
            />
            <Route path="/403" element={<ForbiddenPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ScaleStage>
  );
}
