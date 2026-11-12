import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from '@/styles/ui.module.css';

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<Exclude<Variant, 'quiet'>, string> = {
  primary: styles.btnPrimary,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

export function NeonButton({
  variant = 'ghost',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: NeonButtonProps) {
  const variantClass = variant === 'quiet' ? '' : VARIANT_CLASS[variant];
  return (
    <button
      {...rest}
      className={`${styles.btn} ${variantClass} ${size === 'sm' ? styles.btnSm : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon}
      {children}
    </button>
  );
}
