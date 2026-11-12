// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { isAuthRecord, useAuthStore } from '../authStore';
import { STORAGE_KEYS, STORAGE_VERSION } from '@/lib/storage';

const user = {
  id: 'u_admin',
  username: 'admin',
  displayName: '系统管理员',
  role: 'admin' as const,
  enabled: true,
  lastLoginAt: null,
};

const record = {
  token: 'nx_token',
  user,
  expiresAt: Date.now() + 3600_000,
  v: STORAGE_VERSION,
};

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ user: null, token: null, expiresAt: null, status: 'idle', error: null });
});

describe('authStore', () => {
  it('hydrate 恢复有效会话', () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(record));
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBe('nx_token');
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().role()).toBe('admin');
  });

  it('hydrate 清除过期会话', () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ ...record, expiresAt: Date.now() - 1 }));
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.auth)).toBeNull();
  });

  it('hydrate 忽略损坏或结构不合法的记录', () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, '{bad');
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe('idle');
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ token: 1 }));
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('clear 移除本地会话并清空状态', () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(record));
    useAuthStore.getState().hydrate();
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().token).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.auth)).toBeNull();
  });

  it('isAuthRecord 校验版本与用户结构', () => {
    expect(isAuthRecord(record)).toBe(true);
    expect(isAuthRecord({ ...record, v: 99 })).toBe(false);
    expect(isAuthRecord({ ...record, user: { ...user, role: 'guest' } })).toBe(false);
    expect(isAuthRecord(null)).toBe(false);
  });
});
