import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, MapPin } from 'lucide-react';
import { dataApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { useResource } from '@/hooks/useResource';
import { DataDrawer } from '@/components/DataDrawer';
import { NeonButton } from '@/components/NeonButton';
import { StatusTag, type TagStatus } from '@/components/StatusTag';
import { copyText } from '@/lib/clipboard';
import { formatDateTime, formatLatency, formatPrice, formatUsdCompact } from '@/lib/format';
import { ASSET_CLASS_LABELS } from '@/lib/theme';
import styles from '@/styles/detail.module.css';
import type { TradeDTO } from '@/types';

export function TradeDrawer({ id }: { id: string }) {
  const token = useAuthStore((state) => state.token);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const cached = useStreamStore((state) => state.trades.find((trade) => trade.id === id) ?? null);
  const [copied, setCopied] = useState(false);

  const { data, loading, error } = useResource(
    (signal) => dataApi.trade(token ?? '', id, signal),
    [token, id],
    { enabled: Boolean(token) },
  );

  const trade: TradeDTO | null = data?.trade ?? cached;

  useEffect(() => {
    setCopied(false);
  }, [id]);

  const handleCopy = async () => {
    if (!trade) return;
    const ok = await copyText(trade.id);
    setCopied(ok);
    toast(ok ? 'success' : 'warn', ok ? '交易 ID 已复制' : '复制失败，请手动选择');
  };

  return (
    <DataDrawer
      code="TXN / DETAIL"
      title="交易详情"
      subtitle={trade ? `${trade.id} · ${formatDateTime(trade.ts)}` : id}
      onClose={closeDrawer}
      footer={
        <>
          <NeonButton variant="ghost" size="sm" icon={<Copy size={12} />} onClick={() => void handleCopy()}>
            {copied ? '已复制' : '复制交易 ID'}
          </NeonButton>
          <NeonButton
            variant="primary"
            size="sm"
            icon={<MapPin size={12} />}
            onClick={() => {
              closeDrawer();
              navigate(`/map?trade=${encodeURIComponent(id)}`);
            }}
          >
            在地图定位
          </NeonButton>
          <NeonButton
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={12} />}
            onClick={() => {
              closeDrawer();
              navigate(`/trades?tradeId=${encodeURIComponent(id)}`);
            }}
          >
            交易明细
          </NeonButton>
        </>
      }
    >
      {!trade && loading && <div className={styles.heroSub}>正在读取交易数据…</div>}
      {!trade && !loading && error && <div className={styles.heroSub} style={{ color: 'var(--red)' }}>{error}</div>}

      {trade && (
        <>
          <div className={styles.hero}>
            <div className={styles.heroTop}>
              <div>
                <div className={styles.heroPriceLabel}>NOTIONAL / 名义金额</div>
                <div className={styles.heroAmount}>{formatUsdCompact(trade.amount)}</div>
                <div className={styles.heroSub}>
                  {trade.asset} · {ASSET_CLASS_LABELS[trade.assetClass]} · {trade.side === 'sell' ? 'SELL / 卖出' : 'BUY / 买入'}
                </div>
              </div>
              <div className={styles.heroRight}>
                <StatusTag status={trade.status as TagStatus} />
                <div className={styles.heroPriceLabel} style={{ marginTop: 8 }}>
                  EXECUTION PRICE
                </div>
                <div className={styles.heroPrice}>{formatPrice(trade.price, trade.asset)}</div>
              </div>
            </div>
          </div>

          <div className={styles.route}>
            <div>
              <div className={styles.routeLabel}>SELLER / 卖方节点</div>
              <div className={styles.routeName}>{trade.fromNodeName}</div>
              <div className={styles.routeId}>{trade.fromNodeId}</div>
            </div>
            <div className={styles.routeArrow} aria-hidden />
            <div style={{ textAlign: 'right' }}>
              <div className={styles.routeLabel}>BUYER / 买方节点</div>
              <div className={styles.routeName}>{trade.toNodeName}</div>
              <div className={styles.routeId}>{trade.toNodeId}</div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>TRADE ID</div>
              <div className={styles.cellValue}>{trade.id}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>STATUS</div>
              <div className={styles.cellValue}>
                <StatusTag status={trade.status as TagStatus} />
              </div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>LATENCY / 延迟</div>
              <div className={styles.cellValue}>{formatLatency(trade.latencyMs)}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>RISK SCORE</div>
              <div className={styles.cellValue}>{trade.riskScore.toFixed(1)} / 100</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>ASSET CLASS</div>
              <div className={styles.cellValue}>{ASSET_CLASS_LABELS[trade.assetClass]}</div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>TIMESTAMP</div>
              <div className={styles.cellValue}>{formatDateTime(trade.ts)}</div>
            </div>
          </div>

          <div className={styles.sectionTitle}>RISK ENGINE / 风控评估</div>
          <div className={styles.riskBlock}>
            <div className={styles.riskHead}>
              <span>RISK SCORE</span>
              <span style={{ color: trade.riskScore >= 80 ? 'var(--red)' : 'var(--text-1)' }}>
                {trade.riskScore.toFixed(1)} / 100
              </span>
            </div>
            <div className={styles.riskTrack}>
              <div className={styles.riskFill} style={{ width: `${Math.min(100, trade.riskScore)}%` }} />
            </div>
            <div className={styles.riskScale}>
              <span>LOW</span>
              <span>REVIEW 80</span>
              <span>CRITICAL</span>
            </div>
          </div>

          <div className={styles.sectionTitle}>EXECUTION / 执行信息</div>
          <div className={styles.grid} style={{ borderTop: 'none' }}>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>BASE AMOUNT</div>
              <div className={styles.cellValue}>
                {trade.assetClass === 'equity'
                  ? `${(trade.amount / Math.max(trade.price, 0.01)).toFixed(2)} SHARES`
                  : `${(trade.amount / Math.max(trade.price, 0.001)).toFixed(4)} UNITS`}
              </div>
            </div>
            <div className={styles.cell}>
              <div className={styles.cellLabel}>SETTLEMENT</div>
              <div className={styles.cellValue}>T+0 · INSTANT</div>
            </div>
          </div>
        </>
      )}
    </DataDrawer>
  );
}
