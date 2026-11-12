import {
  ALERT_LEVELS,
  ALERT_TYPES,
  ASSET_CLASSES,
  CONFIG,
  SORT_DIRS,
  SORT_FIELDS,
  TRADE_STATUSES,
} from '../config.js';
import { validationError } from './errors.js';

export function parseEnum(value, allowed, field, fallback = null) {
  if (value == null || value === '') return fallback;
  if (!allowed.includes(value)) {
    throw validationError(`${field} 必须是 ${allowed.join('/')} 之一`, { field, value });
  }
  return value;
}

export function parseStringParam(value, field, { max = 80, fallback = null } = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') throw validationError(`${field} 必须是字符串`, { field });
  const trimmed = value.trim();
  if (trimmed.length > max) throw validationError(`${field} 长度不得超过 ${max}`, { field, max });
  return trimmed || fallback;
}

export function parseIntParam(value, field, { min = -Infinity, max = Infinity, fallback }) {
  if (value == null || value === '') {
    if (fallback === undefined) throw validationError(`${field} 必填`, { field });
    return fallback;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw validationError(`${field} 必须是 ${min}~${max} 之间的整数`, { field, value });
  }
  return num;
}

export function parseNumberParam(value, field, { min = 0, max = Infinity, fallback = null } = {}) {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw validationError(`${field} 必须是 ${min}~${max} 之间的数字`, { field, value });
  }
  return num;
}

export function parseBooleanParam(value, field, fallback = null) {
  if (value == null || value === '') return fallback;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw validationError(`${field} 必须是布尔值`, { field, value });
}

export function parseWindow(value) {
  return parseEnum(value, CONFIG.ranges, 'window', '24h');
}

export function parseTradeQuery(query) {
  const page = parseIntParam(query.page, 'page', { min: 1, max: 100_000, fallback: 1 });
  const pageSize = parseIntParam(query.pageSize, 'pageSize', { min: 1, max: 200, fallback: 50 });
  const minAmount = parseNumberParam(query.minAmount, 'minAmount', { min: 0 });
  const maxAmount = parseNumberParam(query.maxAmount, 'maxAmount', { min: 0 });
  if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
    throw validationError('minAmount 不得大于 maxAmount', { minAmount, maxAmount });
  }
  const from = parseNumberParam(query.from, 'from', { min: 0, max: 9_999_999_999_999 });
  const to = parseNumberParam(query.to, 'to', { min: 0, max: 9_999_999_999_999 });
  if (from != null && to != null && from >= to) {
    throw validationError('from 必须小于 to', { from, to });
  }
  return {
    search: parseStringParam(query.search, 'search', { max: 80 }),
    assetClass: parseEnum(query.assetClass, ASSET_CLASSES, 'assetClass'),
    status: parseEnum(query.status, TRADE_STATUSES, 'status'),
    side: parseEnum(query.side, ['buy', 'sell'], 'side'),
    nodeId: parseStringParam(query.nodeId, 'nodeId', { max: 32 }),
    country: parseStringParam(query.country, 'country', { max: 32 }),
    minAmount,
    maxAmount,
    from,
    to,
    sortBy: parseEnum(query.sortBy, SORT_FIELDS, 'sortBy', 'ts'),
    sortDir: parseEnum(query.sortDir, SORT_DIRS, 'sortDir', 'desc'),
    page,
    pageSize,
  };
}

export function parseArcQuery(query) {
  const base = parseTradeQuery(query);
  const from = base.from;
  const to = base.to;
  const limit = parseIntParam(query.limit, 'limit', { min: 1, max: CONFIG.arcLimit, fallback: 120 });
  return {
    window: parseWindow(query.window),
    assetClass: base.assetClass,
    status: base.status,
    minAmount: base.minAmount,
    maxAmount: base.maxAmount,
    nodeId: base.nodeId,
    country: base.country,
    limit,
    from,
    to: to ?? Date.now(),
  };
}

export function parseAlertQuery(query) {
  return {
    level: parseEnum(query.level, ALERT_LEVELS, 'level'),
    handled: parseBooleanParam(query.handled, 'handled'),
    limit: parseIntParam(query.limit, 'limit', { min: 1, max: 200, fallback: 60 }),
  };
}

export function parseInjectBody(body) {
  const type = parseEnum(body?.type, ALERT_TYPES.filter((item) => item !== 'node_offline'), 'type');
  if (!type) throw validationError('type 必填', { field: 'type' });
  return {
    type,
    assetClass: parseEnum(body?.assetClass, ASSET_CLASSES, 'assetClass'),
    nodeId: parseStringParam(body?.nodeId, 'nodeId', { max: 32 }),
  };
}

export function parseSeed(value) {
  return parseIntParam(value, 'seed', { min: 1, max: 2_147_483_646, fallback: CONFIG.seed });
}
