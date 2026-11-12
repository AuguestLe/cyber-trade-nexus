import { useMemo } from 'react';
import { HudCard } from '@/components/HudCard';
import { EChart } from '@/charts/EChart';
import { buildRadarOption } from '@/charts/options';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useConfigStore } from '@/store/configStore';
import { NODE_STATUS_COLORS } from '@/lib/theme';
import styles from '@/styles/dashboard.module.css';
import type { HealthDTO } from '@/types';

export function HealthPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: HealthDTO[];
  loading: boolean;
  error: string | null;
  onRetry(): void;
}) {
  const motion = useConfigStore((state) => state.motion);
  const option = useMemo(() => buildRadarOption(items, motion === 'reduced'), [items, motion]);
  const lowest = items.reduce((min, item) => (item.score < min ? item.score : min), 100);

  return (
    <HudCard
      code="D-09"
      title="系统状态雷达"
      en="HEALTH MATRIX"
      actions={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: lowest >= 92 ? 'var(--green)' : 'var(--amber)' }}>
          {lowest >= 92 ? 'ALL GREEN' : 'DEGRADED'}
        </span>
      }
    >
      {loading && <LoadingBlock height={160} rows={2} />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div className={styles.healthBody}>
          <div className={styles.radarBox}>
            <EChart option={option} className={styles.chartCanvas} ariaLabel="系统健康度雷达图" />
          </div>
          <div className={styles.healthList}>
            {items.map((item) => {
              const color = NODE_STATUS_COLORS[item.status === 'normal' ? 'normal' : item.status === 'busy' ? 'busy' : 'alert'];
              return (
                <div key={item.key} className={styles.healthRow}>
                  <span className={styles.healthName}>
                    <span className={styles.legendDot} style={{ background: color }} />
                    {item.label} / {item.key.toUpperCase()}
                  </span>
                  <span className={styles.healthScore} style={{ color }}>
                    {item.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </HudCard>
  );
}
