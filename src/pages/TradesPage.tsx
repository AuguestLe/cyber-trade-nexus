import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { ApiError } from '@/api/client';
import { dataApi } from '@/api/endpoints';
import { NeonButton } from '@/components/NeonButton';
import { usePermission } from '@/hooks/usePermission';
import { copyText } from '@/lib/clipboard';
import { matchesTrade } from '@/lib/filter';
import { formatLatency, formatNumber, formatPct, formatUsdCompact } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import type { AssetClass, Side, TradeDTO, TradeQuery, TradeStatus } from '@/types';
import { TradesFilters } from './trades/TradesFilters';
import { TradesTable } from './trades/TradesTable';
import {
  buildTradesCsv,
  DEFAULT_TRADE_FILTERS,
  mergeTradeRows,
  parseAmountInput,
  summarizeTrades,
  type TradeFilterValues,
  type TradeSortBy,
  type TradeSortDir,
  type TradeSortState,
} from './trades/tradeRows';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/trades.module.css';

const PAGE_SIZE = 200;
const MAX_INITIAL_PAGES = 6;
const SEARCH_DEBOUNCE_MS = 250;
const LIVE_CAP = 30;

const DEFAULT_SORT: TradeSortState = { sortBy: 'ts', sortDir: 'desc' };

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function appendUniqueRows(base: TradeDTO[], incoming: readonly TradeDTO[]): TradeDTO[] {
  const seen = new Set(base.map((row) => row.id));
  const merged = [...base];
  for (const row of incoming) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

function csvFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `nexus-trades-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}.csv`;
}

