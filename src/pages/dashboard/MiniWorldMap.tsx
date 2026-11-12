import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HudCard } from '@/components/HudCard';
import { groupTradesToArcs } from '@/lib/arc';
import { formatUsdCompact } from '@/lib/format';
import { ASSET_CLASS_COLORS, NODE_STATUS_COLORS } from '@/lib/theme';
import { WORLD_OUTLINE, WORLD_PROJECTION, WORLD_VIEWBOX } from '@/map/worldOutline';
import styles from '@/styles/dashboard.module.css';
import type { NodeDTO, TradeDTO } from '@/types';

interface MiniWorldMapProps {
  nodes: NodeDTO[];
  trades: TradeDTO[];
  loading: boolean;
}

const VB = WORLD_VIEWBOX;

function project(lon: number, lat: number): [number, number] {
  const rad = Math.PI / 180;
  return [
    WORLD_PROJECTION.scale * lon * rad + WORLD_PROJECTION.translate[0],
    -WORLD_PROJECTION.scale * lat * rad + WORLD_PROJECTION.translate[1],
  ];
}

interface MiniArc {
  id: string;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export function MiniWorldMap({ nodes, trades, loading }: MiniWorldMapProps) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<{ node: NodeDTO; x: number; y: number } | null>(null);
  // 入场窗口：只有页面挂载后的前 3.5s 允许路径/节点环播动画。
  // SSE 不断产生新的弧线 bundle，若一直挂着 animation，新 path 会反复重播。
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntering(false), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const topNodes = useMemo(
    () => [...nodes].sort((a, b) => b.volume24h - a.volume24h).slice(0, 14),
    [nodes],
  );
  const maxVolume = Math.max(1, ...topNodes.map((node) => node.volume24h));

  const arcs = useMemo<MiniArc[]>(() => {
    const bundles = groupTradesToArcs(trades.slice(0, 80), 8);
    return bundles
      .map((arc) => {
        const from = nodeMap.get(arc.fromNodeId);
        const to = nodeMap.get(arc.toNodeId);
        if (!from || !to) return null;
        const [x1, y1] = project(from.lon, from.lat);
        const [x2, y2] = project(to.lon, to.lat);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        // 控制点向上拱起，视觉上形成资金飞行轨道
        const cx = (x1 + x2) / 2 + (dy / length) * length * 0.36;
        const cy = (y1 + y2) / 2 + (-dx / length) * length * 0.36;
        const anomaly = arc.status === 'failed' || arc.status === 'flagged';
        return {
          id: arc.id,
          x1,
          y1,
          cx,
          cy,
          x2,
          y2,
          color: anomaly ? '#ff4d6d' : ASSET_CLASS_COLORS[arc.assetClass],
          width: 1.2 + Math.min(1.8, arc.count * 0.25),
        };
      })
      .filter((arc): arc is MiniArc => Boolean(arc));
  }, [trades, nodeMap]);

  // 动画只跟页面挂载走（首次加载 / tab 切回）：不监听数据增长，避免 SSE 让弧线反复重播。
  const anomalies = nodes.filter((node) => node.status === 'alert').length;

  const handleNodeEnter = (node: NodeDTO, event: React.MouseEvent<SVGCircleElement>) => {
    const [x, y] = project(node.lon, node.lat);
    event.stopPropagation();
    setHover({ node, x: (x / VB.width) * 100, y: (y / VB.height) * 100 });
  };

  return (
    <HudCard
      code="D-03"
      title="全球交易态势"
      en="MINI WORLD MAP"
      actions={
        <>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)' }}>
            {arcs.length} LIVE ROUTES
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            CLICK TO EXPLORE ↗
          </span>
        </>
      }
    >
      <div
        className={styles.miniWrap}
        onClick={() => navigate('/map')}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') navigate('/map');
        }}
        aria-label="打开全球交易地图"
      >
        {loading && <div className={styles.chartCanvas}>正在读取全球节点…</div>}
        <svg
          className={`${styles.miniSvg} ${entering ? styles.miniEnter : ''}`}
          viewBox={`0 0 ${VB.width} ${VB.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="miniGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={WORLD_OUTLINE} fill="rgba(0,240,255,0.045)" stroke="rgba(0,240,255,0.28)" strokeWidth={0.8} />

          {arcs.map((arc) => (
            <path
              key={`base-${arc.id}`}
              d={`M ${arc.x1.toFixed(1)} ${arc.y1.toFixed(1)} Q ${arc.cx.toFixed(1)} ${arc.cy.toFixed(1)} ${arc.x2.toFixed(1)} ${arc.y2.toFixed(1)}`}
              fill="none"
              stroke={arc.color}
              strokeWidth={arc.width}
              opacity={0.35}
            />
          ))}
          {arcs.map((arc) => (
            <path
              key={`flow-${arc.id}`}
              className={styles.miniArc}
              d={`M ${arc.x1.toFixed(1)} ${arc.y1.toFixed(1)} Q ${arc.cx.toFixed(1)} ${arc.cy.toFixed(1)} ${arc.x2.toFixed(1)} ${arc.y2.toFixed(1)}`}
              fill="none"
              stroke={arc.color}
              strokeWidth={arc.width}
              opacity={0.8}
            />
          ))}

          {topNodes.map((node, index) => {
            const [x, y] = project(node.lon, node.lat);
            const radius = 2.2 + Math.sqrt(node.volume24h / maxVolume) * 4;
            const color = NODE_STATUS_COLORS[node.status];
            return (
              <g key={node.id} className={styles.miniNode} filter="url(#miniGlow)">
                <circle
                  cx={x}
                  cy={y}
                  r={radius + 3}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.8}
                  opacity={0.5}
                  className={styles.miniNodeRing}
                  style={{ animationDelay: `${(index % 5) * 0.18}s` }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  opacity={0.9}
                  onMouseEnter={(event) => handleNodeEnter(node, event)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/map?node=${encodeURIComponent(node.id)}`);
                  }}
                />
                {index < 8 && (
                  <text
                    x={x + radius + 3}
                    y={y + 2.5}
                    fontSize={6.5}
                    fill="rgba(230,245,255,0.5)"
                    fontFamily="ui-monospace, Menlo, monospace"
                    letterSpacing={0.4}
                  >
                    {node.nameEn.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className={styles.miniTip}
            style={{ left: `${Math.min(86, Math.max(14, hover.x))}%`, top: `${Math.max(18, hover.y)}%` }}
          >
            <div className={styles.miniTipName}>{hover.node.name}</div>
            <div className={styles.miniTipSub}>
              {hover.node.nameEn.toUpperCase()} · {hover.node.countryCode} · {hover.node.status.toUpperCase()}
            </div>
            <div className={styles.miniTipValue}>{formatUsdCompact(hover.node.volume24h)}</div>
          </div>
        )}

        <div className={styles.miniStats}>
          <span>
            NODES <b>{topNodes.length}</b>
          </span>
          <span>
            ROUTES <b>{arcs.length}</b>
          </span>
          <span>
            ANOMALY <b style={{ color: anomalies > 0 ? 'var(--red)' : 'var(--green)' }}>{String(anomalies).padStart(2, '0')}</b>
          </span>
        </div>
        <span className={styles.miniOpen}>OPEN GLOBAL MAP ↗</span>
      </div>
    </HudCard>
  );
}
