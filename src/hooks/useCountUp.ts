import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore } from '@/store/configStore';

/** 纯缓动：progress 0→1 时，数值从 0 ease-out 到 target。 */
export function countUpValue(target: number, progress: number): number {
  if (!Number.isFinite(target)) return target;
  const clamped = Math.max(0, Math.min(1, progress));
  return target * (1 - (1 - clamped) ** 3);
}

/**
 * 数字滚动：只在组件挂载（首次加载 / tab 切回）时从 0 滚到当前值一次。
 * 之后 SSE / 轮询改值直接落值，不再持续滚动——避免首页看起来一直在「加载」。
 * 降动效时全程直接落值。
 */
export function useCountUp(target: number, duration = 600): number {
  const motion = useConfigStore((state) => state.motion);
  const reduced = motion === 'reduced';
  const [display, setDisplay] = useState(() =>
    reduced || !Number.isFinite(target) ? target : 0,
  );
  const targetRef = useRef(target);
  const animatingRef = useRef(false);
  const frameRef = useRef(0);
  const prevRef = useRef({ target, reduced });

  // 入场动画：仅挂载时执行一次。
  useEffect(() => {
    const to = targetRef.current;
    if (reduced || !Number.isFinite(to) || to === 0) {
      setDisplay(to);
      return undefined;
    }
    const started = performance.now();
    animatingRef.current = true;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setDisplay(countUpValue(to, progress));
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        animatingRef.current = false;
      }
    };
    setDisplay(0);
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameRef.current);
      animatingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据更新：直接落值；若入场动画还没播完，则取消动画并追到最新值。
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { target, reduced };
    if (prev.target === target && prev.reduced === reduced) return;
    targetRef.current = target;
    if (animatingRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      animatingRef.current = false;
    }
    setDisplay(target);
  }, [target, reduced]);

  return display;
}

/** 全屏切换与浏览器事件同步。 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* 浏览器可能拒绝全屏，调用方负责提示 */
    }
  }, []);

  return { fullscreen, toggle };
}
