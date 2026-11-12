import { create } from 'zustand';
import type { AssetClass, Side, TradeStatus, WindowKey } from '@/types';

export interface FilterState {
  range: WindowKey;
  hiddenAssetClasses: AssetClass[];
  assetClass: AssetClass | null;
  status: TradeStatus | null;
  side: Side | null;
  nodeId: string | null;
  country: string | null;
  search: string;
  minAmount: number | null;
  maxAmount: number | null;
  activeKpi: string | null;
  setRange(range: WindowKey): void;
  setAssetClass(assetClass: AssetClass | null): void;
  setStatus(status: TradeStatus | null): void;
  setSide(side: Side | null): void;
  setNode(nodeId: string | null, country?: string | null): void;
  setCountry(country: string | null): void;
  setSearch(search: string): void;
  setAmountRange(minAmount: number | null, maxAmount: number | null): void;
  setActiveKpi(key: string | null): void;
  toggleAssetClass(assetClass: AssetClass): void;
  reset(): void;
}

const INITIAL = {
  range: '24h' as WindowKey,
  hiddenAssetClasses: [] as AssetClass[],
  assetClass: null as AssetClass | null,
  status: null as TradeStatus | null,
  side: null as Side | null,
  nodeId: null as string | null,
  country: null as string | null,
  search: '',
  minAmount: null as number | null,
  maxAmount: null as number | null,
  activeKpi: null as string | null,
};

export const useFilterStore = create<FilterState>((set) => ({
  ...INITIAL,
  setRange: (range) => set({ range }),
  setAssetClass: (assetClass) => set({ assetClass }),
  setStatus: (status) => set({ status }),
  setSide: (side) => set({ side }),
  setNode: (nodeId, country = null) => set({ nodeId, country }),
  setCountry: (country) => set({ country, nodeId: null }),
  setSearch: (search) => set({ search }),
  setAmountRange: (minAmount, maxAmount) => set({ minAmount, maxAmount }),
  setActiveKpi: (activeKpi) => set({ activeKpi }),
  toggleAssetClass: (assetClass) =>
    set((state) => ({
      hiddenAssetClasses: state.hiddenAssetClasses.includes(assetClass)
        ? state.hiddenAssetClasses.filter((item) => item !== assetClass)
        : [...state.hiddenAssetClasses, assetClass],
    })),
  reset: () => set({ ...INITIAL }),
}));

export function assetClassVisible(hidden: AssetClass[], assetClass: AssetClass): boolean {
  return !hidden.includes(assetClass);
}
