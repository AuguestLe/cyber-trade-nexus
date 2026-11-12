import { describe, expect, it } from 'vitest';
import { withUpdateMotion } from '../animation';

describe('withUpdateMotion', () => {
  it('首次挂载保留入场动画', () => {
    const option = { animation: true, series: [{ type: 'line' }] };
    expect(withUpdateMotion(option, true)).toBe(option);
  });

  it('后续更新关闭动画且不修改原 option', () => {
    const option = { animation: true, series: [{ type: 'line' }] };
    const next = withUpdateMotion(option, false);
    expect(next).not.toBe(option);
    expect(next.animation).toBe(false);
    expect(next.series).toEqual(option.series);
    expect(option.animation).toBe(true);
  });

  it('option 为空时也能安全合并', () => {
    expect(withUpdateMotion({}, false)).toEqual({ animation: false });
  });
});
