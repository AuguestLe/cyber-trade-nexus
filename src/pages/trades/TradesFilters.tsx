import { MapPin, RotateCcw, Search, X } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { NeonButton } from '@/components/NeonButton';
import { formatNumber } from '@/lib/format';
import { ASSET_CLASS_EN, ASSET_CLASS_LABELS, ASSET_CLASS_ORDER } from '@/lib/theme';
import type { AssetClass, Side, TradeStatus } from '@/types';
import type { TradeFilterValues } from './tradeRows';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/trades.module.css';

interface TradesFiltersProps {
  filters: TradeFilterValues;
  searchValue: string;
  amountMinText: string;
  amountMaxText: string;
  total: number;
  loadedCount: number;
  busy: boolean;
  onSearchChange(value: string): void;
  onAssetClassChange(value: AssetClass | null): void;
  onSideChange(value: Side | null): void;
  onStatusChange(value: TradeStatus | null): void;
  onAmountMinChange(value: string): void;
  onAmountMaxChange(value: string): void;
  onAmountCommit(): void;
  onReset(): void;
  onClearNode(): void;
}

interface StatusOption {
  value: TradeStatus | null;
  label: string;
  tone: string | undefined;
  toneActive: string | undefined;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: null, label: '全部 / ALL', tone: undefined, toneActive: styles.chipActive },
  { value: 'filled', label: 'FILLED', tone: styles.chipFilled, toneActive: styles.chipFilled },
  { value: 'pending', label: 'PENDING', tone: styles.chipPending, toneActive: styles.chipPending },
  { value: 'failed', label: 'FAILED', tone: styles.chipFailed, toneActive: styles.chipFailed },
  { value: 'flagged', label: 'FLAGGED', tone: styles.chipFlagged, toneActive: styles.chipFlagged },
];

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function parseSide(value: string): Side | null {
  if (value === 'buy' || value === 'sell') return value;
  return null;
}

function isAssetClass(value: string): value is AssetClass {
  return (ASSET_CLASS_ORDER as string[]).includes(value);
}

export function TradesFilters({
  filters,
  searchValue,
  amountMinText,
  amountMaxText,
  total,
  loadedCount,
  busy,
  onSearchChange,
  onAssetClassChange,
  onSideChange,
  onStatusChange,
  onAmountMinChange,
  onAmountMaxChange,
  onAmountCommit,
  onReset,
  onClearNode,
}: TradesFiltersProps) {
  const handleAssetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onAssetClassChange(isAssetClass(value) ? value : null);
  };

  const handleSideChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSideChange(parseSide(event.target.value));
  };

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      onAmountCommit();
    }
  };

  return (
    <section className={styles.filterBar} aria-label="交易筛选">
      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Search size={13} className={styles.searchIcon} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="交易 ID / 资产 / 节点名"
            aria-label="搜索交易 ID、资产或节点名"
            spellCheck={false}
          />
        </div>

        <select
          className={classNames(ui.select, styles.filterSelect)}
          value={filters.assetClass ?? ''}
          onChange={handleAssetChange}
          aria-label="资产类别筛选"
        >
          <option value="">资产类别: 全部</option>
          {ASSET_CLASS_ORDER.map((assetClass) => (
            <option key={assetClass} value={assetClass}>
              {ASSET_CLASS_LABELS[assetClass]} / {ASSET_CLASS_EN[assetClass]}
            </option>
          ))}
        </select>

        <select
          className={classNames(ui.select, styles.filterSelect)}
          value={filters.side ?? ''}
          onChange={handleSideChange}
          aria-label="交易方向筛选"
        >
          <option value="">方向: 全部</option>
          <option value="buy">买入 / BUY</option>
          <option value="sell">卖出 / SELL</option>
        </select>

        <div className={styles.statusChips} role="group" aria-label="交易状态筛选">
          {STATUS_OPTIONS.map((option) => {
            const active = filters.status === option.value;
            return (
              <button
                key={option.label}
                type="button"
                className={classNames(
                  styles.chip,
                  option.tone,
                  active && option.toneActive,
                  active && styles.chipActive,
                )}
                onClick={() => onStatusChange(option.value)}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className={styles.filterSpacer} />

        <NeonButton
          variant="ghost"
          size="sm"
          icon={<RotateCcw size={11} aria-hidden />}
          onClick={onReset}
          aria-label="重置全部筛选"
        >
          重置 / RESET
        </NeonButton>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.amountLabel}>金额区间 / NOTIONAL RANGE</span>
        <input
          type="number"
          min={0}
          step="any"
          className={classNames(ui.input, styles.amountInput)}
          value={amountMinText}
          onChange={(event) => onAmountMinChange(event.target.value)}
          onBlur={onAmountCommit}
          onKeyDown={handleAmountKeyDown}
          placeholder="MIN USD"
          aria-label="金额下限（USD）"
        />
        <span className={styles.amountDash}>→</span>
        <input
          type="number"
          min={0}
          step="any"
          className={classNames(ui.input, styles.amountInput)}
          value={amountMaxText}
          onChange={(event) => onAmountMaxChange(event.target.value)}
          onBlur={onAmountCommit}
          onKeyDown={handleAmountKeyDown}
          placeholder="MAX USD"
          aria-label="金额上限（USD）"
        />

        {filters.nodeId && (
          <button
            type="button"
            className={styles.nodeChip}
            onClick={onClearNode}
            aria-label={`清除节点筛选 ${filters.nodeId}`}
            title="点击清除节点筛选"
          >
            <MapPin size={11} aria-hidden />
            <span>节点 / NODE {filters.nodeId}</span>
            <X size={10} className={styles.nodeChipClose} aria-hidden />
          </button>
        )}

        <span className={styles.matchInfo}>
          匹配 <b>{formatNumber(total)}</b> 条 · 已加载 <b>{formatNumber(loadedCount)}</b> 行
          {busy ? <strong> · 同步中…</strong> : null}
        </span>
      </div>
    </section>
  );
}
