import { BarChart, EffectScatterChart, LineChart, LinesChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import * as echarts from 'echarts/core';

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  RadarChart,
  ScatterChart,
  EffectScatterChart,
  LinesChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  LegendComponent,
  TitleComponent,
  GeoComponent,
  RadarComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export { echarts };
