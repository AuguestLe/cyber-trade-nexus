import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Maximize2, Minus, Pause, Play, Plus, RotateCcw, Search, X } from 'lucide-react';
import { dataApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useFilterStore } from '@/store/filterStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { useResource } from '@/hooks/useResource';
import { useFullscreen } from '@/hooks/useCountUp';
import { NeonButton } from '@/components/NeonButton';
import { Segmented } from '@/components/Segmented';
import { EChartsMapAdapter } from '@/map/EChartsMapAdapter';
import type { MapAdapter } from '@/map/MapAdapter';
import { MapFilterPanel } from './map/MapFilterPanel';
import { ArcDrawer } from './map/ArcDrawer';
import { groupTradesToArcs, findArcForTrade } from '@/lib/arc';
import { formatClock } from '@/lib/format';
import styles from '@/styles/map.module.css';
import type { ArcDTO, ArcQuery, MapLayers, NodeDTO, TradeDTO, TradeQuery } from '@/types';

const PLAYBACK_SPAN = 6 * 3_600_000;
const PLAYBACK_WINDOW = 5 * 60_000;

const DEFAULT_LAYERS: MapLayers = {
  borders: true,
  grid: true,
  nodes: true,
  arcs: true,
  heat: false,
  labels: true,
};

function matchTrade(arc: ArcDTO, candidates: TradeDTO[]): TradeDTO | undefined {
  return candidates.find(
    (trade) =>
      trade.fromNodeId === arc.fromNodeId &&
      trade.toNodeId === arc.toNodeId &&
      trade.assetClass === arc.assetClass,
  );
}

