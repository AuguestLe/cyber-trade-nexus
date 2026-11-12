import { create } from 'zustand';
import { STORAGE_KEYS, STORAGE_VERSION, readStorage, writeStorage } from '@/lib/storage';
import type { MotionMode, Preferences, ThemeKey } from '@/types';

interface PrefsRecord extends Preferences {
  v: number;
}

const DEFAULTS: Preferences = {
  theme: 'cyan',
  motion: 'full',
  refreshMs: 2000,
  watermark: true,
};

export function isPrefsRecord(value: unknown): value is PrefsRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === STORAGE_VERSION &&
    ['cyan', 'amber', 'ice'].includes(String(record.theme)) &&
    ['full', 'reduced'].includes(String(record.motion)) &&
    [1000, 2000, 5000].includes(Number(record.refreshMs)) &&
    typeof record.watermark === 'boolean'
  );
}

interface ConfigState extends Preferences {
  fullscreen: boolean;
  setTheme(theme: ThemeKey): void;
  setMotion(motion: MotionMode): void;
  setRefresh(refreshMs: 1000 | 2000 | 5000): void;
  setWatermark(watermark: boolean): void;
  setFullscreen(fullscreen: boolean): void;
  hydrate(): void;
  reset(): void;
}

function applyDocument(prefs: Preferences): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.dataset.motion = prefs.motion;
}

function persist(theme: ThemeKey, motion: MotionMode, refreshMs: number, watermark: boolean): void {
  writeStorage(STORAGE_KEYS.prefs, { theme, motion, refreshMs, watermark, v: STORAGE_VERSION });
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  ...DEFAULTS,
  fullscreen: false,

  setTheme: (theme) => {
    set({ theme });
    applyDocument({ theme, motion: get().motion, refreshMs: get().refreshMs, watermark: get().watermark });
    persist(theme, get().motion, get().refreshMs, get().watermark);
  },

  setMotion: (motion) => {
    set({ motion });
    applyDocument({ theme: get().theme, motion, refreshMs: get().refreshMs, watermark: get().watermark });
    persist(get().theme, motion, get().refreshMs, get().watermark);
  },

  setRefresh: (refreshMs) => {
    set({ refreshMs });
    persist(get().theme, get().motion, refreshMs, get().watermark);
  },

  setWatermark: (watermark) => {
    set({ watermark });
    persist(get().theme, get().motion, get().refreshMs, watermark);
  },

  setFullscreen: (fullscreen) => set({ fullscreen }),

  hydrate: () => {
    const record = readStorage(STORAGE_KEYS.prefs, isPrefsRecord);
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fallback = { ...DEFAULTS, motion: prefersReduced ? ('reduced' as const) : DEFAULTS.motion };
    const prefs = record
      ? {
          theme: record.theme,
          motion: record.motion,
          refreshMs: record.refreshMs,
          watermark: record.watermark,
        }
      : fallback;
    set(prefs);
    applyDocument(prefs);
  },

  reset: () => {
    set(DEFAULTS);
    applyDocument(DEFAULTS);
    persist(DEFAULTS.theme, DEFAULTS.motion, DEFAULTS.refreshMs, DEFAULTS.watermark);
  },
}));
