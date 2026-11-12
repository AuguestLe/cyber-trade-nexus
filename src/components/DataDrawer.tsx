import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from '@/styles/ui.module.css';

interface DataDrawerProps {
  code: string;
  title: string;
  subtitle?: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function DataDrawer({ code, title, subtitle, onClose, children, footer, width }: DataDrawerProps) {
  return (
    <>
      <div className={styles.drawerMask} onClick={onClose} aria-hidden />
      <aside
        className={styles.drawer}
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.drawerHead}>
          <div>
            <div className={styles.drawerCode}>{code}</div>
            <h3 className={styles.drawerTitle}>{title}</h3>
            {subtitle && <div className={styles.drawerSub}>{subtitle}</div>}
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="关闭抽屉">
            <X size={14} />
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        {footer && <footer className={styles.drawerFoot}>{footer}</footer>}
      </aside>
    </>
  );
}
