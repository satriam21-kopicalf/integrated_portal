// Shared ECharts styling: quiet axes and hairline grid so the data is the loud
// part; tooltips list values first. Labels coming from the API are escaped.

import { compactNumber, compactRupiah } from './overview';
import { fixed } from './format';

/** html.dark (2026-11-28): the charts read their ink when their option is built, so a page opened in dark mode draws
 *  them light on dark; the light values are unchanged. */
const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
const LIGHT = { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8', grid: '#eef2f6', axis: '#cbd5e1', previous: '#a8a29e', accent: '#2a78d6', tip: '#ffffff', tipLine: '#e2e8f0' };
const DARK = { primary: '#B6C2CF', secondary: '#9FADBC', muted: '#8C9BAB', grid: '#2C333A', axis: '#38414A', previous: '#738496', accent: '#8E95E6', tip: '#282E33', tipLine: '#38414A' };
export const INK = {
  get primary() { return (isDark() ? DARK : LIGHT).primary; },
  get secondary() { return (isDark() ? DARK : LIGHT).secondary; },
  get muted() { return (isDark() ? DARK : LIGHT).muted; },
  get grid() { return (isDark() ? DARK : LIGHT).grid; },
  get axis() { return (isDark() ? DARK : LIGHT).axis; },
  get previous() { return (isDark() ? DARK : LIGHT).previous; },
  get accent() { return (isDark() ? DARK : LIGHT).accent; },
};

export const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export const base = {
  get textStyle() { return { fontFamily: FONT, color: INK.secondary }; },
  animationDuration: 700,
  animationEasing: 'cubicOut' as const,
};

export function tooltip(extra: Record<string, unknown> = {}) {
  return {
    backgroundColor: (isDark() ? DARK : LIGHT).tip,
    borderColor: (isDark() ? DARK : LIGHT).tipLine,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: INK.primary, fontSize: 12, fontFamily: FONT },
    extraCssText: 'box-shadow:0 10px 24px -8px rgba(15,23,42,.25);border-radius:10px;',
    confine: true,
    ...extra,
  };
}

/** One tooltip row: coloured key, value (strong), label (muted). */
export function tipRow(color: string, value: string, label: string, shape: 'line' | 'square' = 'square'): string {
  const key = shape === 'line'
    ? `<span style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${color};margin-right:8px;vertical-align:middle"></span>`
    : `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:8px;vertical-align:middle"></span>`;
  return `<div style="display:flex;align-items:center;gap:0;line-height:20px">${key}<b style="font-variant-numeric:tabular-nums;margin-right:6px">${esc(value)}</b><span style="color:${INK.secondary}">${esc(label)}</span></div>`;
}

export function tipTitle(title: string): string {
  return `<div style="color:${INK.secondary};margin-bottom:4px;font-weight:500">${esc(title)}</div>`;
}

export function tipFooter(html: string): string {
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${(isDark() ? DARK : LIGHT).tipLine};color:${INK.secondary}">${html}</div>`;
}

export function valueAxis(format: (v: number) => string = compactNumber, extra: Record<string, unknown> = {}) {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: INK.grid } },
    axisLabel: { color: INK.muted, fontSize: 11, formatter: (v: number) => format(v) },
    ...extra,
  };
}

export function categoryAxis(data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: INK.axis } },
    axisTick: { show: false },
    axisLabel: { color: INK.muted, fontSize: 11, hideOverlap: true },
    ...extra,
  };
}

export const rupiahAxis = (v: number) => compactRupiah(v).replace('Rp ', 'Rp ');

export function changeHtml(pct: number | null | undefined, upIsGood = true): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return `<span style="color:${INK.muted}">no comparison</span>`;
  const good = pct === 0 ? null : (pct > 0) === upIsGood;
  const color = good === null ? INK.secondary : good ? '#047857' : '#be123c';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '■';
  return `<span style="color:${color};font-weight:600">${arrow} ${pct > 0 ? '+' : pct < 0 ? '−' : ''}${fixed(Math.abs(pct), 1)}%</span>`;
}
