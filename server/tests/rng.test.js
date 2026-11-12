import { describe, expect, it } from 'vitest';
import { clamp, exponential, hash32, mulberry32, pick, randInt, roundTo, seedFor, weightedPick } from '../core/rng.js';

describe('mulberry32', () => {
  it('同 seed 产生同序列且落在 [0,1)', () => {
    const a = mulberry32(20261112);
    const b = mulberry32(20261112);
    for (let i = 0; i < 100; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('不同 seed 产生不同序列', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe('seedFor / hash32', () => {
  it('seedFor 对同一标签稳定且不同标签不同', () => {
    expect(seedFor(42, 'trades')).toBe(seedFor(42, 'trades'));
    expect(seedFor(42, 'trades')).not.toBe(seedFor(42, 'alerts'));
    expect(hash32('trades')).toBeTypeOf('number');
  });
});

describe('数值工具', () => {
  it('clamp 边界', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-2, 1, 3)).toBe(1);
    expect(clamp(2, 1, 3)).toBe(2);
  });

  it('randInt 落在闭区间', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i += 1) {
      const value = randInt(rng, 3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('weightedPick 只返回列表内元素且偏好高权重', () => {
    const rng = mulberry32(9);
    const items = ['a', 'b'];
    const weights = [9, 1];
    let aCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const value = weightedPick(rng, items, weights);
      expect(items).toContain(value);
      if (value === 'a') aCount += 1;
    }
    expect(aCount).toBeGreaterThan(120);
  });

  it('exponential 与 roundTo 输出有限数值', () => {
    const rng = mulberry32(11);
    expect(exponential(rng, 100)).toBeGreaterThanOrEqual(0);
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.235, 2)).toBe(1.24);
    expect(pick(mulberry32(12), ['x', 'y'])).toMatch(/[xy]/);
  });
});
