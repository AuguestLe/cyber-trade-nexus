import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useFilterStore } from '@/store/filterStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { useResource } from '@/hooks/useResource';
import { dataApi } from '@/api/endpoints';
import { KpiStrip } from './dashboard/KpiStrip';
import { VolumeChart } from './dashboard/VolumeChart';
import { MiniWorldMap } from './dashboard/MiniWorldMap';
import { AssetPanel } from './dashboard/AssetPanel';
import { RegionPanel } from './dashboard/RegionPanel';
import { DepthPanel } from './dashboard/DepthPanel';
import { HealthPanel } from './dashboard/HealthPanel';
import { LiveTape, AlertFeed } from './dashboard/LiveTape';
import styles from '@/styles/dashboard.module.css';
import type { RegionDTO } from '@/types';

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const range = useFilterStore((state) => state.range);
  const activeKpi = useFilterStore((state) => state.activeKpi);
  const setActiveKpi = useFilterStore((state) => state.setActiveKpi);
  const setStatus = useFilterStore((state) => state.setStatus);
  const setCountry = useFilterStore((state) => state.setCountry);
  const refreshMs = useConfigStore((state) => state.refreshMs);
  const streamKpis = useStreamStore((state) => state.kpis);
  const trades = useStreamStore((state) => state.trades);
  const toast = useUiStore((state) => state.toast);

  const kpiRes = useResource(
    (signal) => dataApi.kpis(token ?? '', range, signal),
    [token, range],
    { enabled: Boolean(token), refreshMs },
  );
  const seriesRes = useResource(
    (signal) => dataApi.timeseries(token ?? '', range, signal),
    [token, range],
    { enabled: Boolean(token), refreshMs },
  );
  const sharesRes = useResource(
    (signal) => dataApi.assetShares(token ?? '', range, signal),
    [token, range],
    { enabled: Boolean(token), refreshMs },
  );
  const regionRes = useResource(
    (signal) => dataApi.regions(token ?? '', range, 8, signal),
    [token, range],
    { enabled: Boolean(token), refreshMs },
  );
  const healthRes = useResource(
    (signal) => dataApi.health(token ?? '', signal),
    [token],
    { enabled: Boolean(token), refreshMs },
  );
  const nodesRes = useResource(
    (signal) => dataApi.nodes(token ?? '', signal),
    [token],
    { enabled: Boolean(token), refreshMs: 30_000 },
  );

  const liveKpis = range === '24h' && streamKpis.length > 0 ? streamKpis : null;
  const kpis = liveKpis ?? kpiRes.data?.items ?? [];

  const handleKpi = (key: string) => {
    setActiveKpi(activeKpi === key ? null : key);
    setStatus(key === 'riskIndex' ? 'flagged' : null);
    toast('info', `已按 ${key.toUpperCase()} 联动筛选`);
  };

  const handleRegion = (region: RegionDTO) => {
    setCountry(region.country);
    toast('info', `已筛出 ${region.country} 地区成交`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.leftCol}>
        <KpiStrip
          items={kpis}
          loading={kpiRes.loading && !liveKpis}
          error={kpiRes.error}
          active={activeKpi}
          onSelect={handleKpi}
          onRetry={kpiRes.reload}
        />
        <AssetPanel
          items={sharesRes.data?.items ?? []}
          loading={sharesRes.loading}
          error={sharesRes.error}
          onRetry={sharesRes.reload}
        />
        <RegionPanel
          items={regionRes.data?.items ?? []}
          loading={regionRes.loading}
          error={regionRes.error}
          onRetry={regionRes.reload}
          onSelect={handleRegion}
        />
      </div>

      <div className={styles.centerCol}>
        <VolumeChart
          data={seriesRes.data}
          loading={seriesRes.loading}
          error={seriesRes.error}
          onRetry={seriesRes.reload}
        />
        <MiniWorldMap
          nodes={nodesRes.data?.nodes ?? []}
          trades={trades}
          loading={nodesRes.loading}
        />
        <DepthPanel />
      </div>

      <div className={styles.rightCol}>
        <LiveTape />
        <AlertFeed />
        <HealthPanel
          items={healthRes.data?.items ?? []}
          loading={healthRes.loading}
          error={healthRes.error}
          onRetry={healthRes.reload}
        />
      </div>
    </div>
  );
}
