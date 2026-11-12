/**
 * localStorage 安全读写：损坏 JSON、隐私模式、配额异常均不阻断应用。
 */
export function readStorage<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validate(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* 忽略不可用的 storage */
    }
    return null;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 忽略隐私模式下的异常 */
  }
}

export const STORAGE_KEYS = {
  auth: 'nexus.auth',
  prefs: 'nexus.prefs',
} as const;

export const STORAGE_VERSION = 1;
