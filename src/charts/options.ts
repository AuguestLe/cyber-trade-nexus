import type { EChartsOption } from 'echarts';
import type {
  AssetClass,
  AssetShareDTO,
  DepthDTO,
  HealthDTO,
  RegionDTO,
  TimeseriesPoint,
} from '@/types';
import {
  ASSET_CLASS_COLORS,
  ASSET_CLASS_EN,
  ASSET_CLASS_LABELS,
  ASSET_CLASS_ORDER,
} from '@/lib/theme';
import { formatClock, formatCompactNumber, formatPrice, formatUsdCompact, formatUsdFull } from '@/lib/format';

const AXIS_LINE = 'rgba(0,240,255,0.16)';
const AXIS_LABEL = '#4b6480';
const SPLIT_LINE = 'rgba(0,240,255,0.07)';
const TOOLTIP_BG = 'rgba(6,11,20,0.96)';
const TOOLTIP_BORDER = 'rgba(0,240,255,0.32)';
const TEXT = '#e6f5ff';

function alpha(hex: string, value: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${value})`;
}

function tooltipBase(): NonNullable<EChartsOption['tooltip']> {
  return {
    backgroundColor: TOOLTIP_BG,
    borderColor: TOOLTIP_BORDER,
    borderWidth: 1,
    textStyle: { color: TEXT, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.45);',
  };
}

function axisCommon(): Record<string, unknown> {
  return {
    axisLine: { lineStyle: { color: AXIS_LINE } },
    axisTick: { show: false },
    axisLabel: { color: AXIS_LABEL, fontSize: 9, fontFamily: 'ui-monospace, Menlo, monospace' },
  };
}

interface TooltipRow {
  marker?: string;
  seriesName?: string;
  name?: string;
  value?: number | string | (number | string)[];
  color?: string;
}

function tooltipRows(params: unknown): TooltipRow[] {
  return Array.isArray(params) ? (params as TooltipRow[]) : [params as TooltipRow];
}

export function buildVolumeOption(
  points: TimeseriesPoint[],
  hidden: AssetClass[],
  reduceMotion = false,
): EChartsOption {
  const visible = ASSET_CLASS_ORDER.filter((assetClass) => !hidden.includes(assetClass));
  const labels = points.map((point) => formatClock(point.ts).slice(0, 5));
  const totals = points.map((point) => point.total);

  return {
    animation: !reduceMotion,
    animationDuration: 420,
    backgroundColor: 'transparent',
    grid: { left: 46, right: 16, top: 14, bottom: 24 },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: 'rgba(255,181,71,0.55)', width: 1, type: 'dashed' },
        crossStyle: { color: 'rgba(255,181,71,0.35)' },
        label: { backgroundColor: '#101a2e', color: '#e6f5ff', fontSize: 9 },
      },
      formatter: (params: unknown) => {
        const rows = tooltipRows(params);
        const time = rows[0]?.name ?? '';
        const lines = rows
          .filter((row) => typeof row.value === 'number')
          .map(
            (row) =>
              `<div style="display:flex;justify-content:space-between;gap:18px;line-height:1.7">` +
              `<span style="color:${row.color}">${row.marker ?? ''}${row.seriesName ?? ''}</span>` +
              `<span style="color:#e6f5ff">${formatUsdCompact(Number(row.value))}</span></div>`,
          )
          .join('');
        return `<div style="color:#8aa3c0;margin-bottom:6px;letter-spacing:.08em">${time}</div>${lines}`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      ...axisCommon(),
      axisLabel: {
        color: AXIS_LABEL,
        fontSize: 9,
        interval: Math.max(1, Math.floor(labels.length / 8)),
        fontFamily: 'ui-monospace, Menlo, monospace',
      },
    },
    yAxis: {
      type: 'value',
      ...axisCommon(),
      axisLabel: {
        color: AXIS_LABEL,
        fontSize: 9,
        formatter: (value: number) => formatCompactNumber(value),
        fontFamily: 'ui-monospace, Menlo, monospace',
      },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    series: [
      {
        name: 'TOTAL',
        type: 'line',
        smooth: 0.32,
        showSymbol: false,
        symbol: 'none',
        data: totals,
        lineStyle: { width: 1.6, color: 'rgba(0,240,255,0.55)' },
        areaStyle: { color: 'rgba(0,240,255,0.08)' },
        silent: true,
        z: 1,
      },
      ...visible.map((assetClass) => ({
        name: ASSET_CLASS_EN[assetClass],
        type: 'line',
        smooth: 0.32,
        showSymbol: false,
        symbol: 'none',
        data: points.map((point) => point[assetClass]),
        lineStyle: {
          width: 1,
          color: ASSET_CLASS_COLORS[assetClass],
          opacity: 0.85,
          shadowBlur: 4,
          shadowColor: alpha(ASSET_CLASS_COLORS[assetClass], 0.35),
        },
        itemStyle: { color: ASSET_CLASS_COLORS[assetClass] },
        emphasis: { focus: 'series' },
        z: 2,
      })),
    ] as EChartsOption['series'],
  };
}

export function buildAssetDonutOption(items: AssetShareDTO[], reduceMotion = false): EChartsOption {
  return {
    animation: !reduceMotion,
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      formatter: (params: unknown) => {
        const row = tooltipRows(params)[0];
        const classKey = row?.seriesName as AssetClass | undefined;
        const label = classKey ? ASSET_CLASS_LABELS[classKey] : row?.name ?? '';
        return `<div style="color:#8aa3c0">${label} / ${String(classKey ?? '').toUpperCase()}</div>
          <div style="font-size:16px;color:#e6f5ff;margin-top:4px">${formatUsdCompact(Number(row?.value ?? 0))}</div>
          <div style="color:#00f0ff">${String((row as { percent?: number }).percent ?? '')}% OF NOTIONAL</div>`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '48%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: {
          borderColor: '#05070d',
          borderWidth: 2,
          shadowBlur: 12,
          shadowColor: 'rgba(0,240,255,0.12)',
        },
        emphasis: { scale: true, scaleSize: 4, label: { show: false } },
        data: items.map((item) => ({
          name: item.label,
          value: item.amount,
          itemStyle: { color: ASSET_CLASS_COLORS[item.assetClass] },
        })),
      },
    ],
  };
}

export function buildRegionBarOption(items: RegionDTO[], reduceMotion = false): EChartsOption {
  const max = Math.max(...items.map((item) => item.amount), 1);
  const names = items.map((item) => item.country);
  const values = items.map((item) => item.amount);

  return {
    animation: !reduceMotion,
    backgroundColor: 'transparent',
    grid: { left: 76, right: 76, top: 4, bottom: 4 },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (params: unknown) => {
        const row = tooltipRows(params)[0];
        const index = Number((row as { dataIndex?: number }).dataIndex ?? 0);
        const item = items[index];
        if (!item) return '';
        return `<div style="color:#8aa3c0">${item.country}</div>
          <div style="font-size:15px;color:#e6f5ff">${formatUsdFull(item.amount)}</div>
          <div style="color:#00f0ff">${item.tradeCount} 笔 · ${item.pct}%</div>`;
      },
    },
    xAxis: { type: 'value', max, show: false },
    yAxis: {
      type: 'category',
      inverse: true,
      data: names,
      ...axisCommon(),
      axisLabel: {
        color: '#8aa3c0',
        fontSize: 10,
        width: 70,
        overflow: 'truncate',
        fontFamily: 'ui-monospace, Menlo, monospace',
      },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 8,
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color:
              index === 0
                ? 'rgba(255,43,214,0.9)'
                : index < 3
                  ? 'rgba(0,240,255,0.75)'
                  : 'rgba(0,240,255,0.35)',
            shadowBlur: index === 0 ? 10 : 0,
            shadowColor: 'rgba(0,240,255,0.4)',
          },
        })),
        label: {
          show: true,
          position: 'right',
          distance: 6,
          color: '#e6f5ff',
          fontSize: 9,
          fontFamily: 'ui-monospace, Menlo, monospace',
          formatter: (params: unknown) => formatUsdCompact(Number((params as { value?: number }).value ?? 0)),
        },
        showBackground: true,
        backgroundStyle: { color: 'rgba(0,240,255,0.04)' },
      },
    ],
  };
}

export function buildDepthOption(depth: DepthDTO, reduceMotion = false): EChartsOption {
  const bids = depth.bids.map(([, size]) => -size);
  const asks = depth.asks.map(([, size]) => size);
  const prices = [...depth.bids.map(([price]) => price), ...depth.asks.map(([price]) => price)];

  return {
    animation: !reduceMotion,
    backgroundColor: 'transparent',
    grid: { left: 56, right: 14, top: 10, bottom: 14 },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,240,255,0.05)' } },
      formatter: (params: unknown) => {
        const rows = tooltipRows(params);
        const index = Number((rows[0] as { dataIndex?: number }).dataIndex ?? 0);
        const isBid = index < depth.bids.length;
        const level = isBid ? depth.bids[index] : depth.asks[index - depth.bids.length];
        const price = level?.[0] ?? 0;
        const size = level?.[1] ?? 0;
        return `<div style="color:#8aa3c0">${formatPrice(price, depth.asset)}</div>
          <div style="color:${isBid ? '#00f0ff' : '#ff2bd6'};margin-top:4px">${isBid ? 'BID / 买盘' : 'ASK / 卖盘'}累计 ${size.toFixed(2)}</div>`;
      },
    },
    xAxis: {
      type: 'value',
      ...axisCommon(),
      splitLine: { lineStyle: { color: SPLIT_LINE } },
      axisLabel: {
        color: AXIS_LABEL,
        fontSize: 9,
        formatter: (value: number) => (value === 0 ? '0' : formatCompactNumber(Math.abs(value))),
      },
    },
    yAxis: {
      type: 'category',
      data: prices.map((price) => formatPrice(price, depth.asset)),
      ...axisCommon(),
      axisLabel: { color: AXIS_LABEL, fontSize: 9, show: false },
      splitLine: { show: false },
    },
    series: [
      {
        name: 'BID',
        type: 'bar',
        data: bids,
        barWidth: 7,
        itemStyle: { color: 'rgba(0,240,255,0.55)', shadowBlur: 6, shadowColor: 'rgba(0,240,255,0.25)' },
      },
      {
        name: 'ASK',
        type: 'bar',
        data: asks,
        barWidth: 7,
        itemStyle: { color: 'rgba(255,43,214,0.5)', shadowBlur: 6, shadowColor: 'rgba(255,43,214,0.22)' },
      },
    ],
  };
}

export function buildRadarOption(health: HealthDTO[], reduceMotion = false): EChartsOption {
  return {
    animation: !reduceMotion,
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      formatter: (params: unknown) => {
        const row = tooltipRows(params)[0];
        const values = ((row as { value?: Array<number | string> }).value ?? []) as Array<number | string>;
        return values
          .map((value, index) => {
            const item = health[index];
            return `<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8aa3c0">${item?.label ?? ''}</span><span style="color:#e6f5ff">${value}</span></div>`;
          })
          .join('');
      },
    },
    radar: {
      center: ['50%', '52%'],
      radius: '62%',
      splitNumber: 4,
      indicator: health.map((item) => ({ name: item.label.toUpperCase(), max: 100 })),
      axisName: { color: '#8aa3c0', fontSize: 9, fontFamily: 'ui-monospace, Menlo, monospace' },
      splitLine: { lineStyle: { color: 'rgba(0,240,255,0.12)' } },
      splitArea: { areaStyle: { color: ['rgba(0,240,255,0.02)', 'rgba(0,240,255,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(0,240,255,0.16)' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#00f0ff', width: 1.4, shadowBlur: 8, shadowColor: 'rgba(0,240,255,0.4)' },
        itemStyle: { color: '#00f0ff' },
        areaStyle: { color: 'rgba(0,240,255,0.14)' },
        data: [{ value: health.map((item) => item.score), name: 'HEALTH' }],
      },
    ],
  };
}
