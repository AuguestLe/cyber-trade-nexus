import { useMemo } from 'react';
import { HudCard } from '@/components/HudCard';
import { EChart } from '@/charts/EChart';
import { buildVolumeOption } from '@/charts/options';
import { Segmented } from '@/components/Segmented';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useConfigStore } from '@/store/configStore';
import { useFilterStore } from '@/store/filterStore';
import { ASSET_CLASS_COLORS, ASSET_CLASS_EN, ASSET_CLASS_ORDER } from '@/lib/theme';
import styles from '@/styles/dashboard.module.css';
import type { TimeseriesDTO, WindowKey } from '@/types';

const RANGE_OPTIONS: Array<{ value: WindowKey; label: string }> = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
];

interface VolumeChartProps {
  data: TimeseriesDTO | null;
  loading: boolean;
  error: string | null;
  onRetry(): void;
}

export function VolumeChart({ data, loading, error, onRetry }: VolumeChartProps) {
  const range = useFilterStore((state) => state.range);
  const setRange = useFilterStore((state) => state.setRange);
  const hidden = useFilterStore((state) => state.hiddenAssetClasses);
  const toggleAssetClass = useFilterStore((state) => state.toggleAssetClass);
  const motion = useConfigStore((state) => state.motion);

  const option = useMemo(
    () =>
      data
        ? buildVolumeOption(data.points, hidden, motion === 'reduced')
        : buildVolumeOption([], hidden, motion === 'reduced'),
    [data, hidden, motion],
  );

  const rangeControl = (
    <Segmented
      options={RANGE_OPTIONS}
      value={range}
      onChange={(value) => setRange(value)}
      ariaLabel="主图时间范围"
    />
  );

  return (
    <HudCard code="D-02" title="分时成交额主图" en="TURNOVER MATRIX" actions={rangeControl}>
      <div className={styles.chartLegend}>
        {ASSET_CLASS_ORDER.map((assetClass) => {
          const off = hidden.includes(assetClass);
          return (
            <button
              key={assetClass}
              type="button"
              className={`${styles.legendChip} ${off ? styles.legendChipOff : ''}`}
              style={{ color: ASSET_CLASS_COLORS[assetClass] }}
              onClick={() => toggleAssetClass(assetClass)}
              aria-pressed={!off}
            >
              <span className={styles.legendDot} style={{ background: ASSET_CLASS_COLORS[assetClass] }} />
              {ASSET_CLASS_EN[assetClass]}
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {data ? `${data.points.length} BUCKETS · ${data.bucketMs / 60000}MIN` : 'STREAM OFFLINE'}
        </span>
      </div>
      <div className={styles.chartBox}>
        {loading && <LoadingBlock height={260} rows={2} />}
        {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
        {!loading && !error && (
          <EChart
            option={option}
            className={styles.chartCanvas}
            ariaLabel="分时成交额主图"
          />
        )}
      </div>
    </HudCard>
  );
}
