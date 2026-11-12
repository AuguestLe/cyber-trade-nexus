import type { ReactNode } from 'react';
import styles from '@/styles/ui.module.css';

interface HudCardProps {
  code?: string;
  title: string;
  en?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

export function HudCard({ code, title, en, actions, children, className, flush }: HudCardProps) {
  return (
    <section className={`${styles.hud} ${className ?? ''}`}>
      <header className={styles.hudHead}>
        {code && <span className={styles.hudTag}>{code}</span>}
        <h2 className={styles.hudTitle}>
          {title}
          {en && <b> / {en}</b>}
        </h2>
        {actions && <div className={styles.hudActions}>{actions}</div>}
      </header>
      <div className={`${styles.hudBody} ${flush ? styles.hudBodyFlush : ''}`}>{children}</div>
    </section>
  );
}
