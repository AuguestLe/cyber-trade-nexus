/**
 * 交易明细页纯函数层：
 * - 虚拟滚动窗口计算（固定行高，overscan，边界收敛）
 * - 交易汇总（总成交额 / 异常率 / 延迟中位数）
 * - CSV 文本拼接（BOM、逗号/引号/换行转义）
 * - 金额输入解析、风险色阶、直播行合并
 * 不依赖 React / DOM，可被 Vitest 直接覆盖。
 */

import { formatDateTime } from '@/lib/format';
import { ASSET_CLASS_LABELS, STATUS_LABELS } from '@/lib/theme';
import type { AssetClass, Side, TradeDTO, TradeStatus } from '@/types';

export type TradeSortBy = 'ts' | 'amount' | 'latencyMs' | 'riskScore';
export type TradeSortDir = 'asc' | 'desc';

export interface TradeSortState {
  sortBy: TradeSortBy;
  sortDir: TradeSortDir;
}

export interface TradeFilterValues {
  search: string;
  assetClass: AssetClass | null;
  side: Side | null;
  status: TradeStatus | null;
  minAmount: number | null;
  maxAmount: number | null;
  nodeId: string | null;
}

export const DEFAULT_TRADE_FILTERS: TradeFilterValues = {
  search: '',
  assetClass: null,
  side: null,
  status: null,
  minAmount: null,
  maxAmount: null,
  nodeId: null,
};

/* ------------------------------------------------------------------ */
/* 虚拟滚动                                                             */
/* ------------------------------------------------------------------ */

export interface VirtualWindowInput {
  /** 当前滚动偏移（px），允许越界，函数内部收敛 */
  scrollTop: number;
  /** 可视区高度（px） */
  viewportHeight: number;
  /** 固定行高（px） */
  rowHeight: number;
  /** 逻辑总行数（服务端 total 或已加载行数，取较大值） */
  total: number;
  /** 上下额外渲染行数 */
  overscan?: number;
}

export interface VirtualWindow {
  /** 首个渲染行索引（含） */
  start: number;
  /** 末尾渲染行索引（不含） */
  end: number;
  /** 渲染窗口相对滚动内容顶部的偏移（px） */
  offsetY: number;
  /** 滚动内容总高度（px） */
  totalHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function computeVirtualWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  total,
  overscan = 6,
}: VirtualWindowInput): VirtualWindow {
  const safeRowHeight = rowHeight > 0 ? rowHeight : 1;
  const safeViewport = Math.max(0, viewportHeight);
  const safeTotal = Math.max(0, Math.floor(total));
  const safeOverscan = Math.max(0, Math.floor(overscan));

  const totalHeight = safeTotal * safeRowHeight;
  const maxScrollTop = Math.max(0, totalHeight - safeViewport);
  const clampedTop = clamp(scrollTop, 0, maxScrollTop);
  const firstVisible = Math.floor(clampedTop / safeRowHeight);
  const visibleCount = Math.ceil(safeViewport / safeRowHeight) + 1;

  const start = clamp(firstVisible - safeOverscan, 0, Math.max(0, safeTotal - 1));
  const end = clamp(firstVisible + visibleCount + safeOverscan, start, safeTotal);

  return {
    start,
    end,
    offsetY: start * safeRowHeight,
    totalHeight,
  };
}

/* ------------------------------------------------------------------ */
/* 汇总                                                                */
/* ------------------------------------------------------------------ */

export interface TradeSummary {
  count: number;
  amount: number;
  /** 失败 + 风控标记占已加载行比例，0~100 */
  anomalyRate: number;
  /** 延迟中位数（偶数取中间两值均值） */
  medianLatency: number;
}

