import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { echarts } from '@/charts/register';
import type { ChartEventParams } from '@/charts/EChart';
import type { ArcDTO, MapLayers, NodeDTO } from '@/types';
import type { MapAdapterListener } from './MapAdapter';
import { arcCurveness, arcMidpoint } from '@/lib/arc';
import { ASSET_CLASS_COLORS, NODE_STATUS_COLORS } from '@/lib/theme';
import { formatUsdCompact } from '@/lib/format';
import type { MapAdapter } from './MapAdapter';

const MAP_NAME = 'nexus-world';
const DEFAULT_VIEW = { center: [8, 18] as [number, number], zoom: 1.25 };

function nodePoint(node: NodeDTO): [number, number] {
  return [node.lon, node.lat];
}

function arcCoords(arc: ArcDTO, nodes: Map<string, NodeDTO>): [[number, number], [number, number]] | null {
  const from = nodes.get(arc.fromNodeId);
  const to = nodes.get(arc.toNodeId);
  if (!from || !to) return null;
  return [nodePoint(from), nodePoint(to)];
}

function isAnomaly(status: ArcDTO['status']): boolean {
  return status === 'failed' || status === 'flagged';
}

/**
 * ECharts geo + lines 实现（PRD 10.1 方案 D）。
 * - 视觉弧线由 lines 绘制，silent 命中层由透明 scatter 承担，保证 hover/click 稳定。
 * - 每类资产一个 series，异常单独 series；effect 提供流动粒子。
 */
export class EChartsMapAdapter implements MapAdapter {
  private chart: ECharts | null = null;
  private nodes: NodeDTO[] = [];
  private arcs: ArcDTO[] = [];
  private layers: MapLayers = {
    borders: true,
    grid: true,
    nodes: true,
    arcs: true,
    heat: false,
    labels: true,
  };
  private heat: 'off' | 'routes' | 'amount' = 'off';
  private selected: string | null = null;
  private listener: MapAdapterListener | null = null;
  private frame = 0;
  private geoReady = false;
  private resizeObserver: ResizeObserver | null = null;
  private nodeMap = new Map<string, NodeDTO>();
  private view: { center: [number, number]; zoom: number } = { ...DEFAULT_VIEW };
  private hovered: string | null = null;

  mount(element: HTMLElement, geo: unknown): void {
    echarts.registerMap(MAP_NAME, geo as never);
    this.geoReady = true;
    this.chart = echarts.init(element, undefined, { renderer: 'canvas' });
    // 诊断钩子：仅暴露图表实例，便于自动化脚本校验拾取坐标，不含业务数据
    Object.defineProperty(element, '__nxMapChart', { value: this.chart, configurable: true });
    this.chart.on('click', this.handleClick);
    this.chart.on('mouseover', this.handleMouseOver);
    this.chart.on('mouseout', this.handleMouseOut);
    this.chart.on('georoam', this.handleGeoRoam);
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(element);
    this.render();
  }

  setNodes(nodes: NodeDTO[]): void {
    this.nodes = nodes;
    this.nodeMap = new Map(nodes.map((node) => [node.id, node]));
    this.schedule();
  }

  setArcs(arcs: ArcDTO[]): void {
    this.arcs = arcs;
    this.schedule();
  }

  setLayers(layers: MapLayers): void {
    this.layers = layers;
    this.schedule();
  }

  setHeat(mode: 'off' | 'routes' | 'amount'): void {
    this.heat = mode;
    this.schedule();
  }

  setSelected(arcId: string | null): void {
    this.selected = arcId;
    this.schedule();
  }

  zoomBy(factor: number): void {
    if (!this.chart) return;
    this.view = { ...this.view, zoom: Math.min(6, Math.max(0.7, this.view.zoom * factor)) };
    this.chart.setOption({ geo: { zoom: this.view.zoom } });
  }

  resetView(): void {
    this.view = { ...DEFAULT_VIEW };
    this.chart?.setOption({ geo: { ...DEFAULT_VIEW } });
  }

  focusNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node || !this.chart) return;
    const target: [number, number] = [node.lon, node.lat];
    const reduce = document.documentElement.dataset.motion === 'reduced';
    if (reduce) {
      this.view = { center: target, zoom: 2.4 };
      this.chart.setOption({ geo: { center: target, zoom: 2.4 } });
      return;
    }
    const fromCenter = this.view.center;
    const startZoom = this.view.zoom;
    const started = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const center: [number, number] = [
        fromCenter[0] + (target[0] - fromCenter[0]) * eased,
        fromCenter[1] + (target[1] - fromCenter[1]) * eased,
      ];
      const zoom = startZoom + (2.4 - startZoom) * eased;
      this.view = { center, zoom };
      this.chart?.setOption({ geo: { center, zoom } });
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  resize(): void {
    this.chart?.resize();
  }

  on(listener: MapAdapterListener): void {
    this.listener = listener;
  }

  dispose(): void {
    window.cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.chart) {
      this.chart.off('click', this.handleClick);
      this.chart.off('mouseover', this.handleMouseOver);
      this.chart.off('mouseout', this.handleMouseOut);
      this.chart.off('georoam', this.handleGeoRoam);
      this.chart.dispose();
      this.chart = null;
    }
  }

  private handleGeoRoam = () => {
    if (!this.chart) return;
    const option = this.chart.getOption() as {
      geo?: Array<{ center?: [number, number]; zoom?: number }>;
    };
    const geo = option.geo?.[0];
    if (!geo) return;
    if (geo.center) {
      this.view = {
        center: [Number(geo.center[0]) || 0, Number(geo.center[1]) || 0],
        zoom: Number(geo.zoom) || this.view.zoom,
      };
    } else if (geo.zoom) {
      this.view = { ...this.view, zoom: Number(geo.zoom) };
    }
  };

  private pickData(params: ChartEventParams) {
    return params.data as
      | { arcId?: string; nodeId?: string; arc?: ArcDTO; node?: NodeDTO }
      | undefined;
  }

  private handleClick = (params: ChartEventParams) => {
    const seriesId = (params as { seriesId?: string }).seriesId;
    const data = this.pickData(params);
    if (!data) return;
    if (seriesId === 'arc-hit' && data.arcId) {
      this.listener?.({ type: 'arc-click', arcId: data.arcId });
    }
    if (seriesId === 'map-nodes' && data.nodeId) {
      this.listener?.({ type: 'node-click', nodeId: data.nodeId });
    }
  };

  private handleMouseOver = (params: ChartEventParams) => {
    const seriesId = (params as { seriesId?: string }).seriesId;
    const data = this.pickData(params);
    if (!data) return;
    if (seriesId === 'arc-hit' && data.arcId) {
      this.hovered = data.arcId;
      this.listener?.({ type: 'arc-hover', arcId: data.arcId });
      this.schedule();
    }
    if (seriesId === 'map-nodes' && data.nodeId) {
      this.listener?.({ type: 'node-hover', nodeId: data.nodeId });
    }
  };

  private handleMouseOut = (params: ChartEventParams) => {
    const seriesId = (params as { seriesId?: string }).seriesId;
    if (seriesId === 'arc-hit') {
      this.hovered = null;
      this.listener?.({ type: 'arc-hover', arcId: null });
      this.schedule();
    }
    if (seriesId === 'map-nodes') {
      this.listener?.({ type: 'node-hover', nodeId: null });
    }
  };

  private schedule(): void {
    if (!this.geoReady) return;
    window.cancelAnimationFrame(this.frame);
    this.frame = window.requestAnimationFrame(() => this.render());
  }

  private render(): void {
    if (!this.chart) return;
    this.chart.setOption(this.buildOption(), { notMerge: true });
  }

  private buildOption(): EChartsCoreOption {
    const series: Array<Record<string, unknown>> = [];
    const arcMidpoints: Array<{ arc: ArcDTO; coord: [number, number]; color: string }> = [];

    for (const arc of this.arcs) {
      const coords = arcCoords(arc, this.nodeMap);
      if (!coords) continue;
      const anomaly = isAnomaly(arc.status);
      const color = anomaly ? '#ff4d6d' : ASSET_CLASS_COLORS[arc.assetClass];
      const width = 0.55 + Math.min(1.5, Math.log10(Math.max(arc.amount, 10)) - 4);
      const mid = arcMidpoint(coords[0], coords[1]);
      arcMidpoints.push({ arc, coord: mid, color });
      if (this.heat !== 'off') continue;

      const dataItem = {
        coords: [coords[0], coords[1]],
        name: `${arc.fromNodeName} → ${arc.toNodeName}`,
        lineStyle: {
          color,
          width: anomaly ? 2.4 : width,
          opacity: (this.selected ?? this.hovered) && (this.selected ?? this.hovered) !== arc.id ? 0.08 : anomaly ? 0.88 : 0.48,
          curveness: arcCurveness(coords[0][0], coords[0][1], coords[1][0], coords[1][1]),
          shadowBlur: anomaly ? 9 : 2, 
          shadowColor: color,
        },
        arcId: arc.id,
        arc,
      };

      const seriesId = anomaly ? 'arcs-anomaly' : `arcs-${arc.assetClass}`;
      let target = series.find((item) => (item as { id?: string }).id === seriesId) as
        | { type: string; coordinateSystem: string; id: string; symbol: string; polyline: boolean; effect: unknown; zlevel: number; silent: boolean; data: unknown[] }
        | undefined;
      if (!target) {
        target = {
          type: 'lines',
          coordinateSystem: 'geo',
          id: seriesId,
          zlevel: 2,
          silent: true,
          polyline: false,
          effect: anomaly && this.layers.arcs
            ? {
                show: true,
                period: 4.2,
                trailLength: 0.14,
                symbol: 'circle',
                symbolSize: 2.4,
                color: '#ff4d6d',
              }
            : this.layers.arcs && this.arcs.length <= 90
              ? {
                  show: true,
                  period: 6 + Math.random() * 3,
                  trailLength: 0.1,
                  symbol: 'circle',
                  symbolSize: 2,
                  color,
                }
              : { show: false },
          lineStyle: { width: 1 },
          data: [],
        } as never;
        series.push(target as never);
      }
      (target.data as unknown[]).push(dataItem);
    }

    // 异常线单独成组，颜色常亮并带闪烁感
    const selectedArc = this.selected ? this.arcs.find((arc) => arc.id === this.selected) : null;
    if (selectedArc && this.layers.arcs) {
      const coords = arcCoords(selectedArc, this.nodeMap);
      if (coords) {
        series.push({
          type: 'lines',
          coordinateSystem: 'geo',
          zlevel: 4,
          silent: true,
          effect: { show: true, period: 2.4, trailLength: 0.3, symbol: 'circle', symbolSize: 5, color: '#ffb547' },
          lineStyle: { color: '#ffb547', width: 3.4, opacity: 1, shadowBlur: 16, shadowColor: '#ffb547' },
          data: [{ coords: [coords[0], coords[1]], lineStyle: { curveness: arcCurveness(coords[0][0], coords[0][1], coords[1][0], coords[1][1]) } }],
        });
      }
    }

    if (this.layers.arcs) {
      const hitData = arcMidpoints.map(({ arc, coord }) => ({
        value: [coord[0], coord[1]],
        name: `${arc.fromNodeName} → ${arc.toNodeName}`,
        arcId: arc.id,
        arc,
        itemStyle: { color: 'rgba(0,240,255,0.02)' },
      }));
      series.push({
        id: 'arc-hit',
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 5,
        symbolSize: 16,
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const entry = (params as { data?: { arc?: ArcDTO } }).data;
            const arc = entry?.arc;
            if (!arc) return '';
            return `<div style="color:#8aa3c0;letter-spacing:.08em">ROUTE / ${arc.fromNodeName} → ${arc.toNodeName}</div>
              <div style="margin-top:4px;color:#e6f5ff">${formatUsdCompact(arc.amount)} · ${arc.count} 笔</div>
              <div style="color:#00f0ff">${arc.assetClass.toUpperCase()} · MAX ${arc.maxLatency}ms</div>`;
          },
        },
        data: hitData,
      } as never);
    }

    if (this.layers.nodes) {
      const maxVolume = Math.max(1, ...this.nodes.map((node) => node.volume24h));
      const labelIds = new Set(
        [...this.nodes]
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 10)
          .map((node) => node.id),
      );
      series.push({
        id: 'map-nodes',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 6,
        showEffectOn: 'render',
        rippleEffect: { brushType: 'stroke', scale: 2.6, period: 3.4 },
        symbolSize: (_value: unknown, params: unknown) => {
          const nodeId = (params as { data?: { nodeId?: string } }).data?.nodeId;
          const node = nodeId ? this.nodeMap.get(nodeId) : undefined;
          if (!node) return 8;
          return 7 + Math.sqrt(node.volume24h / maxVolume) * 20;
        },
        label: {
          show: this.layers.labels,
          position: 'right',
          color: 'rgba(230,245,255,0.72)',
          fontSize: 9,
          fontFamily: 'ui-monospace, Menlo, monospace',
          formatter: (params: unknown) => {
            const nodeId = (params as { data?: { nodeId?: string } }).data?.nodeId;
            const node = nodeId ? this.nodeMap.get(nodeId) : undefined;
            if (!node || !labelIds.has(node.id)) return '';
            return node.nameEn.toUpperCase();
          },
        },
        itemStyle: {
          color: (params: unknown) => {
            const nodeId = (params as { data?: { nodeId?: string } }).data?.nodeId;
            const node = nodeId ? this.nodeMap.get(nodeId) : undefined;
            return node ? NODE_STATUS_COLORS[node.status] : '#00f0ff';
          },
          shadowBlur: 10,
          shadowColor: 'rgba(0,240,255,0.3)',
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const nodeId = (params as { data?: { nodeId?: string } }).data?.nodeId;
            const node = nodeId ? this.nodeMap.get(nodeId) : undefined;
            if (!node) return '';
            return `<div style="color:#8aa3c0">${node.name} / ${node.nameEn.toUpperCase()}</div>
              <div style="color:#e6f5ff;font-size:15px;margin-top:4px">${formatUsdCompact(node.volume24h)}</div>
              <div style="color:#00f0ff">IN ${node.inCount24h} / OUT ${node.outCount24h} · HEALTH ${node.health}%</div>`;
          },
        },
        data: this.nodes.map((node) => ({
          value: [node.lon, node.lat],
          name: node.nameEn,
          nodeId: node.id,
          node,
          emphasis: { label: { show: true } },
        })),
      } as never);
    }

    if (this.heat !== 'off') {
      const maxWeight = Math.max(1, ...arcMidpoints.map(({ arc }) => (this.heat === 'routes' ? arc.count : arc.amount)));
      series.push({
        type: 'scatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        silent: true,
        symbolSize: (value: unknown) => {
          const raw = Array.isArray(value) ? Number(value[2] ?? 0) : 0;
          return 18 + Math.sqrt(raw / maxWeight) * 64;
        },
        itemStyle: { color: 'rgba(255,181,71,0.18)' },
        data: arcMidpoints.map(({ arc, coord }) => ({
          value: [coord[0], coord[1], this.heat === 'routes' ? arc.count : arc.amount],
        })),
      } as never);
    }

    // 按资产类别分组不足时，把空心数据补齐，保证图例类目存在
    if (series.length === 0) {
      series.push({ type: 'lines', coordinateSystem: 'geo', data: [] } as never);
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      geo: {
        map: MAP_NAME,
        roam: true,
        zoom: this.view.zoom,
        center: this.view.center,
        scaleLimit: { min: 0.7, max: 6 },
        zlevel: 0,
        silent: false,
        itemStyle: {
          areaColor: 'rgba(6,14,26,0.72)',
          borderColor: this.layers.borders ? 'rgba(0,240,255,0.22)' : 'transparent',
          borderWidth: this.layers.borders ? 0.6 : 0,
          shadowBlur: 6,
          shadowColor: 'rgba(0,240,255,0.1)',
        },
        emphasis: {
          itemStyle: { areaColor: 'rgba(16,30,52,0.86)' },
          label: { show: false },
        },
        label: { show: false },
      },
      tooltip: {
        backgroundColor: 'rgba(6,11,20,0.96)',
        borderColor: 'rgba(0,240,255,0.32)',
        borderWidth: 1,
        textStyle: { color: '#e6f5ff', fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace' },
      },
      series: series as never,
    };
  }
}
