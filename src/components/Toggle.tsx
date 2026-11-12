import { useId } from 'react';
import styles from '@/styles/ui.module.css';

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span className={styles.toggleTrack} aria-hidden>
        <span className={styles.toggleDot} />
      </span>
      {label && <span className={styles.toggleLabel}>{label}</span>}
    </label>
  );
}
