import { useEffect, useState } from 'react';

function computeScale(): number {
  if (typeof window === 'undefined') return 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const raw = Math.min(width / 1920, height / 1080);
  return Math.min(1.6, Math.max(0.55, raw));
}

/** 1920×1080 设计坐标 → 视口等比缩放（单层 transform，避免逐元素计算）。 */
export function useScale(): number {
  const [scale, setScale] = useState(computeScale);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setScale(computeScale()));
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    onResize();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
    };
  }, []);

  return scale;
}
