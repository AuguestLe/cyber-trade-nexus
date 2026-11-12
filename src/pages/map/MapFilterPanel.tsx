import { useState } from 'react';
import { X } from 'lucide-react';
import { Segmented } from '@/components/Segmented';
import { Toggle } from '@/components/Toggle';
import { useFilterStore } from '@/store/filterStore';
import {
  ASSET_CLASS_COLORS,
  ASSET_CLASS_LABELS,
  ASSET_CLASS_ORDER,
} from '@/lib/theme';
import styles from '@/styles/map.module.css';
import type { MapLayers, TradeStatus, WindowKey } from '@/types';

const RANGES: Array<{ value: WindowKey; label: string }> = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
];

const STATUSES: Array<{ value: TradeStatus; label: string }> = [
  { value: 'filled', label: 'FILLED' },
  { value: 'pending', label: 'PENDING' },
  { value: 'failed', label: 'FAILED' },
  { value: 'flagged', label: 'FLAGGED' },
];

const LAYER_ROWS: Array<{ key: keyof MapLayers; label: string; en: string }> = [
  { key: 'borders', label: '国界', en: 'BORDERS' },
  { key: 'grid', label: '网格', en: 'GRID' },
  { key: 'nodes', label: '节点', en: 'NODES' },
  { key: 'arcs', label: '连线', en: 'ROUTES' },
  { key: 'labels', label: '标签', en: 'LABELS' },
];

interface MapFilterPanelProps {
  layers: MapLayers;
  onLayersChange(layers: MapLayers): void;
  heat: 'off' | 'routes' | 'amount';
  onHeatChange(mode: 'off' | 'routes' | 'amount'): void;
  nodeLabel: string | null;
  matched: number;
  onReset(): void;
}

