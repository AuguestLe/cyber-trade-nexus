// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { isPrefsRecord, useConfigStore } from '../configStore';
import { STORAGE_KEYS } from '@/lib/storage';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'cyan';
  document.documentElement.dataset.motion = 'full';
  useConfigStore.getState().reset();
});

describe('configStore', () => {
  it('切换主题与动效写入 localStorage 并更新 DOM', () => {
    useConfigStore.getState().setTheme('amber');
    useConfigStore.getState().setMotion('reduced');
    expect(document.documentElement.dataset.theme).toBe('amber');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.prefs) ?? '{}');
    expect(stored.theme).toBe('amber');
    expect(stored.motion).toBe('reduced');
  });

  it('hydrate 读取合法偏好，非法记录回退默认', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.prefs,
      JSON.stringify({ theme: 'ice', motion: 'reduced', refreshMs: 5000, watermark: false, v: 1 }),
    );
    useConfigStore.getState().hydrate();
    expect(useConfigStore.getState().theme).toBe('ice');
    expect(useConfigStore.getState().refreshMs).toBe(5000);
    expect(useConfigStore.getState().watermark).toBe(false);

    window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify({ theme: 'pink', v: 1 }));
    useConfigStore.getState().hydrate();
    expect(useConfigStore.getState().theme).toBe('cyan');
    expect(useConfigStore.getState().refreshMs).toBe(2000);
  });

  it('isPrefsRecord 拒绝非法枚举与版本', () => {
    expect(
      isPrefsRecord({ theme: 'cyan', motion: 'full', refreshMs: 2000, watermark: true, v: 1 }),
    ).toBe(true);
    expect(isPrefsRecord({ theme: 'cyan', motion: 'full', refreshMs: 999, watermark: true, v: 1 })).toBe(false);
    expect(isPrefsRecord({ theme: 'cyan', v: 2 })).toBe(false);
  });
});