export function TradesPage() {
  const token = useAuthStore((state) => state.token);
  const { isAdmin } = usePermission();
  const toast = useUiStore((state) => state.toast);
  const drawer = useUiStore((state) => state.drawer);
  const streamTrades = useStreamStore((state) => state.trades);
  const [searchParams] = useSearchParams();

  const urlNodeId = searchParams.get('nodeId');
  const urlTradeId = searchParams.get('tradeId');

  const [filters, setFilters] = useState<TradeFilterValues>(() => ({
    ...DEFAULT_TRADE_FILTERS,
    nodeId: urlNodeId,
  }));
  const [searchInput, setSearchInput] = useState('');
  const [amountMinText, setAmountMinText] = useState('');
  const [amountMaxText, setAmountMaxText] = useState('');
  const [sort, setSort] = useState<TradeSortState>(DEFAULT_SORT);

  const [serverRows, setServerRows] = useState<TradeDTO[]>([]);
  const [liveRows, setLiveRows] = useState<TradeDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [scrollVersion, setScrollVersion] = useState(0);

  const feedReadyRef = useRef(false);
  const feedEpochRef = useRef(0);
  const loadMoreLockRef = useRef(false);
  const lastDeepLinkRef = useRef<string | null>(null);
  const rowsRef = useRef<TradeDTO[]>([]);
  const nodeNamesRef = useRef<Map<string, string>>(new Map());

  const selectedId = drawer.kind === 'trade' ? drawer.id : null;

  const updateFilters = useCallback((updater: (previous: TradeFilterValues) => TradeFilterValues) => {
    setScrollVersion((value) => value + 1);
    useUiStore.getState().closeDrawer();
    setFilters((previous) => {
      const next = updater(previous);
      return next === previous ? previous : next;
    });
  }, []);

  /* ---------------- 搜索 250ms 防抖 ---------------- */

  useEffect(() => {
    if (searchInput === filters.search) return undefined;
    const timer = window.setTimeout(() => {
      updateFilters((previous) =>
        previous.search === searchInput ? previous : { ...previous, search: searchInput },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search, updateFilters]);

  /* ---------------- 深链：nodeId / tradeId ---------------- */

  useEffect(() => {
    if (!urlNodeId) return;
    updateFilters((previous) => (previous.nodeId === urlNodeId ? previous : { ...previous, nodeId: urlNodeId }));
  }, [urlNodeId, updateFilters]);

  useEffect(() => {
    if (!urlTradeId || lastDeepLinkRef.current === urlTradeId) return;
    lastDeepLinkRef.current = urlTradeId;
    useUiStore.getState().openTrade(urlTradeId);
  }, [urlTradeId]);

  // SSE 的 trade 事件缺少 fromNodeName/toNodeName，用节点字典在本地补全（不改接口契约）。
  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    dataApi
      .nodes(token, controller.signal)
      .then(({ nodes }) => {
        const names = nodeNamesRef.current;
        for (const node of nodes) names.set(node.id, node.name);
      })
      .catch(() => {
        /* 节点字典失败时退回节点 ID 展示 */
      });
    return () => controller.abort();
  }, [token]);

  /* ---------------- 查询构造与首屏顺序分页 ---------------- */

  const buildTradeQuery = useCallback(
    (page: number): TradeQuery => ({
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort.sortBy,
      sortDir: sort.sortDir,
      search: filters.search.trim() || undefined,
      assetClass: filters.assetClass,
      status: filters.status,
      side: filters.side,
      nodeId: filters.nodeId,
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
    }),
    [filters, sort.sortBy, sort.sortDir],
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('会话已失效，请重新登录');
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    let firstPageLoaded = false;

    feedEpochRef.current += 1;
    feedReadyRef.current = false;
    setLoading(true);
    setHydrating(false);
    setLoadingMore(false);
    setError(null);
    setServerRows([]);
    setLiveRows([]);
    setTotal(0);
    setLoadedPages(0);

    const run = async () => {
      let accumulated: TradeDTO[] = [];
      try {
        for (let page = 1; page <= MAX_INITIAL_PAGES; page += 1) {
          const result = await dataApi.trades(token, buildTradeQuery(page), controller.signal);
          if (!active) return;
          accumulated = appendUniqueRows(accumulated, result.items);
          setServerRows(accumulated);
          setTotal(result.total);
          setLoadedPages(page);
          if (!firstPageLoaded) {
            firstPageLoaded = true;
            feedReadyRef.current = true;
            setLoading(false);
          } else if (accumulated.length < result.total) {
            setHydrating(true);
          }
          if (accumulated.length >= result.total || !result.hasMore) return;
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : '交易明细加载失败');
        setLoading(false);
      } finally {
        if (active) setHydrating(false);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, buildTradeQuery, retryNonce]);

  /* ---------------- 滚动触底续拉分页 ---------------- */

  const loadNextPage = useCallback(async () => {
    if (!token || loading || hydrating || loadingMore || loadMoreLockRef.current) return;
    if (loadedPages <= 0 || serverRows.length >= total) return;

    const epoch = feedEpochRef.current;
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    try {
      const result = await dataApi.trades(token, buildTradeQuery(loadedPages + 1));
      if (feedEpochRef.current !== epoch) return;
      setServerRows((previous) => appendUniqueRows(previous, result.items));
      setTotal(result.total);
      setLoadedPages((previous) => previous + 1);
    } catch (err) {
      toast('danger', err instanceof ApiError ? err.message : '加载更多交易失败');
    } finally {
      loadMoreLockRef.current = false;
      setLoadingMore(false);
    }
  }, [token, loading, hydrating, loadingMore, loadedPages, serverRows.length, total, buildTradeQuery, toast]);

  /* ---------------- SSE 增量：仅插最新，不重复拉全量 ---------------- */

  const rows = useMemo(() => mergeTradeRows(liveRows, serverRows), [liveRows, serverRows]);
  rowsRef.current = rows;

  const displayTotal = Math.max(total, rows.length);
  const summary = useMemo(() => summarizeTrades(rows), [rows]);

  useEffect(() => {
    if (!feedReadyRef.current || loading || error) return;
    if (sort.sortBy !== 'ts' || sort.sortDir !== 'desc') return;

    const recent = streamTrades.slice(0, LIVE_CAP);
    const topTs = rowsRef.current[0]?.ts ?? 0;

    const names = new Map<string, string>(nodeNamesRef.current);
    for (const row of serverRows) {
      if (row.fromNodeName) names.set(row.fromNodeId, row.fromNodeName);
      if (row.toNodeName) names.set(row.toNodeId, row.toNodeName);
    }

    setLiveRows((previous) => {
      const known = new Set<string>();
      for (const trade of previous) known.add(trade.id);
      for (const trade of serverRows) known.add(trade.id);

      const fresh: TradeDTO[] = [];
      for (const trade of recent) {
        if (known.has(trade.id)) continue;
        if (trade.ts <= topTs) continue;
        const enriched: TradeDTO = {
          ...trade,
          fromNodeName: trade.fromNodeName || names.get(trade.fromNodeId) || trade.fromNodeId,
          toNodeName: trade.toNodeName || names.get(trade.toNodeId) || trade.toNodeId,
        };
        if (!matchesTrade(enriched, filters)) continue;
        known.add(trade.id);
        fresh.push(enriched);
      }

      if (fresh.length === 0) return previous;
      fresh.sort((left, right) => right.ts - left.ts);
      return [...fresh, ...previous].slice(0, LIVE_CAP);
    });
  }, [streamTrades, serverRows, filters, sort, loading, error]);

  /* ---------------- 筛选交互 ---------------- */

  const handleAssetClassChange = useCallback(
    (assetClass: AssetClass | null) => {
      updateFilters((previous) => ({ ...previous, assetClass }));
    },
    [updateFilters],
  );

  const handleSideChange = useCallback(
    (side: Side | null) => {
      updateFilters((previous) => ({ ...previous, side }));
    },
    [updateFilters],
  );

  const handleStatusChange = useCallback(
    (status: TradeStatus | null) => {
      updateFilters((previous) => ({ ...previous, status }));
    },
    [updateFilters],
  );

  const handleClearNode = useCallback(() => {
    updateFilters((previous) => ({ ...previous, nodeId: null }));
  }, [updateFilters]);

  const commitAmounts = useCallback(() => {
    const minAmount = parseAmountInput(amountMinText);
    const maxAmount = parseAmountInput(amountMaxText);
    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
      toast('warn', '金额下限不能大于上限');
      return;
    }
    if (minAmount === filters.minAmount && maxAmount === filters.maxAmount) return;
    updateFilters((previous) => ({ ...previous, minAmount, maxAmount }));
  }, [amountMinText, amountMaxText, filters.minAmount, filters.maxAmount, toast, updateFilters]);

  const handleReset = useCallback(() => {
    setSearchInput('');
    setAmountMinText('');
    setAmountMaxText('');
    setScrollVersion((value) => value + 1);
    useUiStore.getState().closeDrawer();
    setFilters({ ...DEFAULT_TRADE_FILTERS });
  }, []);

  const handleSortChange = useCallback((sortBy: TradeSortBy, sortDir: TradeSortDir) => {
    setSort({ sortBy, sortDir });
    setScrollVersion((value) => value + 1);
  }, []);

  /* ---------------- 行交互 / 导出 ---------------- */

  const handleRowClick = useCallback((id: string) => {
    useUiStore.getState().openTrade(id);
  }, []);

  const handleCopyId = useCallback(
    async (id: string) => {
      const ok = await copyText(id);
      toast(ok ? 'success' : 'warn', ok ? `交易 ID 已复制：${id}` : '复制失败，请手动选择');
    },
    [toast],
  );

  const handleExport = useCallback(() => {
    if (!isAdmin || rows.length === 0) return;
    const csv = buildTradesCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFilename();
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast('success', `已导出 ${rows.length} 条交易明细（CSV）`);
  }, [isAdmin, rows, toast]);

  const handleRetry = useCallback(() => setRetryNonce((value) => value + 1), []);

  const resetKey = useMemo(
    () => `${JSON.stringify(filters)}|${sort.sortBy}|${sort.sortDir}|${scrollVersion}`,
    [filters, sort, scrollVersion],
  );

  return (
    <div className={styles.page}>
      <section className={classNames(ui.hud, styles.panel)} aria-label="交易明细">
        <header className={styles.head}>
          <span className={styles.headTag}>O-01 / ORDER FLOW</span>
          <div className={styles.headTitle}>
            交易明细 <span>VIRTUAL ORDER LEDGER</span>
          </div>
          <div className={styles.headStats}>
            <div className={styles.stat}>
              <small>总笔数 / MATCHED</small>
              <b>{formatNumber(displayTotal)}</b>
            </div>
            <div className={classNames(styles.stat, styles.statAccent)}>
              <small>总成交额 / NOTIONAL</small>
              <b>{formatUsdCompact(summary.amount)}</b>
            </div>
            <div className={classNames(styles.stat, styles.statWarn)}>
              <small>异常率 / ANOMALY</small>
              <b>{formatPct(summary.anomalyRate)}</b>
            </div>
            <div className={styles.stat}>
              <small>延迟中位数 / MEDIAN</small>
              <b>{formatLatency(summary.medianLatency)}</b>
            </div>
          </div>
          <div className={styles.headActions}>
            {isAdmin ? (
              <NeonButton
                variant="ghost"
                size="sm"
                icon={<Download size={12} aria-hidden />}
                onClick={handleExport}
                disabled={rows.length === 0}
                aria-label="导出当前已加载交易为 CSV"
              >
                导出 CSV / EXPORT
              </NeonButton>
            ) : (
              <span className={styles.readonlyBadge}>只读 / READ ONLY</span>
            )}
          </div>
        </header>

        <TradesFilters
          filters={filters}
          searchValue={searchInput}
          amountMinText={amountMinText}
          amountMaxText={amountMaxText}
          total={total}
          loadedCount={rows.length}
          busy={hydrating || loadingMore}
          onSearchChange={setSearchInput}
          onAssetClassChange={handleAssetClassChange}
          onSideChange={handleSideChange}
          onStatusChange={handleStatusChange}
          onAmountMinChange={setAmountMinText}
          onAmountMaxChange={setAmountMaxText}
          onAmountCommit={() => commitAmounts()}
          onReset={handleReset}
          onClearNode={handleClearNode}
        />

        <TradesTable
          rows={rows}
          total={total}
          loading={loading}
          hydrating={hydrating}
          loadingMore={loadingMore}
          error={error}
          selectedId={selectedId}
          sort={sort}
          resetKey={resetKey}
          onSortChange={handleSortChange}
          onRowClick={handleRowClick}
          onCopyId={(id) => {
            void handleCopyId(id);
          }}
          onLoadMore={() => {
            void loadNextPage();
          }}
          onRetry={handleRetry}
          onResetFilters={handleReset}
        />
      </section>
    </div>
  );
}
