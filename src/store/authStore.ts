import { create } from 'zustand';
import { authApi } from '@/api/endpoints';
import { streamClient } from '@/api/sse';
import { ApiError } from '@/api/client';
import { STORAGE_KEYS, STORAGE_VERSION, readStorage, removeStorage, writeStorage } from '@/lib/storage';
import type { Role, User } from '@/types';

interface AuthRecord {
  token: string;
  user: User;
  expiresAt: number;
  v: number;
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.displayName === 'string' &&
    (user.role === 'admin' || user.role === 'viewer') &&
    typeof user.enabled === 'boolean'
  );
}

export function isAuthRecord(value: unknown): value is AuthRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === STORAGE_VERSION &&
    typeof record.token === 'string' &&
    record.token.length > 0 &&
    typeof record.expiresAt === 'number' &&
    isUser(record.user)
  );
}

interface AuthState {
  user: User | null;
  token: string | null;
  expiresAt: number | null;
  status: 'idle' | 'loading' | 'authenticated';
  error: string | null;
  login(username: string, password: string, remember: boolean): Promise<void>;
  logout(): Promise<void>;
  impersonate(userId: string): Promise<void>;
  hydrate(): void;
  clear(): void;
  setError(message: string | null): void;
  role(): Role | null;
}

function persist(auth: AuthRecord): void {
  writeStorage(STORAGE_KEYS.auth, auth);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  expiresAt: null,
  status: 'idle',
  error: null,

  hydrate: () => {
    const record = readStorage(STORAGE_KEYS.auth, isAuthRecord);
    if (!record) {
      set({ status: 'idle' });
      return;
    }
    if (record.expiresAt <= Date.now()) {
      removeStorage(STORAGE_KEYS.auth);
      set({ user: null, token: null, expiresAt: null, status: 'idle' });
      return;
    }
    set({
      user: record.user,
      token: record.token,
      expiresAt: record.expiresAt,
      status: 'authenticated',
    });
  },

  login: async (username, password, remember) => {
    set({ status: 'loading', error: null });
    try {
      const payload = await authApi.login(username.trim(), password, remember);
      const record: AuthRecord = { ...payload, v: STORAGE_VERSION };
      persist(record);
      set({
        user: payload.user,
        token: payload.token,
        expiresAt: payload.expiresAt,
        status: 'authenticated',
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '登录失败，请稍后重试';
      set({ status: 'idle', error: message });
      throw error;
    }
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        /* 登出接口失败也要清本地 */
      }
    }
    streamClient.stop();
    removeStorage(STORAGE_KEYS.auth);
    set({ user: null, token: null, expiresAt: null, status: 'idle', error: null });
  },

  impersonate: async (userId) => {
    const token = get().token;
    if (!token) throw new ApiError('UNAUTHORIZED', '当前会话已失效', 401);
    const payload = await authApi.impersonate(token, userId);
    const record: AuthRecord = { ...payload, v: STORAGE_VERSION };
    persist(record);
    set({
      user: payload.user,
      token: payload.token,
      expiresAt: payload.expiresAt,
      status: 'authenticated',
    });
    streamClient.stop();
  },

  clear: () => {
    streamClient.stop();
    removeStorage(STORAGE_KEYS.auth);
    set({ user: null, token: null, expiresAt: null, status: 'idle', error: null });
  },

  setError: (message) => set({ error: message }),

  role: () => get().user?.role ?? null,
}));
