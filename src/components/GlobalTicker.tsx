import { useNavigate } from 'react-router-dom';
import { useStreamStore } from '@/store/streamStore';
import { useFilterStore } from '@/store/filterStore';
import { useUiStore } from '@/store/uiStore';
import { Sparkline } from '@/components/Sparkline';
import { formatPrice, formatSignedPct } from '@/lib/format';
import { ASSET_CLASS_EN } from '@/lib/theme';
import styles from '@/styles/layout.module.css';

export function GlobalTicker() {
  const markets = useStreamStore((state) => state.markets);
  const setAssetClass = useFilterStore((state) => state.setAssetClass);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  const ticks = markets.length > 0 ? markets : [];
  const loop = [...ticks, ...ticks];

  const handleClick = (assetClass: string) => {
    setAssetClass(assetClass as never);
    toast('info', '行情带已联动主图筛选');
    navigate('/');
  };

  return (
    <footer className={styles.ticker}>
      <div className={styles.tickerLabel}>
        <span className={styles.tickerLabelTitle}>MARKET TAPE</span>
        <span className={styles.tickerLabelSub}>DEMO / 模拟行情 · 涨红跌绿</span>
      </div>
      <div className={styles.tickerWindow}>
        {loop.length === 0 ? (
          <div className={styles.tick}>
            <span className={styles.tickAsset}>AWAITING TICK STREAM…</span>
          </div>
        ) : (
          <div className={styles.tickerTrack}>
            {loop.map((tick, index) => {
              const up = tick.changePct > 0;
              const tone = up ? 'var(--red)' : 'var(--green)';
              return (
                <div
                  key={`${tick.asset}-${index}`}
                  className={styles.tick}
                  onClick={() => handleClick(tick.assetClass)}
                  role="button"
                  tabIndex={-1}
                  aria-hidden={index >= ticks.length}
                >
                  <span className={styles.tickAsset}>{tick.asset}</span>
                  <span className={styles.tickPrice} style={{ color: tone }}>
                    {formatPrice(tick.price, tick.asset)}
                  </span>
                  <span className={styles.tickChange} style={{ color: tone }}>
                    {formatSignedPct(tick.changePct, 2)}
                  </span>
                  <span className={styles.tickClass}>{ASSET_CLASS_EN[tick.assetClass]}</span>
                  <Sparkline
                    className={styles.tickSpark}
                    points={tick.sparkline}
                    width={46}
                    height={12}
                    color={tone}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </footer>
  );
}
