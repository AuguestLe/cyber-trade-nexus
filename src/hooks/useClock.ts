import { useEffect, useState } from 'react';

/** 每秒刷新的本地时钟，用于顶部栏与相对时间。 */
export function useClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
