const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const USD_FULL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const PLAIN = new Intl.NumberFormat('en-US');

export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1000) return USD_COMPACT.format(value);
  return `$${value.toFixed(0)}`;
}

export function formatUsdFull(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  return USD_FULL.format(value);
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0';
  if (digits === 0) return PLAIN.format(Math.round(value));
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0.00%';
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDelta(value: number, unit: 'pct' | 'ms' | 'index' | 'count' = 'pct'): string {
  const sign = value > 0 ? '+' : '';
  switch (unit) {
    case 'ms':
      return `${sign}${Math.round(value)} ms`;
    case 'count':
      return `${sign}${Math.round(value)}`;
    case 'index':
      return `${sign}${value.toFixed(1)}`;
    default:
      return `${sign}${value.toFixed(2)}%`;
  }
}

export function formatPrice(price: number, asset = ''): string {
  let digits = 2;
  if (asset.includes('/') && asset.startsWith('EUR')) digits = 4;
  if (asset === 'EUR/USD' || asset === 'GBP/USD') digits = 4;
  if (asset === 'US10Y') digits = 3;
  return price.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

export function formatClock(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatClockMs(ts: number): string {
  const date = new Date(ts);
  return `${formatClock(ts)}.${pad(date.getMilliseconds(), 3)}`;
}

export function formatDate(ts: number): string {
  const date = new Date(ts);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatDateTime(ts: number): string {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatClock(ts)}`;
}

export function formatLatency(ms: number): string {
  return `${Math.round(ms)}ms`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function shortId(id: string, length = 10): string {
  return id.length <= length ? id : `${id.slice(0, length)}…`;
}
