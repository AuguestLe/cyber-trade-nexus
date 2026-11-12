import styles from '@/styles/ui.module.css';

export type TagStatus =
  | 'filled'
  | 'pending'
  | 'failed'
  | 'flagged'
  | 'normal'
  | 'busy'
  | 'alert'
  | 'info'
  | 'warn'
  | 'critical';

const CLASS_MAP: Record<TagStatus, string> = {
  filled: styles.tagFilled,
  pending: styles.tagPending,
  failed: styles.tagFailed,
  flagged: styles.tagFlagged,
  normal: styles.tagNormal,
  busy: styles.tagBusy,
  alert: styles.tagAlert,
  info: styles.tagInfo,
  warn: styles.tagWarn,
  critical: styles.tagCritical,
};

const LABELS: Record<TagStatus, string> = {
  filled: 'FILLED',
  pending: 'PENDING',
  failed: 'FAILED',
  flagged: 'FLAGGED',
  normal: 'NORMAL',
  busy: 'BUSY',
  alert: 'ALERT',
  info: 'INFO',
  warn: 'WARN',
  critical: 'CRITICAL',
};

export function StatusTag({ status, label }: { status: TagStatus; label?: string }) {
  return <span className={`${styles.tag} ${CLASS_MAP[status]}`}>{label ?? LABELS[status]}</span>;
}
