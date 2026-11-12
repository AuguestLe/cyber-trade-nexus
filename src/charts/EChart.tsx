import { useEffect, useRef } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { withUpdateMotion } from './animation';
import { echarts } from './register';

export interface ChartEventParams {
  componentType?: string;
  seriesType?: string;
  seriesIndex?: number;
  dataIndex?: number;
  data?: unknown;
  name?: string;
  event?: { offsetX: number; offsetY: number };
}

export type ChartEventHandlers = Partial<Record<string, (params: ChartEventParams) => void>>;

interface EChartProps {
  option: EChartsCoreOption;
  className?: string;
  style?: React.CSSProperties;
  onEvents?: ChartEventHandlers;
  ariaLabel?: string;
  notMerge?: boolean;
}

/** ECharts 生命周期封装：初始化一次、ResizeObserver、事件解绑、销毁。 */
export function EChart({ option, className, style, onEvents, ariaLabel, notMerge = true }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = echarts.init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    // 新图表实例 = 新页面挂载（首次加载 / tab 切回）：只允许这一轮播入场动画。
    hasAnimatedRef.current = false;

    let frame = 0;
    // 记录 init 时的尺寸：ResizeObserver 首次回调通常尺寸未变，
    // 无意义的 chart.resize() 会中断刚启动的入场动画，必须跳过。
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => chart.resize());
    });
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // 只有挂载后的第一次 setOption 带动画；轮询/流式更新一律静默落值。
    const animate = !hasAnimatedRef.current;
    hasAnimatedRef.current = true;
    chart.setOption(withUpdateMotion(option, animate), { notMerge });
  }, [option, notMerge]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return undefined;
    const bound = Object.entries(onEvents).map(([event, handler]) => {
      const wrapped = (params: unknown) => handler?.(params as ChartEventParams);
      chart.on(event, wrapped);
      return [event, wrapped] as const;
    });
    return () => {
      for (const [event, handler] of bound) chart.off(event, handler);
    };
  }, [onEvents]);

  return <div ref={containerRef} className={className} style={style} role="img" aria-label={ariaLabel} />;
}
