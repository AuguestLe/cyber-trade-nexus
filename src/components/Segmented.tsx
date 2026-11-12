import styles from '@/styles/ui.module.css';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  ariaLabel: string;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`${styles.segItem} ${option.value === value ? styles.segActive : ''}`}
          onClick={() => onChange(option.value)}
          disabled={option.disabled}
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