export function TradeMapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepTradeId = searchParams.get('trade');
  const token = useAuthStore((state) => state.token);
  const refreshMs = useConfigStore((state) => state.refreshMs);
  const range = useFilterStore((state) => state.range);
  const assetClass = useFilterStore((state) => state.assetClass);
  const status = useFilterStore((state) => state.status);
  const minAmount = useFilterStore((state) => state.minAmount);
  const maxAmount = useFilterStore((state) => state.maxAmount);
  const nodeId = useFilterStore((state) => state.nodeId);
  const country = useFilterStore((state) => state.country);
  const hidden = useFilterStore((state) => state.hiddenAssetClasses);
  const setNode = useFilterStore((state) => state.setNode);
  const resetFilters = useFilterStore((state) => state.reset);
  const openTrade = useUiStore((state) => state.openTrade);
  const toast = useUiStore((state) => state.toast);
  const streamStatus = useStreamStore((state) => state.streamStatus);
  const alerts = useStreamStore((state) => state.alerts);
  const { fullscreen, toggle } = useFullscreen();

  const [geo, setGeo] = useState<unknown | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [heat, setHeat] = useState<'off' | 'routes' | 'amount'>('off');
  const [scope, setScope] = useState<'live' | 'all'>('all');
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null);
  const [arcDrawer, setArcDrawer] = useState<ArcDTO | null>(null);
  const [replayOn, setReplayOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);
  const [cursor, setCursor] = useState(0.82);
  const [debouncedCursor, setDebouncedCursor] = useState(0.82);
  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pendingDeepRef = useRef<{ arcId: string | null; nodeId: string } | null>(null);

  const effectiveWindow = scope === 'live' ? '1h' : range;

  useEffect(() => {
    let cancelled = false;
    fetch('/geo/world.geo.json')
      .then((response) => {
        if (!response.ok) throw new Error(`底图加载失败 HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((json) => {
        if (!cancelled) setGeo(json);
      })
      .catch((error: unknown) => {
        if (!cancelled) setGeoError(error instanceof Error ? error.message : '底图加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nodesRes = useResource((signal) => dataApi.nodes(token ?? '', signal), [token], {
    enabled: Boolean(token),
    refreshMs: 30_000,
  });
  const nodes: NodeDTO[] = nodesRes.data?.nodes ?? [];
  const nodeLabel = useMemo(
    () => nodes.find((node) => node.id === nodeId)?.name ?? null,
    [nodes, nodeId],
  );

  const arcQuery = useMemo<ArcQuery>(
    () => ({
      window: effectiveWindow,
      assetClass,
      status,
      minAmount,
      maxAmount,
      nodeId,
      country,
      limit: 80,
    }),
    [effectiveWindow, assetClass, status, minAmount, maxAmount, nodeId, country],
  );

  const arcsRes = useResource(
    (signal) => dataApi.arcs(token ?? '', arcQuery, signal),
    [token, JSON.stringify(arcQuery)],
    { enabled: Boolean(token), refreshMs },
  );

  const cursorMs = useMemo(() => Date.now() - PLAYBACK_SPAN + cursor * PLAYBACK_SPAN, [cursor]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCursor(cursor), 250);
    return () => window.clearTimeout(timer);
  }, [cursor]);

  const playbackQuery = useMemo<TradeQuery>(
    () => ({
      from: Math.max(0, debouncedCursor * PLAYBACK_SPAN + (Date.now() - PLAYBACK_SPAN) - PLAYBACK_WINDOW),
      to: debouncedCursor * PLAYBACK_SPAN + (Date.now() - PLAYBACK_SPAN),
      assetClass,
      status,
      minAmount,
      maxAmount,
      nodeId,
      country,
      pageSize: 200,
      sortBy: 'ts',
      sortDir: 'desc',
    }),
    [debouncedCursor, assetClass, status, minAmount, maxAmount, nodeId, country],
  );

  const playbackRes = useResource(
    (signal) => dataApi.trades(token ?? '', playbackQuery, signal),
    [token, JSON.stringify(playbackQuery)],
    { enabled: replayOn && Boolean(token) },
  );

  const replayArcs = useMemo(
    () => groupTradesToArcs(playbackRes.data?.items ?? [], 180, nodes),
    [playbackRes.data, nodes],
  );

  const sourceArcs = replayOn ? replayArcs : (arcsRes.data?.items ?? []);
  const displayArcs = useMemo(
    () => sourceArcs.filter((arc) => !hidden.includes(arc.assetClass)),
    [sourceArcs, hidden],
  );

  const latestRef = useRef({ nodes, arcs: displayArcs, layers, heat });
  latestRef.current = { nodes, arcs: displayArcs, layers, heat };

  useEffect(() => {
    if (!geo || !containerRef.current) return undefined;
    const adapter = new EChartsMapAdapter();
    adapterRef.current = adapter;
    adapter.mount(containerRef.current, geo);
    adapter.on((event) => {
      const current = latestRef.current;
      if (event.type === 'node-click' && event.nodeId) {
        const node = current.nodes.find((item) => item.id === event.nodeId);
        setNode(event.nodeId, node?.country ?? null);
        toast('info', `已筛选与 ${node?.name ?? event.nodeId} 相关的航线`);
        return;
      }
      if (event.type === 'arc-click' && event.arcId) {
        const arc = current.arcs.find((item) => item.id === event.arcId);
        if (!arc) return;
        setSelectedArcId(arc.id);
        const tokens = useAuthStore.getState().token;
        const inStore = useStreamStore
          .getState()
          .trades.find(
            (trade) =>
              trade.fromNodeId === arc.fromNodeId &&
              trade.toNodeId === arc.toNodeId &&
              trade.assetClass === arc.assetClass,
          );
        if (inStore) {
          setArcDrawer(null);
          openTrade(inStore.id);
          return;
        }
        if (!tokens) {
          setArcDrawer(arc);
          return;
        }
        dataApi
          .trades(tokens, {
            nodeId: arc.fromNodeId,
            pageSize: 200,
            sortBy: 'ts',
            sortDir: 'desc',
          })
          .then((result) => {
            const found = matchTrade(arc, result.items);
            if (found) {
              setArcDrawer(null);
              openTrade(found.id);
            } else {
              setArcDrawer(arc);
            }
          })
          .catch(() => setArcDrawer(arc));
      }
    });
    adapter.setNodes(latestRef.current.nodes);
    adapter.setArcs(latestRef.current.arcs);
    adapter.setLayers(latestRef.current.layers);
    adapter.setHeat(latestRef.current.heat);
    // 深链选中态：挂载时即应用；聚焦待 nodeMap 就绪后在 setNodes 效应中消费。
    const pending = pendingDeepRef.current;
    if (pending) adapter.setSelected(pending.arcId);
    return () => {
      adapter.dispose();
      adapterRef.current = null;
    };
  }, [geo, setNode, toast, openTrade]);

  useEffect(() => {
    adapterRef.current?.setNodes(nodes);
    // 底图/适配器就绪后，消费尚待聚焦的深链节点。
    const pending = pendingDeepRef.current;
    if (pending && adapterRef.current) {
      adapterRef.current.focusNode(pending.nodeId);
      pendingDeepRef.current = null;
    }
  }, [nodes]);

  useEffect(() => {
    adapterRef.current?.setArcs(displayArcs);
  }, [displayArcs]);

  useEffect(() => {
    adapterRef.current?.setLayers(layers);
  }, [layers]);

  useEffect(() => {
    adapterRef.current?.setHeat(heat);
  }, [heat]);

  useEffect(() => {
    adapterRef.current?.setSelected(selectedArcId);
  }, [selectedArcId]);

  // 深链 ?trade=<id>（来自交易明细抽屉的「在地图定位」）：定位并高亮该笔交易所在弧线，
  // 聚焦其端点，再打开交易详情抽屉；处理完即清掉参数，避免返回刷新时重复触发。
  useEffect(() => {
    if (!deepTradeId) return;
    const id = decodeURIComponent(deepTradeId).trim();
    const trade = useStreamStore
      .getState()
      .trades.find((item) => item.id === id);
    if (!trade) {
      toast('warn', `未找到交易 ${id}，可能已不在实时流中`);
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('trade');
        return next;
      });
      return;
    }
    const arc = findArcForTrade(trade, displayArcs);
    const target: { arcId: string | null; nodeId: string } = {
      arcId: arc?.id ?? null,
      nodeId: trade.fromNodeId,
    };
    if (adapterRef.current) {
      if (arc) setSelectedArcId(arc.id);
      adapterRef.current.focusNode(target.nodeId);
    } else {
      // 底图/适配器尚未挂载（首跳深链的异步竞态）：记录待聚焦目标，挂载后消费。
      pendingDeepRef.current = target;
    }
    if (!arc) toast('warn', '该交易不在当前筛选/时间窗内，已定位关联节点');
    setArcDrawer(null);
    openTrade(trade.id);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('trade');
      return next;
    });
  }, [deepTradeId, displayArcs, toast, openTrade, setSearchParams]);

  useEffect(() => {
    if (!playing || !replayOn) return undefined;
    const timer = window.setInterval(() => {
      setCursor((value) => Math.min(1, value + (60_000 * replaySpeed) / PLAYBACK_SPAN));
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, replayOn, replaySpeed]);

  useEffect(() => {
    if (cursor >= 1) setPlaying(false);
  }, [cursor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const searchResults = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    if (!needle) return [];
    return nodes
      .filter(
        (node) =>
          node.name.toLowerCase().includes(needle) ||
          node.nameEn.toLowerCase().includes(needle) ||
          node.country.toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [nodes, searchValue]);

  const handleFocusNode = (node: NodeDTO) => {
    adapterRef.current?.focusNode(node.id);
    setSearchValue('');
    setSearchOpen(false);
    toast('info', `视角已定位 ${node.name} / ${node.nameEn.toUpperCase()}`);
  };

  const handleReset = () => {
    resetFilters();
    setLayers(DEFAULT_LAYERS);
    setHeat('off');
    setReplayOn(false);
    setPlaying(false);
    setCursor(0.82);
    setSelectedArcId(null);
    setArcDrawer(null);
    adapterRef.current?.resetView();
    toast('info', '筛选与图层已重置');
  };

  const handleBrowseArc = (arc: ArcDTO) => {
    setArcDrawer(null);
    navigate(`/trades?nodeId=${encodeURIComponent(arc.fromNodeId)}`);
  };

  const anomalies = nodes.filter((node) => node.status === 'alert').length;
  const unresolved = alerts.filter((alert) => !alert.handled).length;
  const arcCount = displayArcs.length;

  return (
    <div className={styles.mapPage}>
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>全球交易地图</span>
          <span className={styles.titleEn}>GLOBAL TRADE MAP · GEO FLOW</span>
        </div>
        <div className={styles.headStats}>
          <span>
            NODES <b>{nodes.length}</b>
          </span>
          <span>
            ROUTES <b>{arcCount}</b>
          </span>
          <span>
            ANOMALY <b style={{ color: anomalies > 0 ? 'var(--red)' : 'var(--green)' }}>{String(anomalies).padStart(2, '0')}</b>
          </span>
          <span>
            OPEN ALERTS <b style={{ color: unresolved > 0 ? 'var(--amber)' : 'var(--text-1)' }}>{String(unresolved).padStart(2, '0')}</b>
          </span>
        </div>
        <div className={styles.headActions}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            {streamStatus?.paused ? 'STREAM PAUSED' : 'STREAM LIVE'} · {streamStatus?.speed ?? 1}×
          </span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap} ref={searchRef}>
          <Search size={12} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={searchValue}
            placeholder="搜索城市 / 交易所（上海、Singapore…）"
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            aria-label="搜索城市或交易所"
          />
          {searchOpen && searchResults.length > 0 && (
            <div className={styles.searchResults}>
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={styles.searchResultRow}
                  onClick={() => handleFocusNode(node)}
                >
                  <span>{node.name}</span>
                  <span className={styles.searchResultEn}>
                    {node.nameEn.toUpperCase()} · {node.countryCode}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {replayOn ? (
          <div className={styles.playbackControls}>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? '暂停回放' : '播放回放'}
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <Segmented
              options={[
                { value: 1, label: '1×' },
                { value: 2, label: '2×' },
                { value: 4, label: '4×' },
              ]}
              value={replaySpeed}
              onChange={(value) => setReplaySpeed(value as 1 | 2 | 4)}
              ariaLabel="回放倍速"
            />
            <div className={styles.timeline}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.002}
                value={cursor}
                className={styles.timelineInput}
                onChange={(event) => setCursor(Number(event.target.value))}
                aria-label="回放时间轴"
              />
              <span className={styles.timelineTime}>{formatClock(cursorMs)} · {Math.round(cursor * 100)}%</span>
            </div>
            <button type="button" className={styles.zoomBtn} onClick={() => setReplayOn(false)} aria-label="退出回放">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>WINDOW</span>
            <Segmented
              options={[
                { value: 'live', label: '实时 1H' },
                { value: 'all', label: '全部' },
              ]}
              value={scope}
              onChange={(value) => setScope(value as 'live' | 'all')}
              ariaLabel="实时或全部航线"
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              {range.toUpperCase()} ARCHIVE
            </span>
          </div>
        )}

        <div className={styles.toolbarRight}>
          <NeonButton
            size="sm"
            variant={replayOn ? 'primary' : 'ghost'}
            onClick={() => {
              setReplayOn((value) => !value);
              setPlaying(true);
              setCursor(0.82);
            }}
          >
            {replayOn ? '回放中' : '时间回放'}
          </NeonButton>
          <button type="button" className={styles.zoomBtn} onClick={() => void toggle()} aria-label="全屏">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      <div className={`${styles.mapBody} ${layers.grid ? '' : styles.mapBodyNoGrid}`}>
        <div ref={containerRef} className={styles.mapCanvas} role="img" aria-label="全球交易地图与空中弧线" />

        {!geo && !geoError && <div className={styles.mapLoading}>LOADING LOCAL GEOJSON / 本地底图加载中…</div>}
        {geoError && <div className={styles.mapError}>底图加载失败：{geoError}</div>}

        <MapFilterPanel
          layers={layers}
          onLayersChange={setLayers}
          heat={heat}
          onHeatChange={(mode) => {
            setHeat(mode);
            setLayers((value) => ({ ...value, heat: mode !== 'off' }));
          }}
          nodeLabel={nodeLabel}
          matched={arcCount}
          onReset={handleReset}
        />

        <div className={styles.zoomControls}>
          <button type="button" className={styles.zoomBtn} onClick={() => adapterRef.current?.zoomBy(1.25)} aria-label="放大">
            <Plus size={12} />
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => adapterRef.current?.zoomBy(0.8)} aria-label="缩小">
            <Minus size={12} />
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => adapterRef.current?.resetView()} aria-label="复位视角">
            <RotateCcw size={12} />
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => void toggle()} aria-label={fullscreen ? '退出全屏' : '全屏'}>
            <Maximize2 size={12} />
          </button>
        </div>

        <div className={styles.mapStats}>
          <span className={styles.mapStat}>
            NODES <b>{nodes.length}</b>
          </span>
          <span className={styles.mapStat}>
            ROUTES <b>{arcCount}</b>
          </span>
          <span className={styles.mapStat}>
            SELECTED <b>{selectedArcId ? '01' : '00'}</b>
          </span>
          <span className={styles.mapStat}>
            {replayOn ? `REPLAY ${Math.round(cursor * 100)}%` : 'LIVE / ARCHIVE'}
          </span>
        </div>
      </div>

      {arcDrawer && (
        <ArcDrawer arc={arcDrawer} onClose={() => setArcDrawer(null)} onBrowse={handleBrowseArc} />
      )}
    </div>
  );
}
