import styles from '@/styles/ui.module.css';

export function LoadingBlock({ height = 120, rows = 1 }: { height?: number; rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height, minHeight: 0 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={styles.skeleton} style={{ flex: 1, minHeight: 10 }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.stateBox}>
      <span className={styles.stateTitle}>{title}</span>
      {description && <span className={styles.stateDesc}>{description}</span>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.stateBox} role="alert">
      <span className={styles.stateTitle} style={{ color: 'var(--red)' }}>
        数据链路异常
      </span>
      <span className={styles.stateDesc}>{message}</span>
      {onRetry && (
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}
