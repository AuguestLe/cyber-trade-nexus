import type { ReactNode } from 'react';
import { useScale } from '@/hooks/useScale';
import styles from '@/styles/layout.module.css';

/** 1920×1080 固定画布 + 等比缩放，保证 1366×768~3840×2160 单屏可用。 */
export function ScaleStage({ children }: { children: ReactNode }) {
  const scale = useScale();
  return (
    <div className={styles.stage}>
      <div className={styles.canvas} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
