import { describe, expect, it } from 'vitest';
import { isGrowthJump } from '../useAnimationPulse';

describe('isGrowthJump', () => {
  it('增长达到阈值判定为跳变', () => {
    expect(isGrowthJump(100, 115, 0.15)).toBe(true);
    expect(isGrowthJump(100, 120, 0.15)).toBe(true);
  });

  it('增长不足阈值不判定为跳变', () => {
    expect(isGrowthJump(100, 110, 0.15)).toBe(false);
    expect(isGrowthJump(100, 114.9, 0.15)).toBe(false);
  });

  it('持平或下降不判定为跳变', () => {
    expect(isGrowthJump(100, 100, 0.15)).toBe(false);
    expect(isGrowthJump(100, 80, 0.15)).toBe(false);
  });

  it('基线或新值非法时安全返回 false', () => {
    expect(isGrowthJump(0, 50, 0.15)).toBe(false);
    expect(isGrowthJump(-1, 50, 0.15)).toBe(false);
    expect(isGrowthJump(Number.NaN, 50, 0.15)).toBe(false);
    expect(isGrowthJump(100, Number.NaN, 0.15)).toBe(false);
    expect(isGrowthJump(100, Number.POSITIVE_INFINITY, 0.15)).toBe(false);
  });

  it('阈值为 0 时任何正增长都算跳变', () => {
    expect(isGrowthJump(100, 101, 0)).toBe(true);
  });
});
