import { ArrowDown, ArrowUp, ArrowUpDown, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, UIEvent } from 'react';
import { NeonButton } from '@/components/NeonButton';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/States';
import { StatusTag } from '@/components/StatusTag';
import {
  formatClockMs,
  formatDate,
  formatLatency,
  formatPrice,
  formatUsdCompact,
} from '@/lib/format';
import { ASSET_CLASS_EN } from '@/lib/theme';
import type { TradeDTO } from '@/types';
import {
  computeVirtualWindow,
  riskBarWidth,
  riskTone,
  type RiskTone,
  type TradeSortBy,
  type TradeSortDir,
  type TradeSortState,
} from './tradeRows';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/trades.module.css';

const ROW_HEIGHT = 48;
const OVERSCAN = 6;
const LOAD_MORE_THRESHOLD = 360;

interface TradesTableProps {
  rows: TradeDTO[];
  total: number;
  loading: boolean;
  hydrating: boolean;
  loadingMore: boolean;
  error: string | null;
  selectedId: string | null;
  sort: TradeSortState;
  resetKey: string;
  onSortChange(sortBy: TradeSortBy, sortDir: TradeSortDir): void;
  onRowClick(id: string): void;
  onCopyId(id: string): void;
  onLoadMore(): void;
  onRetry(): void;
  onResetFilters(): void;
}

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const RISK_CLASS: Record<RiskTone, string | undefined> = {
  low: styles.riskLow,
  med: styles.riskMed,
  high: styles.riskHigh,
  critical: styles.riskCritical,
};

interface SortHeaderProps {
  field: TradeSortBy;
  label: string;
  en: string;
  sort: TradeSortState;
  align?: 'left' | 'right';
  onSortChange(sortBy: TradeSortBy, sortDir: TradeSortDir): void;
}

