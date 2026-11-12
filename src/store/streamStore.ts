import { create } from 'zustand';
import type {
  AlertDTO,
  ConnectionState,
  KpiDTO,
  MarketDTO,
  MetaDTO,
  StreamStatusDTO,
  TradeDTO,
} from '@/types';

const TRADE_CAP = 1500;
const ALERT_CAP = 200;

interface StreamState {
  trades: TradeDTO[];
  alerts: AlertDTO[];
  kpis: KpiDTO[];
  markets: MarketDTO[];
  meta: MetaDTO | null;
  streamStatus: StreamStatusDTO | null;
  connection: ConnectionState;
  lastEventAt: number | null;
  pushTrade(trade: TradeDTO): void;
  pushAlert(alert: AlertDTO): void;
  replaceKpis(items: KpiDTO[]): void;
  replaceMarkets(items: MarketDTO[]): void;
  setMeta(meta: MetaDTO): void;
  setStreamStatus(status: StreamStatusDTO): void;
  setConnection(connection: ConnectionState): void;
  hydrateSnapshot(trades: TradeDTO[], alerts: AlertDTO[]): void;
  markAlertHandled(alert: AlertDTO): void;
  clearData(): void;
  resetStream(): void;
}

export const useStreamStore = create<StreamState>((set) => ({
  trades: [],
  alerts: [],
  kpis: [],
  markets: [],
  meta: null,
  streamStatus: null,
  connection: 'idle',
  lastEventAt: null,

  pushTrade: (trade) =>
    set((state) => {
      if (state.trades.some((item) => item.id === trade.id)) return state;
      const trades = [trade, ...state.trades];
      if (trades.length > TRADE_CAP) trades.length = TRADE_CAP;
      return { trades, lastEventAt: Date.now() };
    }),

  pushAlert: (alert) =>
    set((state) => {
      if (state.alerts.some((item) => item.id === alert.id)) return state;
      const alerts = [alert, ...state.alerts];
      if (alerts.length > ALERT_CAP) alerts.length = ALERT_CAP;
      return { alerts, lastEventAt: Date.now() };
    }),

  replaceKpis: (items) => set({ kpis: items, lastEventAt: Date.now() }),

  replaceMarkets: (items) => set({ markets: items, lastEventAt: Date.now() }),

  setMeta: (meta) => set({ meta }),

  setStreamStatus: (status) => set({ streamStatus: status }),

  setConnection: (connection) => set({ connection }),

  hydrateSnapshot: (trades, alerts) =>
    set({ trades: trades.slice(0, TRADE_CAP), alerts: alerts.slice(0, ALERT_CAP) }),

  markAlertHandled: (alert) =>
    set((state) => ({
      alerts: state.alerts.map((item) => (item.id === alert.id ? alert : item)),
    })),

  clearData: () => set({ trades: [], alerts: [] }),

  resetStream: () =>
    set({
      trades: [],
      alerts: [],
      kpis: [],
      markets: [],
      meta: null,
      streamStatus: null,
      connection: 'idle',
      lastEventAt: null,
    }),
}));

export { TRADE_CAP, ALERT_CAP };
