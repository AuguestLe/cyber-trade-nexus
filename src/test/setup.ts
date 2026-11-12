/**
 * Node 26 的实验性 localStorage 会遮蔽 jsdom 的 storage，导致 window.localStorage 为 undefined。
 * 测试环境统一注入内存实现，行为与浏览器一致（字符串键值、长度、key 顺序）。
 */
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });
}
