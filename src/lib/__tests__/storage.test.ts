// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '../storage';

interface RecordShape {
  v: number;
  theme: string;
}

function isRecord(value: unknown): value is RecordShape {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as RecordShape).v === 1 &&
      typeof (value as RecordShape).theme === 'string',
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('localStorage 安全读写', () => {
  it('写入后可读取并通过守卫', () => {
    expect(writeStorage(STORAGE_KEYS.prefs, { v: 1, theme: 'cyan' })).toBe(true);
    const value = readStorage(STORAGE_KEYS.prefs, isRecord);
    expect(value).toEqual({ v: 1, theme: 'cyan' });
  });

  it('损坏 JSON 返回 null 并清理键', () => {
    window.localStorage.setItem(STORAGE_KEYS.prefs, '{bad json');
    expect(readStorage(STORAGE_KEYS.prefs, isRecord)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.prefs)).toBeNull();
  });

  it('结构不合法时返回 null 并清理', () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ foo: 'bar' }));
    expect(readStorage(STORAGE_KEYS.auth, isRecord)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.auth)).toBeNull();
  });

  it('删除存储不抛错', () => {
    writeStorage(STORAGE_KEYS.auth, { v: 1, theme: 'amber' });
    removeStorage(STORAGE_KEYS.auth);
    expect(window.localStorage.getItem(STORAGE_KEYS.auth)).toBeNull();
    expect(() => removeStorage('missing')).not.toThrow();
  });
});
