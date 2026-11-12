import styles from '@/styles/ui.module.css';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/** 轻量 SVG 走势图：固定 viewBox，随容器宽高拉伸，不依赖图表库。 */
export function Sparkline({ points, width = 64, height = 16, color = '#00f0ff', className }: SparklineProps) {
  if (points.length < 2) {
    return <svg className={className} width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((point, index) => `${(index * step).toFixed(1)},${(height - ((point - min) / span) * (height - 2) - 1).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={coords} fill="none" stroke={color} strokeWidth={1} opacity={0.9} />
    </svg>
  );
}

export function InlineSpinner() {
  return <span className={styles.spinner} aria-hidden />;
}
