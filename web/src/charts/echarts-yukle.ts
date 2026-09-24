// ECharts yalnız bu modülden ve yalnız kullanılan parçalarla yüklenir (ayrı parça / chunk).
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, TreemapChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart, LineChart, PieChart, TreemapChart, HeatmapChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent,
  CanvasRenderer,
]);

export default echarts;
