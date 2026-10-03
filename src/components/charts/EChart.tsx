'use client';

// Apache ECharts (canvas renderer), tree-shaken to the chart types the dashboard uses.

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([
  BarChart, HeatmapChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent,
  MarkPointComponent, TooltipComponent, VisualMapComponent, CanvasRenderer,
]);

export type ChartOption = EChartsCoreOption;

/**
 * One chart instance per mount; `option` replaces the previous one (memoise it
 * in the caller so the entry animation only runs when the data changes).
 */
export default function EChart({
  option, height, ariaLabel, className = '',
}: {
  option: ChartOption;
  height: number;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} role="img" aria-label={ariaLabel} className={`w-full ${className}`} style={{ height }} />;
}
