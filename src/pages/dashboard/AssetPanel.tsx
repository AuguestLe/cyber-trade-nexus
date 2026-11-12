import { useMemo } from 'react';
import { HudCard } from '@/components/HudCard';
import { EChart } from '@/charts/EChart';
import { buildAssetDonutOption } from '@/charts/options';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useConfigStore } from '@/store/configStore';
import { useFilterStore } from '@/store/filterStore';
import { formatUsdCompact } from '@/lib/format';
import { ASSET_CLASS_COLORS } from '@/lib/theme';
import styles from '@/styles/dashboard.module.css';
import type { AssetShareDTO } from '@/types';

export function AssetPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: AssetShareDTO[];
  loading: boolean;
  error: string | null;
  onRetry(): void;
}) {
  const hidden = useFilterStore((state) => state.hiddenAssetClasses);
  const toggle = useFilterStore((state) => state.toggleAssetClass);
  const motion = useConfigStore((state) => state.motion);

  const visibleItems = items.filter((item) => !hidden.includes(item.assetClass));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const option = useMemo(
    () => buildAssetDonutOption(visibleItems, motion === 'reduced'),
    [visibleItems, motion],
  );

  return (
    <HudCard
      code="D-06"
      title="资产类别占比"
      en="EXPOSURE"
      actions={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>24H NOTIONAL</span>}
    >
      {loading && <LoadingBlock height={170} rows={2} />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div className={styles.assetBody}>
          <div className={styles.donutBox}>
            <EChart option={option} className={styles.chartCanvas} ariaLabel="资产类别占比环形图" />
            <div className={styles.donutCenter}>
              <div className={styles.donutValue}>{formatUsdCompact(total)}</div>
              <div className={styles.donutLabel}>24H NOTIONAL</div>
            </div>
          </div>
          <div className={styles.assetLegend}>
            {items.map((item) => {
              const off = hidden.includes(item.assetClass);
              return (
                <button
                  key={item.assetClass}
                  type="button"
                  className={`${styles.assetRow} ${off ? styles.assetRowOff : ''}`}
                  onClick={() => toggle(item.assetClass)}
                  aria-pressed={!off}
                >
                  <span className={styles.legendDot} style={{ background: ASSET_CLASS_COLORS[item.assetClass] }} />
                  <span className={styles.assetName}>
                    {item.label} / {item.assetClass.toUpperCase()}
                  </span>
                  <span className={styles.assetPct}>{item.pct.toFixed(1)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </HudCard>
  );
}
