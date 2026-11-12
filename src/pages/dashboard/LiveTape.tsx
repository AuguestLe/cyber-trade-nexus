import { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import { HudCard } from '@/components/HudCard';
import { StatusTag } from '@/components/StatusTag';
import { useFilterStore } from '@/store/filterStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { matchesTrade } from '@/lib/filter';
import { formatClock, formatUsdCompact } from '@/lib/format';
import styles from '@/styles/dashboard.module.css';
import type { TradeDTO } from '@/types';

export function LiveTape() {
  const trades = useStreamStore((state) => state.trades);
  const openTrade = useUiStore((state) => state.openTrade);
  const assetClass = useFilterStore((state) => state.assetClass);
  const status = useFilterStore((state) => state.status);
  const side = useFilterStore((state) => state.side);
  const nodeId = useFilterStore((state) => state.nodeId);
  const country = useFilterStore((state) => state.country);
  const search = useFilterStore((state) => state.search);
  const minAmount = useFilterStore((state) => state.minAmount);
  const maxAmount = useFilterStore((state) => state.maxAmount);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<TradeDTO[]>([]);

  const filtered = useMemo(
    () =>
      trades
        .filter((trade) =>
          matchesTrade(trade, { assetClass, status, side, nodeId, country, search, minAmount, maxAmount }),
        )
        .slice(0, 24),
    [trades, assetClass, status, side, nodeId, country, search, minAmount, maxAmount],
  );
  const rows = paused ? frozen : filtered;

  const handlePause = () => {
    if (!paused) setFrozen(filtered);
    setPaused((value) => !value);
  };

  return (
    <HudCard
      code="D-04"
      title="实时交易流水"
      en="LIVE TAPE"
      actions={
        <>
          <button type="button" className={`${styles.assetSelect}`} onClick={handlePause} style={{ width: 74 }}>
            {paused ? <Play size={10} /> : <Pause size={10} />}
            {paused ? '恢复' : '暂停'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: paused ? 'var(--amber)' : 'var(--green)' }}>
            {paused ? 'FROZEN' : '1.5s'}
          </span>
        </>
      }
    >
      <div className={styles.tapeHead}>
        <span>TIME</span>
        <span>ASSET / ROUTE</span>
        <span style={{ textAlign: 'right' }}>NOTIONAL</span>
        <span style={{ textAlign: 'right' }}>STATE</span>
      </div>
      <div className={styles.tapeBody}>
        {rows.length === 0 && <div className={styles.depthMeta}>等待实时数据流…</div>}
        {rows.map((trade) => (
          <button
            key={trade.id}
            type="button"
            className={styles.tapeRow}
            onClick={() => openTrade(trade.id)}
          >
            <span className={styles.tapeTime}>{formatClock(trade.ts)}</span>
            <span className={styles.tapeAsset}>
              <b>{trade.asset}</b>
              <span className={styles.tapeRoute}>
                {trade.fromNodeName} → {trade.toNodeName}
              </span>
            </span>
            <span className={styles.tapeAmount}>{formatUsdCompact(trade.amount)}</span>
            <span className={styles.tapeStatus}>
              <StatusTag status={trade.status} />
            </span>
          </button>
        ))}
      </div>
    </HudCard>
  );
}

export function AlertFeed() {
  const alerts = useStreamStore((state) => state.alerts);
  const token = useAuthStore((state) => state.token);
  const markAlertHandled = useStreamStore((state) => state.markAlertHandled);
  const { can } = usePermission();
  const openTrade = useUiStore((state) => state.openTrade);
  const openNode = useUiStore((state) => state.openNode);
  const toast = useUiStore((state) => state.toast);
  const unresolved = alerts.filter((alert) => !alert.handled).length;
  const rows = alerts.slice(0, 12);

  const handleResolve = async (alertId: string) => {
    if (!token) return;
    try {
      const result = await adminApi.handleAlert(token, alertId, true);
      markAlertHandled(result.alert);
      toast('success', '告警已标记处置');
    } catch {
      toast('danger', '告警处置失败');
    }
  };

  return (
    <HudCard
      code="D-05"
      title="告警事件流"
      en="SIGNAL INBOX"
      actions={
        <>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: unresolved > 0 ? 'var(--red)' : 'var(--text-3)' }}>
            {String(unresolved).padStart(2, '0')} OPEN
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>LAST 24H</span>
        </>
      }
    >
      <div className={styles.alertBody}>
        {rows.length === 0 && <div className={styles.depthMeta}>暂无告警事件</div>}
        {rows.map((alert) => {
          const tone =
            alert.level === 'critical' ? styles.alertCritical : alert.level === 'warn' ? styles.alertWarn : '';
          return (
            <div
              key={alert.id}
              role="button"
              tabIndex={0}
              className={`${styles.alertRow} ${tone} ${alert.handled ? styles.alertHandled : ''}`}
              onClick={() => {
                if (alert.tradeId) openTrade(alert.tradeId);
                else if (alert.nodeId) openNode(alert.nodeId);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (alert.tradeId) openTrade(alert.tradeId);
                else if (alert.nodeId) openNode(alert.nodeId);
              }}
            >
              <span className={styles.alertBar} />
              <span className={styles.alertCopy}>
                <b>{alert.message}</b>
                <span>
                  {alert.type.toUpperCase()} · {alert.tradeId?.slice(-8) ?? 'SYSTEM'} · {alert.nodeId ?? 'N/A'}
                </span>
              </span>
              <span className={styles.alertTime}>{formatClock(alert.ts).slice(0, 5)}</span>
              {can('alert:handle') && !alert.handled && (
                <button
                  type="button"
                  className={styles.alertHandleBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleResolve(alert.id);
                  }}
                >
                  处置
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.alertFoot}>
        <span>LAST 15 MIN · AUTO TRIAGE ON</span>
        <span>{rows.filter((alert) => !alert.handled).length} UNRESOLVED</span>
      </div>
    </HudCard>
  );
}
