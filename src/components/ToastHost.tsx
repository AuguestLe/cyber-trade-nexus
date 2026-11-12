import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import styles from '@/styles/ui.module.css';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
} as const;

const CLASSES = {
  info: styles.toast,
  success: styles.toastSuccess,
  warn: styles.toastWarn,
  danger: styles.toastDanger,
} as const;

export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;
  return (
    <div className={styles.toastList} aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={CLASSES[toast.tone]} onClick={() => dismiss(toast.id)}>
            <Icon size={14} />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