function SortHeader({ field, label, en, sort, align = 'left', onSortChange }: SortHeaderProps) {
  const active = sort.sortBy === field;
  const Icon = active ? (sort.sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const nextDir: TradeSortDir = active && sort.sortDir === 'desc' ? 'asc' : 'desc';

  return (
    <button
      type="button"
      className={classNames(styles.th, styles.thSort, align === 'right' && styles.thRight, active && styles.thActive)}
      onClick={() => onSortChange(field, nextDir)}
      aria-label={`按${label}排序，当前${active ? (sort.sortDir === 'asc' ? '升序' : '降序') : '未排序'}`}
    >
      <span>
        {label} <b>{en}</b>
      </span>
      <Icon size={11} className={styles.sortIcon} aria-hidden />
    </button>
  );
}

function StaticHeader({
  label,
  en,
  align = 'left',
  className,
}: {
  label: string;
  en: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <span
      className={classNames(
        styles.th,
        align === 'right' && styles.thRight,
        align === 'center' && styles.thCenter,
        className,
      )}
    >
      {label} <b>{en}</b>
    </span>
  );
}

function PlaceholderRow() {
  const widths = ['62%', '78%', '70%', '66%', '58%', '44%', '60%', '52%', '58%', '40%', '74%'];
  return (
    <div className={classNames(styles.row, styles.rowPlaceholder, styles.tradesGrid)} aria-hidden>
      {widths.map((width, index) => (
        <span
          key={index}
          className={classNames(ui.skeleton, styles.rowSkeleton)}
          style={{ width }}
        />
      ))}
    </div>
  );
}

function TradeRow({
  row,
  selected,
  onRowClick,
  onCopyId,
}: {
  row: TradeDTO;
  selected: boolean;
  onRowClick(id: string): void;
  onCopyId(id: string): void;
}) {
  const tone = riskTone(row.riskScore);
  const latencyWarn = row.latencyMs > 100;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onRowClick(row.id);
    }
  };

  return (
    <div
      className={classNames(styles.row, styles.tradesGrid, selected && styles.rowSelected)}
      onClick={() => onRowClick(row.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`查看交易 ${row.id} 详情`}
      aria-current={selected ? 'true' : undefined}
    >
      <div className={styles.timeCell}>
        <b>{formatClockMs(row.ts)}</b>
        <small>{formatDate(row.ts)}</small>
      </div>

      <div className={styles.idCell}>
        <span className={styles.idText} title={row.id}>
          {row.id}
        </span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={(event) => {
            event.stopPropagation();
            onCopyId(row.id);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={`复制交易 ID ${row.id}`}
          title="复制交易 ID"
        >
          <Copy size={11} aria-hidden />
        </button>
      </div>

      <div className={styles.nodeCell}>
        <b title={row.fromNodeName}>{row.fromNodeName}</b>
        <small>{row.fromNodeId}</small>
      </div>

      <div className={styles.nodeCell}>
        <b title={row.toNodeName}>{row.toNodeName}</b>
        <small>{row.toNodeId}</small>
      </div>

      <div className={styles.assetCell}>
        <b title={row.asset}>{row.asset}</b>
        <small>{ASSET_CLASS_EN[row.assetClass]}</small>
      </div>

      <span className={classNames(styles.sideChip, row.side === 'buy' ? styles.sideBuy : styles.sideSell)}>
        {row.side === 'buy' ? 'BUY' : 'SELL'}
      </span>

      <div className={styles.amountCell}>
        <b>{formatUsdCompact(row.amount)}</b>
        <small>USD</small>
      </div>

      <div className={styles.priceCell}>
        <span>{formatPrice(row.price, row.asset)}</span>
        <small>{ASSET_CLASS_EN[row.assetClass]}</small>
      </div>

      <div className={styles.centerCell}>
        <StatusTag status={row.status} />
      </div>

      <div className={classNames(styles.latencyCell, latencyWarn && styles.latencyWarn)}>
        {formatLatency(row.latencyMs)}
      </div>

      <div className={styles.riskCell}>
        <b>{row.riskScore.toFixed(1)}</b>
        <span className={classNames(styles.riskBar, RISK_CLASS[tone])}>
          <i style={{ width: `${riskBarWidth(row.riskScore)}%` }} />
        </span>
      </div>
    </div>
  );
}

export function TradesTable({
  rows,
  total,
  loading,
  hydrating,
  loadingMore,
  error,
  selectedId,
  sort,
  resetKey,
  onSortChange,
  onRowClick,
  onCopyId,
  onLoadMore,
  onRetry,
  onResetFilters,
}: TradesTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingTopRef = useRef(0);
  const needsLoadRef = useRef(false);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const displayTotal = Math.max(total, rows.length);
  const hasRows = rows.length > 0;
  const showInitialSkeleton = loading && !hasRows;
  const showEmpty = !loading && !error && displayTotal === 0;
  const bodyReady = !error && !showInitialSkeleton && !showEmpty;

  // 滚动容器只在数据就绪时挂载，因此依赖 bodyReady 重新测量可视高度。
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const measure = () => setViewportHeight(element.clientHeight);
    // 容器重新挂载时同步回顶，避免筛选后沿用旧 scrollTop 的虚拟窗口。
    pendingTopRef.current = 0;
    setScrollTop(0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bodyReady]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = 0;
    setScrollTop(0);
  }, [resetKey]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    pendingTopRef.current = element.scrollTop;
    needsLoadRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - LOAD_MORE_THRESHOLD;

    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(pendingTopRef.current);
      if (needsLoadRef.current) {
        needsLoadRef.current = false;
        onLoadMore();
      }
    });
  };

  const virtualWindow = useMemo(
    () =>
      computeVirtualWindow({
        scrollTop,
        viewportHeight,
        rowHeight: ROW_HEIGHT,
        total: displayTotal,
        overscan: OVERSCAN,
      }),
    [scrollTop, viewportHeight, displayTotal],
  );

  const renderedRows = useMemo(() => {
    const nodes: ReactNode[] = [];
    for (let index = virtualWindow.start; index < virtualWindow.end; index += 1) {
      const row = rows[index];
      if (!row) {
        nodes.push(<PlaceholderRow key={`placeholder-${index}`} />);
      } else {
        nodes.push(
          <TradeRow
            key={row.id}
            row={row}
            selected={selectedId === row.id}
            onRowClick={onRowClick}
            onCopyId={onCopyId}
          />,
        );
      }
    }
    return nodes;
  }, [rows, virtualWindow.start, virtualWindow.end, selectedId, onRowClick, onCopyId]);

  const rangeStart = virtualWindow.end > virtualWindow.start ? virtualWindow.start + 1 : 0;
  const syncing = hydrating || loadingMore;

  return (
    <>
      <div className={classNames(styles.tableHead, styles.tradesGrid)} role="row">
        <SortHeader field="ts" label="时间" en="TIME" sort={sort} onSortChange={onSortChange} />
        <StaticHeader label="交易 ID" en="TXID" />
        <StaticHeader label="卖方" en="SELLER" />
        <StaticHeader label="买方" en="BUYER" />
        <StaticHeader label="资产" en="ASSET" />
        <StaticHeader label="方向" en="SIDE" align="center" />
        <SortHeader field="amount" label="金额" en="NOTIONAL" sort={sort} align="right" onSortChange={onSortChange} />
        <StaticHeader label="价格" en="PRICE" align="right" />
        <StaticHeader label="状态" en="STATUS" align="center" />
        <SortHeader field="latencyMs" label="延迟" en="LATENCY" sort={sort} align="right" onSortChange={onSortChange} />
        <SortHeader field="riskScore" label="风险分" en="RISK" sort={sort} align="right" onSortChange={onSortChange} />
      </div>

      <div className={styles.tableBody}>
        {error ? (
          <div className={styles.stateWrap}>
            <ErrorState message={error} onRetry={onRetry} />
          </div>
        ) : showInitialSkeleton ? (
          <div className={styles.stateWrap}>
            <LoadingBlock height={560} rows={10} />
          </div>
        ) : showEmpty ? (
          <div className={styles.stateWrap}>
            <EmptyState
              title="无匹配交易"
              description="当前筛选条件下没有交易记录。可调整搜索、金额区间或状态后再试。"
              action={
                <NeonButton variant="ghost" size="sm" onClick={onResetFilters}>
                  重置筛选
                </NeonButton>
              }
            />
          </div>
        ) : (
          <div ref={scrollRef} className={styles.scroll} onScroll={handleScroll} tabIndex={-1}>
            <div className={styles.virtualInner} style={{ height: virtualWindow.totalHeight }}>
              <div className={styles.rowWindow} style={{ transform: `translateY(${virtualWindow.offsetY}px)` }}>
                {renderedRows}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <div className={styles.footLeft}>
          <span className={styles.footLive}>
            <i aria-hidden />
            VIRTUAL SCROLL ACTIVE
          </span>
          <span>
            已加载 <b>{rows.length}</b> / 共 <b>{displayTotal}</b> 行
          </span>
          {syncing ? <span>正在同步分页…</span> : <span>分页数据已同步</span>}
        </div>
        <div className={styles.footRight}>
          <span>
            ROW <b>{rangeStart}–{virtualWindow.end}</b> OF <b>{displayTotal}</b>
          </span>
          <span>OVERSCAN {OVERSCAN} · ROW {ROW_HEIGHT}PX</span>
        </div>
      </div>
    </>
  );
}