export function summarizeTrades(rows: readonly TradeDTO[]): TradeSummary {
  const count = rows.length;
  if (count === 0) {
    return { count: 0, amount: 0, anomalyRate: 0, medianLatency: 0 };
  }

  let amount = 0;
  let anomalies = 0;
  const latencies: number[] = [];

  for (const row of rows) {
    amount += Number.isFinite(row.amount) ? row.amount : 0;
    if (row.status === 'failed' || row.status === 'flagged') anomalies += 1;
    latencies.push(Number.isFinite(row.latencyMs) ? row.latencyMs : 0);
  }

  latencies.sort((left, right) => left - right);
  const middle = Math.floor(count / 2);
  const medianLatency =
    count % 2 === 1
      ? (latencies[middle] ?? 0)
      : ((latencies[middle - 1] ?? 0) + (latencies[middle] ?? 0)) / 2;

  return {
    count,
    amount,
    anomalyRate: (anomalies / count) * 100,
    medianLatency,
  };
}

/* ------------------------------------------------------------------ */
/* 行格式化                                                             */
/* ------------------------------------------------------------------ */

export type RiskTone = 'low' | 'med' | 'high' | 'critical';

/** 风险分色阶：<35 青、<60 琥珀、<80 品红、其余红（状态色，不用于涨跌）。 */
export function riskTone(score: number): RiskTone {
  if (!Number.isFinite(score)) return 'low';
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'med';
  return 'low';
}

export function riskBarWidth(score: number): number {
  return clamp(Number.isFinite(score) ? score : 0, 0, 100);
}

/** 解析金额输入：空串 / 非法 / 负数 -> null。 */
export function parseAmountInput(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** CSV 用时间：本地时区 YYYY-MM-DD HH:mm:ss.SSS */
export function formatTradeTimestamp(ts: number): string {
  const date = new Date(ts);
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${formatDateTime(ts)}.${millis}`;
}

/* ------------------------------------------------------------------ */
/* 直播行合并                                                           */
/* ------------------------------------------------------------------ */

/** 直播行在前、分页行在后，按 id 去重（SSE 插入不重复拉全量）。 */
export function mergeTradeRows(
  liveRows: readonly TradeDTO[],
  serverRows: readonly TradeDTO[],
): TradeDTO[] {
  const seen = new Set<string>();
  const merged: TradeDTO[] = [];
  for (const trade of liveRows) {
    if (seen.has(trade.id)) continue;
    seen.add(trade.id);
    merged.push(trade);
  }
  for (const trade of serverRows) {
    if (seen.has(trade.id)) continue;
    seen.add(trade.id);
    merged.push(trade);
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/* CSV 导出文本                                                         */
/* ------------------------------------------------------------------ */

export const CSV_HEADER = [
  '时间',
  '交易ID',
  '卖方',
  '买方',
  '资产',
  '类别',
  '方向',
  '金额',
  '价格',
  '状态',
  '延迟',
  '风险分',
] as const;

/** RFC 4180 转义：含逗号 / 引号 / CR / LF 时包裹双引号，内部引号翻倍。 */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvPrice(price: number): string {
  return Number.isFinite(price) ? String(price) : '0';
}

function csvAmount(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

export function buildTradeCsvRow(trade: TradeDTO): string {
  const cells = [
    formatTradeTimestamp(trade.ts),
    trade.id,
    trade.fromNodeName,
    trade.toNodeName,
    trade.asset,
    ASSET_CLASS_LABELS[trade.assetClass],
    trade.side === 'sell' ? '卖出' : '买入',
    csvAmount(trade.amount),
    csvPrice(trade.price),
    STATUS_LABELS[trade.status],
    `${Math.round(trade.latencyMs)}ms`,
    trade.riskScore.toFixed(1),
  ];
  return cells.map((cell) => escapeCsvField(cell)).join(',');
}

/** 导出文本：UTF-8 BOM + 表头 + CRLF 行，末尾补换行。 */
export function buildTradesCsv(trades: readonly TradeDTO[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const trade of trades) {
    lines.push(buildTradeCsvRow(trade));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
