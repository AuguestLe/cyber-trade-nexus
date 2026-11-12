import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { HudCard } from '@/components/HudCard';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useCountUp } from '@/hooks/useCountUp';
import { formatNumber, formatUsdCompact } from '@/lib/format';
import styles from '@/styles/dashboard.module.css';
import type { KpiDTO } from '@/types';

interface KpiStripProps {
  items: KpiDTO[];
  loading: boolean;
  error: string | null;
  active: string | null;
  onSelect(key: string): void;
  onRetry(): void;
}

function renderValue(kpi: KpiDTO, value: number): { text: string; unit: string } {
  switch (kpi.unit) {
    case 'USD':
      return { text: formatUsdCompact(value), unit: 'USD' };
    case 'pct':
      return { text: value.toFixed(2), unit: '%' };
    case 'ms':
      return { text: String(Math.round(value)), unit: 'MS' };
    case 'index':
      return { text: value.toFixed(1), unit: '/100' };
    default:
      return { text: formatNumber(value), unit: 'NODES' };
  }
}

function favorable(kpi: KpiDTO): boolean {
  const negativeMetric = kpi.key === 'avgLatency' || kpi.key === 'riskIndex';
  if (kpi.trend === 'flat') return true;
  return negativeMetric ? kpi.trend === 'down' : kpi.trend === 'up';
}

function KpiCard({
  kpi,
  active,
  onSelect,
}: {
  kpi: KpiDTO;
  active: boolean;
  onSelect(): void;
}) {
  const animated = useCountUp(kpi.value);
  const display = renderValue(kpi, animated);
  const DeltaIcon = kpi.trend === 'up' ? ArrowUpRight : kpi.trend === 'down' ? ArrowDownRight : Minus;
  const tone =
    kpi.trend === 'flat' ? 'kpiDeltaFlat' : favorable(kpi) ? 'kpiDeltaGood' : 'kpiDeltaBad';

  return (
    <button
      type="button"
      className={`${styles.kpiCard} ${active ? styles.kpiCardActive : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{kpi.label}</span>
        <span className={styles.kpiCode}>{kpi.key.toUpperCase()}</span>
      </div>
      <div className={styles.kpiValue}>
        {display.text}
        <span className={styles.kpiUnit}>{display.unit}</span>
      </div>
      <div className={styles.kpiFoot}>
        <span className={`${styles[tone]} ${styles.kpiDelta}`}>
          <DeltaIcon size={10} style={{ verticalAlign: '-1px' }} />{' '}
          {kpi.trend === 'flat' ? '0.0' : kpi.deltaPct.toFixed(1)}%
        </span>
        <span className={styles.kpiMeta}>VS PREV</span>
      </div>
    </button>
  );
}

export function KpiStrip({ items, loading, error, active, onSelect, onRetry }: KpiStripProps) {
  const actions = useMemo(() => <span className={styles.kpiMeta}>AGGREGATED WINDOW</span>, []);

  return (
    <HudCard code="D-01" title="核心指标" en="CORE PULSE" actions={actions}>
      {loading && <LoadingBlock height={220} rows={3} />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div className={styles.kpiGrid}>
          {items.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} active={active === kpi.key} onSelect={() => onSelect(kpi.key)} />
          ))}
        </div>
      )}
    </HudCard>
  );
}
