import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore } from '@/store/configStore';

/**
 * 数字滚动累加：600ms ease-out；降动效时直接落值。
 */
export function useCountUp(target: number, duration = 600): number {
  const motion = useConfigStore((state) => state.motion);
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (motion === 'reduced' || !Number.isFinite(target)) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + delta * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration, motion]);

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
