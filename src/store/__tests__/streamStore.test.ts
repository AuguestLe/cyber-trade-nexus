// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ALERT_CAP, TRADE_CAP, useStreamStore } from '../streamStore';
import type { AlertDTO, TradeDTO } from '@/types';

const trade: TradeDTO = {
  id: 'tx_1',
  ts: 1_763_000_000_000,
  fromNodeId: 'n_sh',
  toNodeId: 'n_nyc',
  fromNodeName: '上海',
  toNodeName: '纽约',
  asset: 'BTC/USD',
  assetClass: 'crypto',
  side: 'sell',
  amount: 1000,
  price: 68000,
  status: 'filled',
  latencyMs: 40,
  riskScore: 20,
};

const alert: AlertDTO = {
  id: 'al_1',
  ts: 1_763_000_000_000,
  level: 'warn',
  type: 'large_trade',
  tradeId: 'tx_1',
  nodeId: 'n_sh',
  message: '大额成交',
  handled: false,
  handledAt: null,
};

beforeEach(() => {
  useStreamStore.getState().resetStream();
});

describe('streamStore', () => {
  it('交易去重且数组有上限', () => {
    const store = useStreamStore.getState();
    store.pushTrade(trade);
    store.pushTrade(trade);
    expect(useStreamStore.getState().trades).toHaveLength(1);
    for (let i = 0; i < TRADE_CAP + 10; i += 1) {
      store.pushTrade({ ...trade, id: `tx_${i}` });
    }
    expect(useStreamStore.getState().trades.length).toBe(TRADE_CAP);
    expect(useStreamStore.getState().trades[0].id).not.toBe('tx_1');
  });

  it('告警去重且可标记处置', () => {
    const store = useStreamStore.getState();
    store.pushAlert(alert);
    store.pushAlert(alert);
    expect(useStreamStore.getState().alerts).toHaveLength(1);
    store.markAlertHandled({ ...alert, handled: true, handledAt: 1 });
    expect(useStreamStore.getState().alerts[0].handled).toBe(true);
    for (let i = 0; i < ALERT_CAP + 5; i += 1) {
      store.pushAlert({ ...alert, id: `al_${i}` });
    }
    expect(useStreamStore.getState().alerts.length).toBe(ALERT_CAP);
  });

  it('快照、KPI、行情与数据流状态可替换', () => {
    const store = useStreamStore.getState();
    store.hydrateSnapshot([trade], [alert]);
    expect(useStreamStore.getState().trades).toHaveLength(1);
    store.replaceKpis([{ key: 'trades', label: '笔数', value: 1, unit: 'count', deltaPct: 0, trend: 'flat' }]);
    expect(useStreamStore.getState().kpis).toHaveLength(1);
    store.replaceMarkets([
      { asset: 'BTC/USD', assetClass: 'crypto', price: 1, changePct: 1, sparkline: [1, 2] },
    ]);
    expect(useStreamStore.getState().markets).toHaveLength(1);
    store.setStreamStatus({ paused: true, speed: 1, intervalMs: 1500, clients: 1, uptimeMs: 10 });
    expect(useStreamStore.getState().streamStatus?.paused).toBe(true);
    store.setConnection('open');
    expect(useStreamStore.getState().connection).toBe('open');
    store.clearData();
    expect(useStreamStore.getState().trades).toHaveLength(0);
    expect(useStreamStore.getState().alerts).toHaveLength(0);
  });
});