export function MapFilterPanel({
  layers,
  onLayersChange,
  heat,
  onHeatChange,
  nodeLabel,
  matched,
  onReset,
}: MapFilterPanelProps) {
  const range = useFilterStore((state) => state.range);
  const setRange = useFilterStore((state) => state.setRange);
  const assetClass = useFilterStore((state) => state.assetClass);
  const setAssetClass = useFilterStore((state) => state.setAssetClass);
  const status = useFilterStore((state) => state.status);
  const setStatus = useFilterStore((state) => state.setStatus);
  const nodeId = useFilterStore((state) => state.nodeId);
  const setNode = useFilterStore((state) => state.setNode);
  const minAmount = useFilterStore((state) => state.minAmount);
  const maxAmount = useFilterStore((state) => state.maxAmount);
  const setAmountRange = useFilterStore((state) => state.setAmountRange);
  const hidden = useFilterStore((state) => state.hiddenAssetClasses);
  const toggleAssetClass = useFilterStore((state) => state.toggleAssetClass);

  const [minDraft, setMinDraft] = useState(minAmount == null ? '' : String(minAmount));
  const [maxDraft, setMaxDraft] = useState(maxAmount == null ? '' : String(maxAmount));

  const applyAmount = () => {
    const min = minDraft === '' ? null : Math.max(0, Number(minDraft));
    const max = maxDraft === '' ? null : Math.max(0, Number(maxDraft));
    if (min != null && max != null && min > max) {
      setAmountRange(max, min);
      return;
    }
    setAmountRange(min, max);
  };

  return (
    <aside className={styles.panel} aria-label="地图筛选">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>
          线路筛选 <b>/ SCOPE</b>
        </span>
        <span className={styles.panelCode}>F-01</span>
      </header>

      <div className={styles.panelBody}>
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>TIME WINDOW / 时间窗口</span>
            <span>1 / 6 / 24H</span>
          </div>
          <Segmented options={RANGES} value={range} onChange={setRange} ariaLabel="地图时间窗口" />
        </section>

        {nodeId && (
          <section className={styles.section}>
            <div className={styles.sectionLabel}>
              <span>RELATED TO / 关联节点</span>
              <span>FILTER</span>
            </div>
            <div className={styles.nodeChip}>
              <span>{nodeLabel ?? nodeId}</span>
              <button type="button" aria-label="清除节点筛选" onClick={() => setNode(null, null)}>
                <X size={11} />
              </button>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>ASSET CLASS / 资产类别</span>
            <span>6 GROUPS</span>
          </div>
          <div className={styles.chipGrid}>
            <button
              type="button"
              className={`${styles.chip} ${assetClass === null ? styles.chipActive : ''}`}
              onClick={() => setAssetClass(null)}
            >
              全部 / ALL
            </button>
            {ASSET_CLASS_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.chip} ${assetClass === item ? styles.chipActive : ''}`}
                onClick={() => setAssetClass(assetClass === item ? null : item)}
              >
                <span
                  className={styles.chipDot}
                  style={{ background: ASSET_CLASS_COLORS[item] }}
                />
                {ASSET_CLASS_LABELS[item]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>TRADE STATUS / 状态</span>
            <span>ALL / MIXED</span>
          </div>
          <div className={styles.chipGrid}>
            <button
              type="button"
              className={`${styles.chip} ${status === null ? styles.chipActive : ''}`}
              onClick={() => setStatus(null)}
            >
              全部 / ALL
            </button>
            {STATUSES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`${styles.chip} ${status === item.value ? styles.chipActive : ''}`}
                onClick={() => setStatus(status === item.value ? null : item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>NOTIONAL RANGE / 金额区间</span>
            <span>USD</span>
          </div>
          <div className={styles.amountRow}>
            <input
              className={styles.amountInput}
              value={minDraft}
              inputMode="numeric"
              placeholder="MIN"
              onChange={(event) => setMinDraft(event.target.value.replace(/[^0-9]/g, ''))}
              aria-label="最小金额"
            />
            <span className={styles.amountUnit}>—</span>
            <input
              className={styles.amountInput}
              value={maxDraft}
              inputMode="numeric"
              placeholder="MAX"
              onChange={(event) => setMaxDraft(event.target.value.replace(/[^0-9]/g, ''))}
              aria-label="最大金额"
            />
            <button type="button" className={styles.applyBtn} onClick={applyAmount}>
              应用
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>MAP LAYERS / 图层</span>
            <span>6 SWITCHES</span>
          </div>
          {LAYER_ROWS.map((row) => (
            <div key={row.key} className={styles.layerRow}>
              <span>{row.label}</span>
              <span className={styles.layerRowEn}>{row.en}</span>
              <Toggle
                checked={layers[row.key]}
                onChange={(next) => onLayersChange({ ...layers, [row.key]: next })}
              />
            </div>
          ))}
          <div className={styles.layerRow}>
            <span>热力</span>
            <span className={styles.layerRowEn}>HEATMAP</span>
            <Segmented
              options={[
                { value: 'off', label: 'OFF' },
                { value: 'routes', label: '航线' },
                { value: 'amount', label: '金额' },
              ]}
              value={heat}
              onChange={onHeatChange}
              ariaLabel="热力模式"
            />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            <span>LEGEND / 图例显隐</span>
            <span>CLICK</span>
          </div>
          {ASSET_CLASS_ORDER.map((item) => {
            const off = hidden.includes(item);
            return (
              <button
                key={item}
                type="button"
                className={styles.layerRow}
                style={{ opacity: off ? 0.35 : 1, textAlign: 'left' }}
                onClick={() => toggleAssetClass(item)}
                aria-pressed={!off}
              >
                <span
                  className={styles.chipDot}
                  style={{ background: ASSET_CLASS_COLORS[item], marginRight: 6 }}
                />
                <span>{ASSET_CLASS_LABELS[item]}</span>
                <span className={styles.layerRowEn}>{item.toUpperCase()}</span>
              </button>
            );
          })}
        </section>
      </div>

      <footer className={styles.panelFoot}>
        <span>MATCHED {matched}</span>
        <button type="button" className={styles.resetLink} onClick={onReset}>
          RESET FILTERS ↺
        </button>
      </footer>
    </aside>
  );
}
