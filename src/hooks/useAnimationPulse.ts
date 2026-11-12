import { useEffect, useRef, useState } from 'react';

/** 纯判定：给定基线、新值与阈值，判断是否构成「真正跳变」。 */
export function isGrowthJump(baseline: number, next: number, growthThreshold: number): boolean {
  if (!Number.isFinite(baseline) || !Number.isFinite(next)) return false;
  if (baseline <= 0 || next <= 0) return false;
  if (next <= baseline) return false;
  return (next - baseline) / baseline >= growthThreshold;
}

interface PulseOptions {
  /** 相对上一次快照的增长率阈值（0~1），超过才判定为「真正跳变」。 */
  growthThreshold?: number;
  /** 两次重播之间的最小间隔（ms），避免连续跳变导致动画粘在一起。 */
  minIntervalMs?: number;
}

/**
 * 动画脉冲：只在「首次挂载 / 路由切回（组件重挂载）/ 数据真正跳变」时自增。
 * 「跳变」判定 = 数值相对基线增长超过 growthThreshold（默认 10%），
 * 而不是每来一条流数据就播，避免动画看起来一直在动。
 * 返回值作为 DOM key，使 CSS 有限次数动画重播一遍后定格。
 */
export function useAnimationPulse(value: number, options: PulseOptions = {}): number {
  const { growthThreshold = 0.1, minIntervalMs = 4000 } = options;
  const [pulse, setPulse] = useState(0);
  const valueRef = useRef(value);
  const baselineRef = useRef(value);
  const lastPulseAtRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) return;
    const prev = valueRef.current;
    valueRef.current = value;
    if (prev === value) return;

    const baseline = baselineRef.current;
    if (baseline <= 0) {
      baselineRef.current = value;
      return;
    }
    if (!isGrowthJump(baseline, value, growthThreshold)) return;

    const now = Date.now();
    if (now - lastPulseAtRef.current < minIntervalMs) return;

    // 达到跳变阈值：更新基线并重播一次动画。
    baselineRef.current = value;
    lastPulseAtRef.current = now;
    setPulse((current) => current + 1);
  }, [value, growthThreshold, minIntervalMs]);

  return pulse;
}
