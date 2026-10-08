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
export interface ChartClick {
  dataIndex: number;
  seriesIndex?: number;
  seriesName?: string;
  name?: string;
  data?: unknown;
  componentType?: string;
}

export default function EChart({
  option, height, ariaLabel, className = '', onClick,
}: {
  option: ChartOption;
  height: number;
  ariaLabel: string;
  className?: string;
  /** a data point (bar, dot, cell) was clicked; also any x position of an axis-tooltip chart */
  onClick?: (p: ChartClick) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  useEffect(() => { clickRef.current = onClick; });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = instance;
    instance.on('click', p => clickRef.current?.(p as unknown as ChartClick));
    // clicking anywhere in the plot of a line/bar chart selects the nearest x position
    instance.getZr().on('click', e => {
      if (!clickRef.current || e.target) return;
      const opt = instance.getOption() as { xAxis?: { type?: string; data?: unknown[] }[] };
      const axis = opt.xAxis?.[0];
      if (axis?.type !== 'category' || !instance.containPixel('grid', [e.offsetX, e.offsetY])) return;
      // grid finder: [x, y] in data space (an axis finder returns a bare number, or NaN outside it)
      const v = instance.convertFromPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY]) as unknown as number[] | number;
      const x = Array.isArray(v) ? v[0] : v;
      if (!Number.isFinite(x)) return;
      const i = Math.round(x);
      if (i >= 0 && i < (axis.data?.length ?? 0)) clickRef.current({ dataIndex: i, componentType: 'axis' });
    });
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

  return <div ref={ref} role="img" aria-label={ariaLabel} className={`w-full ${onClick ? 'cursor-pointer' : ''} ${className}`} style={{ height }} />;
}
