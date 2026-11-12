import { useMemo, useState } from 'react';
import { HudCard } from '@/components/HudCard';
import { EChart } from '@/charts/EChart';
import { buildDepthOption } from '@/charts/options';
import { LoadingBlock, ErrorState } from '@/components/States';
import { useResource } from '@/hooks/useResource';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { dataApi } from '@/api/endpoints';
import { formatPrice } from '@/lib/format';
import { ASSET_OPTIONS } from '@/lib/theme';
import styles from '@/styles/dashboard.module.css';

export function DepthPanel() {
  const token = useAuthStore((state) => state.token);
  const refreshMs = useConfigStore((state) => state.refreshMs);
  const motion = useConfigStore((state) => state.motion);
  const [asset, setAsset] = useState<string>('BTC/USD');

  const { data, loading, error, reload } = useResource(
    (signal) => dataApi.depth(token ?? '', asset, signal),
    [token, asset],
    { enabled: Boolean(token), refreshMs },
  );

  const option = useMemo(
    () => (data ? buildDepthOption(data, motion === 'reduced') : null),
    [data, motion],
  );

  return (
    <HudCard
      code="D-08"
      title="买卖盘深度"
      en="ORDERBOOK"
      actions={
        <select
          className={styles.assetSelect}
          value={asset}
          onChange={(event) => setAsset(event.target.value)}
          aria-label="选择盘口资产"
        >
          {ASSET_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      }
    >
      {loading && <LoadingBlock height={140} rows={2} />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && option && (
        <>
          <div className={styles.depthMeta}>
            <span>
              BID 12 / ASK 12 · SPREAD <b>{data.spread.toFixed(2)}</b>
            </span>
            <span>
              MID <b>{formatPrice(data.price, data.asset)}</b>
            </span>
          </div>
          <div className={styles.depthChart}>
            <EChart option={option} className={styles.chartCanvas} ariaLabel="买卖盘深度图" />
          </div>
        </>
      )}
    </HudCard>
  );
}
