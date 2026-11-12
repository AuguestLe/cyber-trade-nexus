import { CONFIG } from '../config.js';
import { MockProvider } from './mockProvider.js';

/**
 * Provider 工厂：当前只实现 mock。
 * 接入真实行情时新增 realProvider 并实现同一接口，再通过 DATA_PROVIDER 切换。
 */
export function createProvider(options = {}) {
  if (CONFIG.provider === 'real') {
    throw new Error('DATA_PROVIDER=real 尚未实现：请先接入 RealProvider 并实现 DataProvider 接口');
  }
  return new MockProvider({ seed: CONFIG.seed, ...options });
}

export { MockProvider };
