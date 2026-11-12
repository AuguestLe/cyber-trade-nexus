import { useState } from 'react';
import styles from '@/styles/ui.module.css';
import { NeonButton } from './NeonButton';

interface ConfirmDialogProps {
  open: boolean;
  code?: string;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm(): void | Promise<void>;
  onCancel(): void;
}

export function ConfirmDialog({
  open,
  code = 'CONFIRM',
  title,
  description,
  confirmText = '确认执行',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalMask} onClick={onCancel} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalCode}>{code}</div>
        <h3 className={styles.modalTitle}>{title}</h3>
        <p className={styles.modalDesc}>{description}</p>
        <div className={styles.modalActions}>
          <NeonButton variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelText}
          </NeonButton>
          <NeonButton
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            {confirmText}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
