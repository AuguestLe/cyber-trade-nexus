/**
 * 静态种子数据：节点、资产、账号、告警文案模板。
 * 所有数值均为演示用途，不代表真实市场。
 */

export const DEMO_USERS = [
  {
    id: 'u_admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    displayName: '系统管理员',
    enabled: true,
    lastLoginAt: null,
  },
  {
    id: 'u_viewer',
    username: 'viewer',
    password: 'viewer123',
    role: 'viewer',
    displayName: '观察员',
    enabled: true,
    lastLoginAt: null,
  },
  {
    id: 'u_trader_li',
    username: 'trader_li',
    password: 'demo123',
    role: 'viewer',
    displayName: '交易员·李',
    enabled: true,
    lastLoginAt: null,
  },
  {
    id: 'u_risk_chen',
    username: 'risk_chen',
    password: 'demo123',
    role: 'viewer',
    displayName: '风控·陈',
    enabled: true,
    lastLoginAt: null,
  },
  {
    id: 'u_ops_wang',
    username: 'ops_wang',
    password: 'demo123',
    role: 'viewer',
    displayName: '运维·王',
    enabled: true,
    lastLoginAt: null,
  },
  {
    id: 'u_analyst_zhao',
    username: 'analyst_zhao',
    password: 'demo123',
    role: 'viewer',
    displayName: '分析·赵',
    enabled: true,
    lastLoginAt: null,
  },
];

export const TRADE_NODES = [
  { id: 'n_sh', name: '上海', nameEn: 'Shanghai', country: '中国', countryCode: 'CN', lon: 121.4737, lat: 31.2304, type: 'exchange', weight: 9 },
  { id: 'n_hk', name: '香港（中国香港）', nameEn: 'Hong Kong', country: '中国香港', countryCode: 'HK', lon: 114.1694, lat: 22.3193, type: 'exchange', weight: 8 },
  { id: 'n_sz', name: '深圳', nameEn: 'Shenzhen', country: '中国', countryCode: 'CN', lon: 114.0579, lat: 22.5431, type: 'gateway', weight: 5 },
  { id: 'n_bj', name: '北京', nameEn: 'Beijing', country: '中国', countryCode: 'CN', lon: 116.4074, lat: 39.9042, type: 'clearing', weight: 4 },
  { id: 'n_tyo', name: '东京', nameEn: 'Tokyo', country: '日本', countryCode: 'JP', lon: 139.6917, lat: 35.6895, type: 'exchange', weight: 7 },
  { id: 'n_sin', name: '新加坡', nameEn: 'Singapore', country: '新加坡', countryCode: 'SG', lon: 103.8198, lat: 1.3521, type: 'exchange', weight: 7 },
  { id: 'n_sel', name: '首尔', nameEn: 'Seoul', country: '韩国', countryCode: 'KR', lon: 126.978, lat: 37.5665, type: 'gateway', weight: 4 },
  { id: 'n_bom', name: '孟买', nameEn: 'Mumbai', country: '印度', countryCode: 'IN', lon: 72.8777, lat: 19.076, type: 'exchange', weight: 5 },
  { id: 'n_dxb', name: '迪拜', nameEn: 'Dubai', country: '阿联酋', countryCode: 'AE', lon: 55.2708, lat: 25.2048, type: 'exchange', weight: 5 },
  { id: 'n_ruh', name: '利雅得', nameEn: 'Riyadh', country: '沙特阿拉伯', countryCode: 'SA', lon: 46.6753, lat: 24.7136, type: 'gateway', weight: 2 },
  { id: 'n_ldn', name: '伦敦', nameEn: 'London', country: '英国', countryCode: 'GB', lon: -0.1276, lat: 51.5072, type: 'exchange', weight: 9 },
  { id: 'n_fra', name: '法兰克福', nameEn: 'Frankfurt', country: '德国', countryCode: 'DE', lon: 8.6821, lat: 50.1109, type: 'exchange', weight: 6 },
  { id: 'n_zrh', name: '苏黎世', nameEn: 'Zurich', country: '瑞士', countryCode: 'CH', lon: 8.5417, lat: 47.3769, type: 'clearing', weight: 4 },
  { id: 'n_par', name: '巴黎', nameEn: 'Paris', country: '法国', countryCode: 'FR', lon: 2.3522, lat: 48.8566, type: 'gateway', weight: 3 },
  { id: 'n_ams', name: '阿姆斯特丹', nameEn: 'Amsterdam', country: '荷兰', countryCode: 'NL', lon: 4.9041, lat: 52.3676, type: 'gateway', weight: 3 },
  { id: 'n_mow', name: '莫斯科', nameEn: 'Moscow', country: '俄罗斯', countryCode: 'RU', lon: 37.6173, lat: 55.7558, type: 'gateway', weight: 2 },
  { id: 'n_nyc', name: '纽约', nameEn: 'New York', country: '美国', countryCode: 'US', lon: -74.006, lat: 40.7128, type: 'exchange', weight: 10 },
  { id: 'n_chi', name: '芝加哥', nameEn: 'Chicago', country: '美国', countryCode: 'US', lon: -87.6298, lat: 41.8781, type: 'clearing', weight: 5 },
  { id: 'n_tor', name: '多伦多', nameEn: 'Toronto', country: '加拿大', countryCode: 'CA', lon: -79.3832, lat: 43.6532, type: 'gateway', weight: 3 },
  { id: 'n_sfo', name: '旧金山', nameEn: 'San Francisco', country: '美国', countryCode: 'US', lon: -122.4194, lat: 37.7749, type: 'exchange', weight: 6 },
  { id: 'n_sao', name: '圣保罗', nameEn: 'Sao Paulo', country: '巴西', countryCode: 'BR', lon: -46.6333, lat: -23.5505, type: 'exchange', weight: 4 },
  { id: 'n_bue', name: '布宜诺斯艾利斯', nameEn: 'Buenos Aires', country: '阿根廷', countryCode: 'AR', lon: -58.3816, lat: -34.6037, type: 'gateway', weight: 2 },
  { id: 'n_mex', name: '墨西哥城', nameEn: 'Mexico City', country: '墨西哥', countryCode: 'MX', lon: -99.1332, lat: 19.4326, type: 'gateway', weight: 2 },
  { id: 'n_syd', name: '悉尼', nameEn: 'Sydney', country: '澳大利亚', countryCode: 'AU', lon: 151.2093, lat: -33.8688, type: 'exchange', weight: 5 },
  { id: 'n_mel', name: '墨尔本', nameEn: 'Melbourne', country: '澳大利亚', countryCode: 'AU', lon: 144.9631, lat: -37.8136, type: 'gateway', weight: 2 },
  { id: 'n_akl', name: '奥克兰', nameEn: 'Auckland', country: '新西兰', countryCode: 'NZ', lon: 174.7633, lat: -36.8485, type: 'gateway', weight: 1 },
  { id: 'n_cpt', name: '开普敦', nameEn: 'Cape Town', country: '南非', countryCode: 'ZA', lon: 18.4241, lat: -33.9249, type: 'gateway', weight: 2 },
  { id: 'n_jnb', name: '约翰内斯堡', nameEn: 'Johannesburg', country: '南非', countryCode: 'ZA', lon: 28.0473, lat: -26.2041, type: 'clearing', weight: 3 },
  { id: 'n_ist', name: '伊斯坦布尔', nameEn: 'Istanbul', country: '土耳其', countryCode: 'TR', lon: 28.9784, lat: 41.0082, type: 'gateway', weight: 2 },
  { id: 'n_osl', name: '奥斯陆', nameEn: 'Oslo', country: '挪威', countryCode: 'NO', lon: 10.7522, lat: 59.9139, type: 'gateway', weight: 1 },
];

