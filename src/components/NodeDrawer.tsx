import { useNavigate } from 'react-router-dom';
import { Crosshair, ExternalLink } from 'lucide-react';
import { dataApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { useFilterStore } from '@/store/filterStore';
import { useResource } from '@/hooks/useResource';
import { DataDrawer } from '@/components/DataDrawer';
import { NeonButton } from '@/components/NeonButton';
import { StatusTag } from '@/components/StatusTag';
import { EmptyState } from '@/components/States';
import { formatCompactNumber, formatLatency, formatUsdCompact } from '@/lib/format';
import { NODE_STATUS_COLORS } from '@/lib/theme';
import styles from '@/styles/detail.module.css';

export function NodeDrawer({ id }: { id: string }) {
  const token = useAuthStore((state) => state.token);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const toast = useUiStore((state) => state.toast);
  const setNode = useFilterStore((state) => state.setNode);
  const trades = useStreamStore((state) => state.trades);
  const navigate = useNavigate();

  const { data, loading, error } = useResource(
    (signal) => dataApi.nodes(token ?? '', signal),
    [token],
    { enabled: Boolean(token) },
  );

  const node = data?.nodes.find((item) => item.id === id) ?? null;
  const related = node
    ? trades.filter((trade) => trade.fromNodeId === node.id || trade.toNodeId === node.id).slice(0, 6)
    : [];

  return (
    <DataDrawer
      code="NODE / DETAIL"
      title="节点详情"
      subtitle={node ? `${node.nameEn.toUpperCase()} · ${node.id}` : id}
      onClose={closeDrawer}
      footer={
        node ? (
          <>
            <NeonButton
              variant="primary"
              size="sm"
              icon={<Crosshair size={12} />}
              onClick={() => {
                setNode(node.id, node.country);
                closeDrawer();
                toast('info', `已筛选与 ${node.name} 相关的交易`);
              }}
            >
              筛选关联交易
            </NeonButton>
            <NeonButton
              variant="ghost"
              size="sm"
              icon={<ExternalLink size={12} />}
              onClick={() => {
                closeDrawer();
                navigate(`/map?node=${encodeURIComponent(node.id)}`);
              }}
            >
              在地图查看
            </NeonButton>
          </>
        ) : undefined
      }
    >
      {!node && loading && <div className={styles.heroSub}>正在读取节点数据…</div>}
      {!node && !loading && error && (
        <div className={styles.heroSub} style={{ color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {node && (
        <>
          <div className={styles.nodeHead}>
            <div className={styles.nodeOrb} style={{ color: NODE_STATUS_COLORS[node.status] }}>
              ◈
            </div>
            <div>
              <div className={styles.nodeName}>{node.name}</div>
              <div className={styles.nodeMeta}>
                {node.nameEn.toUpperCase()} · {node.country} · {node.type.toUpperCase()}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <StatusTag status={node.status === 'normal' ? 'normal' : node.status === 'busy' ? 'busy' : 'alert'} />
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>24H NOTIONAL</div>
              <div className={styles.cellValue}>{formatUsdCompact(node.volume24h)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>HEALTH / 健康度</div>
              <div className={styles.cellValue} style={{ color: NODE_STATUS_COLORS[node.status] }}>
                {node.health}%
              </div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>IN / 流入笔数</div>
              <div className={styles.cellValue}>{formatCompactNumber(node.inCount24h)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>OUT / 流出笔数</div>
              <div className={styles.cellValue}>{formatCompactNumber(node.outCount24h)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>COORDINATES</div>
              <div className={styles.cellValue}>
                {node.lon.toFixed(2)} / {node.lat.toFixed(2)}
              </div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>24H TRADES</div>
              <div className={styles.cellValue}>{node.tradeCount24h}</div>
            </div>
          </div>

          <div className={styles.sectionTitle}>RELATED TAPE / 关联流水</div>
          {related.length === 0 ? (
            <EmptyState title="暂无关联流水" description="等待实时数据流推送与节点相关的交易" />
          ) : (
            <div style={{ border: '1px solid var(--line-soft)' }}>
              {related.map((trade) => (
                <div
                  key={trade.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '58px 1fr auto',
                    gap: 8,
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--line-soft)',
                    alignItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                  }}
                >
                  <span style={{ color: 'var(--text-3)' }}>{trade.id.slice(-6)}</span>
                  <span>
                    {trade.asset} · {trade.fromNodeName} → {trade.toNodeName}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    {formatUsdCompact(trade.amount)} / {formatLatency(trade.latencyMs)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DataDrawer>
  );
}
