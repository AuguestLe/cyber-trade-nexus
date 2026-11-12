import { describe, expect, it } from 'vitest';
import { countUpValue } from '../useCountUp';

describe('countUpValue', () => {
  it('progress 0 从 0 起步，progress 1 落到目标值', () => {
    expect(countUpValue(1000, 0)).toBe(0);
    expect(countUpValue(1000, 1)).toBe(1000);
  });

  it('中间进度按 ease-out 递增且不超过目标', () => {
    expect(countUpValue(1000, 0.5)).toBeGreaterThan(500);
    expect(countUpValue(1000, 0.5)).toBeLessThan(1000);
    expect(countUpValue(1000, 0.25)).toBeLessThan(countUpValue(1000, 0.5));
  });

  it('进度超界时钳制在 0~1', () => {
    expect(countUpValue(1000, -1)).toBe(0);
    expect(countUpValue(1000, 2)).toBe(1000);
  });

  it('非法目标值原样返回，避免渲染 NaN', () => {
    expect(countUpValue(Number.NaN, 0.5)).toBeNaN();
    expect(countUpValue(Number.POSITIVE_INFINITY, 0.5)).toBe(Number.POSITIVE_INFINITY);
  });
});
