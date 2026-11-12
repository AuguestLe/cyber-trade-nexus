import type {
  ArcDTO,
  AssetClass,
  MapArcPoint,
  MapLayers,
  MapNodePoint,
  NodeDTO,
  StreamStatusDTO,
  TradeDTO,
  WindowKey,
} from '@/types';

export interface MapAdapterEvent {
  type: 'arc-hover' | 'arc-click' | 'node-hover' | 'node-click';
  arcId?: string | null;
  nodeId?: string | null;
}

export type MapAdapterListener = (event: MapAdapterEvent) => void;

export interface MapViewState {
  center: [number, number];
  zoom: number;
}

/**
 * 地图适配层接口：页面只依赖这组方法，ECharts/L7/OpenLayers 实现可替换。
 * Q1 选型变更只影响本目录。
 */
export interface MapAdapter {
  mount(element: HTMLElement, geo: unknown): void;
  setNodes(nodes: NodeDTO[]): void;
  setArcs(arcs: ArcDTO[]): void;
  setLayers(layers: MapLayers): void;
  setHeat(mode: 'off' | 'routes' | 'amount'): void;
  setSelected(arcId: string | null): void;
  focusNode(nodeId: string): void;
  zoomBy(factor: number): void;
  resetView(): void;
  resize(): void;
  dispose(): void;
  on(listener: MapAdapterListener): void;
}

export type { ArcDTO, AssetClass, MapArcPoint, MapLayers, MapNodePoint, StreamStatusDTO, TradeDTO, WindowKey };