export const ASSETS = [
  { asset: 'BTC/USD', assetClass: 'crypto', price: 68420.5, decimals: 2, tickPct: 0.0004, weight: 8 },
  { asset: 'ETH/USD', assetClass: 'crypto', price: 3286.42, decimals: 2, tickPct: 0.0005, weight: 6 },
  { asset: 'EUR/USD', assetClass: 'fx', price: 1.0842, decimals: 4, tickPct: 0.0002, weight: 9 },
  { asset: 'USD/JPY', assetClass: 'fx', price: 156.21, decimals: 2, tickPct: 0.0002, weight: 7 },
  { asset: 'GBP/USD', assetClass: 'fx', price: 1.2638, decimals: 4, tickPct: 0.0002, weight: 5 },
  { asset: '600519.SH', assetClass: 'equity', price: 1518.2, decimals: 2, tickPct: 0.0003, weight: 6 },
  { asset: '000001.SZ', assetClass: 'equity', price: 9.82, decimals: 2, tickPct: 0.0004, weight: 4 },
  { asset: 'AAPL', assetClass: 'equity', price: 248.32, decimals: 2, tickPct: 0.0003, weight: 6 },
  { asset: 'NVDA', assetClass: 'equity', price: 142.68, decimals: 2, tickPct: 0.0004, weight: 5 },
  { asset: 'XAU/USD', assetClass: 'commodity', price: 4195.6, decimals: 2, tickPct: 0.0003, weight: 5 },
  { asset: 'XAG/USD', assetClass: 'commodity', price: 48.27, decimals: 2, tickPct: 0.0004, weight: 3 },
  { asset: 'US10Y', assetClass: 'bond', price: 4.212, decimals: 3, tickPct: 0.0002, weight: 3 },
];

export const ALERT_MESSAGES = {
  large_trade: [
    '大额成交触发监控阈值',
    '单笔名义金额超出预警线',
    '大额资金划转已进入复核队列',
  ],
  latency_spike: [
    '网关端到端延迟尖峰',
    '清算链路响应超时',
    '撮合回报延迟超过 SLO',
  ],
  risk_hit: [
    '风险评分突破阈值',
    '异常价差触发风控规则',
    '对手方黑名单命中',
  ],
  node_offline: [
    '节点心跳丢失',
    '节点链路自动摘除',
  ],
};

export function nodeById(id) {
  return TRADE_NODES.find((node) => node.id === id) ?? null;
}

export function assetByCode(code) {
  return ASSETS.find((item) => item.asset === code) ?? null;
}

export function countryOfNode(id) {
  return nodeById(id)?.country ?? '未知';
}
