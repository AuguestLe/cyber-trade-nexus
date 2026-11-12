import { ArrowRight, ListFilter } from 'lucide-react';
import { DataDrawer } from '@/components/DataDrawer';
import { NeonButton } from '@/components/NeonButton';
import { StatusTag } from '@/components/StatusTag';
import { formatDateTime, formatLatency, formatUsdCompact } from '@/lib/format';
import { ASSET_CLASS_LABELS } from '@/lib/theme';
import detailStyles from '@/styles/detail.module.css';
import styles from '@/styles/map.module.css';
import type { ArcDTO } from '@/types';

export function ArcDrawer({
  arc,
  onClose,
  onBrowse,
}: {
  arc: ArcDTO;
  onClose(): void;
  onBrowse(arc: ArcDTO): void;
}) {
  return (
    <DataDrawer
      code="ROUTE / DETAIL"
      title="航线详情"
      subtitle={`${arc.fromNodeName} → ${arc.toNodeName} · ${arc.assetClass.toUpperCase()}`}
      onClose={onClose}
      footer={
        <>
          <NeonButton variant="primary" size="sm" icon={<ListFilter size={12} />} onClick={() => onBrowse(arc)}>
            查看交易明细
          </NeonButton>
          <NeonButton variant="ghost" size="sm" onClick={onClose}>
            关闭
          </NeonButton>
        </>
      }
    >
      <div className={styles.arcHero}>
        <div className={styles.arcRoute}>AGGREGATED ROUTE / 聚合航线</div>
        <div className={styles.arcAmount}>{formatUsdCompact(arc.amount)}</div>
        <div className={styles.arcSub}>
          {ASSET_CLASS_LABELS[arc.assetClass]} · {arc.count} 笔 · 最新 {formatDateTime(arc.latestTs)}
        </div>
        <div style={{ marginTop: 10 }}>
          <StatusTag status={arc.status} />
        </div>
      </div>

      <div className={detailStyles.route}>
        <div>
          <div className={detailStyles.routeLabel}>SELLER / 卖方节点</div>
          <div className={detailStyles.routeName}>{arc.fromNodeName}</div>
          <div className={detailStyles.routeId}>{arc.fromNodeId}</div>
        </div>
        <div className={detailStyles.routeArrow} aria-hidden>
          <ArrowRight size={12} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={detailStyles.routeLabel}>BUYER / 买方节点</div>
          <div className={detailStyles.routeName}>{arc.toNodeName}</div>
          <div className={detailStyles.routeId}>{arc.toNodeId}</div>
        </div>
      </div>

      <div className={detailStyles.grid}>
        <div className={detailStyles.cell}>
          <div className={detailStyles.cellLabel}>TRADE COUNT</div>
          <div className={detailStyles.cellValue}>{arc.count}</div>
        </div>
        <div className={detailStyles.cell}>
          <div className={detailStyles.cellLabel}>MAX LATENCY</div>
          <div className={detailStyles.cellValue}>{formatLatency(arc.maxLatency)}</div>
        </div>
        <div className={detailStyles.cell}>
          <div className={detailStyles.cellLabel}>RISK SCORE</div>
          <div className={detailStyles.cellValue} style={{ color: arc.riskScore >= 80 ? 'var(--red)' : 'var(--text-1)' }}>
            {arc.riskScore.toFixed(1)}
          </div>
        </div>
        <div className={detailStyles.cell}>
          <div className={detailStyles.cellLabel}>LATEST EVENT</div>
          <div className={detailStyles.cellValue}>{formatDateTime(arc.latestTs)}</div>
        </div>
      </div>

      <div className={detailStyles.sectionTitle}>ROUTE NOTE / 航线说明</div>
      <p style={{ fontSize: 11, lineHeight: 1.9, color: 'var(--text-2)' }}>
        该航线为同一卖方节点、买方节点与资产类别的聚合视图。点击线束后若存在最新单笔交易，会直接打开交易详情；
        否则展示本聚合面板，并可跳转交易明细继续下钻。
      </p>
    </DataDrawer>
  );
}
