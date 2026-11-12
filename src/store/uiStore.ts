import { create } from 'zustand';
import type { DrawerState, ToastItem } from '@/types';

interface UiState {
  drawer: DrawerState;
  toasts: ToastItem[];
  openTrade(id: string): void;
  openNode(id: string): void;
  closeDrawer(): void;
  toast(tone: ToastItem['tone'], message: string): void;
  dismissToast(id: string): void;
  clearToasts(): void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  drawer: { kind: null, id: null },
  toasts: [],

  openTrade: (id) => set({ drawer: { kind: 'trade', id } }),
  openNode: (id) => set({ drawer: { kind: 'node', id } }),
  closeDrawer: () => set({ drawer: { kind: null, id: null } }),

  toast: (tone, message) => {
    toastSeq += 1;
    const item: ToastItem = { id: `toast_${toastSeq}`, tone, message };
    set({ toasts: [...get().toasts.slice(-2), item] });
    window.setTimeout(() => {
      useUiStore.getState().dismissToast(item.id);
    }, 3200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((item) => item.id !== id) }),
  clearToasts: () => set({ toasts: [] }),
}));
