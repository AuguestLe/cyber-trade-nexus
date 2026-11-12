import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatCompactNumber,
  formatDelta,
  formatLatency,
  formatNumber,
  formatPct,
  formatPrice,
  formatSignedPct,
  formatUsdCompact,
  formatUsdFull,
  shortId,
} from '../format';

describe('金额与数字格式化', () => {
  it('大额美元使用 compact 单位', () => {
    expect(formatUsdCompact(48_620_000_000)).toMatch(/^\$48\.62B$/);
    expect(formatUsdCompact(12_500_000)).toMatch(/^\$12\.5M$/);
    expect(formatUsdCompact(500)).toBe('$500');
    expect(formatUsdCompact(Number.NaN)).toBe('$0');
  });

  it('完整美元保留千分位', () => {
    expect(formatUsdFull(1234567)).toBe('$1,234,567');
    expect(formatUsdFull(Number.NaN)).toBe('$0');
  });

  it('数字千分位与小数位', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(12.3456, 2)).toBe('12.35');
    expect(formatNumber(Number.NaN)).toBe('0');
  });

  it('百分比与带符号百分比', () => {
    expect(formatPct(99.93)).toBe('99.93%');
    expect(formatSignedPct(2.87)).toBe('+2.87%');
    expect(formatSignedPct(-0.18)).toBe('-0.18%');
    expect(formatPct(Number.NaN)).toBe('0.00%');
  });

  it('增量按单位格式化', () => {
    expect(formatDelta(3.2)).toBe('+3.20%');
    expect(formatDelta(-4.1, 'ms')).toBe('-4 ms');
    expect(formatDelta(5, 'count')).toBe('+5');
    expect(formatDelta(-2.2, 'index')).toBe('-2.2');
  });

  it('价格按资产精度格式化', () => {
    expect(formatPrice(1.0842, 'EUR/USD')).toBe('1.0842');
    expect(formatPrice(4.212, 'US10Y')).toBe('4.212');
    expect(formatPrice(68420.5, 'BTC/USD')).toBe('68,420.50');
  });

  it('时间、延迟、紧凑数字与 ID 截断', () => {
    expect(formatClock(1_763_000_000_000)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(formatLatency(38.4)).toBe('38ms');
    expect(formatCompactNumber(12_500)).toBe('12.5K');
    expect(formatCompactNumber(2_400_000)).toBe('2.40M');
    expect(formatCompactNumber(15)).toBe('15');
    expect(shortId('tx_abcdefghijklmnop', 8)).toBe('tx_abcde…');
    expect(shortId('short')).toBe('short');
  });
});
