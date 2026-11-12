import { useMemo } from 'react';
import { HudCard } from '@/components/HudCard';
import { EChart, type ChartEventParams } from '@/charts/EChart';
import { buildRegionBarOption } from '@/charts/options';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useConfigStore } from '@/store/configStore';
import styles from '@/styles/dashboard.module.css';
import type { RegionDTO } from '@/types';

export function RegionPanel({
  items,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  items: RegionDTO[];
  loading: boolean;
  error: string | null;
  onRetry(): void;
  onSelect(region: RegionDTO): void;
}) {
  const motion = useConfigStore((state) => state.motion);
  const option = useMemo(() => buildRegionBarOption(items, motion === 'reduced'), [items, motion]);
  const onEvents = useMemo(
    () => ({
      click: (params: ChartEventParams) => {
        const index = params.dataIndex ?? 0;
        const region = items[index];
        if (region) onSelect(region);
      },
    }),
    [items, onSelect],
  );

  return (
    <HudCard
      code="D-07"
      title="地区成交排行"
      en="TOP 08"
      actions={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>NOTIONAL</span>}
    >
      {loading && <LoadingBlock height={280} rows={2} />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && items.length === 0 && (
        <div className={styles.depthMeta}>暂无地区成交数据</div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className={styles.regionChart}>
          <EChart option={option} className={styles.chartCanvas} onEvents={onEvents} ariaLabel="地区成交排行" />
        </div>
      )}
    </HudCard>
  );
}
