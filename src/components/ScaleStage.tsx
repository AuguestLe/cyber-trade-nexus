import type { ReactNode } from 'react';
import styles from '@/styles/layout.module.css';

/**
 * 流式自适应画布：铺满视口，不再固定 1920×1080 等比缩放。
 * 各页面内部使用百分比/fr 布局，窗口任意大小都自动铺满，无黑边。
 */
export function ScaleStage({ children }: { children: ReactNode }) {
  return (
    <div className={styles.stage}>
      <div className={styles.canvas}>{children}</div>
    </div>
  );
}
