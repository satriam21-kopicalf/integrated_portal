'use client';

// Monitoring COTR → Driver Check In → Location: the last position of every driver of the day on an OpenStreetMap map
// (Leaflet), coloured by how fresh it is, and the route of the driver picked (GET /api/cotr/locations[/driver],
// backend migration 048). Refreshed every 30 s for today.

import 'leaflet/dist/leaflet.css';
import type { CircleMarker, LayerGroup, Map as LeafletMap } from 'leaflet';
import { Battery, LocateFixed, Navigation, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Empty, ErrorState, Panel, cx } from '@/so/ui';
import { call } from '@/so/features/checkin/checkin';
import { locale, tr } from '@/lib/i18n';

export type Position = { driver: string; name: string; fleet: string | null; shift: 'open' | 'closed'; at: string; lat: number; lng: number; accuracy: number | null; speed: number | null; battery: number | null };
type Point = Omit<Position, 'driver' | 'name' | 'fleet' | 'shift'>;

const KWITANG: [number, number] = [-6.1806, 106.8434];
const minutes = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 60000);
/** green: seen in the last 5 min, amber: 15 min, grey: older or shift ended */
const fresh = (p: Position) => (p.shift !== 'open' ? 'slate' : minutes(p.at) <= 5 ? 'green' : minutes(p.at) <= 15 ? 'amber' : 'slate');
const COLOR = { green: '#059669', amber: '#d97706', slate: '#64748b' } as const;
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

export default function DriverMap({ day, live }: { day: string; live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const markers = useRef<Record<string, CircleMarker>>({});
  const [L, setL] = useState<typeof import('leaflet') | null>(null);
  const [rows, setRows] = useState<Position[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [route, setRoute] = useState<Point[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try { setRows(await call<Position[]>(`/api/cotr/locations?day=${day}`)); } catch (e) { setError((e as Error).message); }
  }, [day]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [live, load]);
  useEffect(() => {
    if (!picked) { setRoute([]); return; }
    call<Point[]>(`/api/cotr/locations/${encodeURIComponent(picked)}?day=${day}`).then(setRoute).catch(() => setRoute([]));
  }, [picked, day, rows]);

  // Leaflet reads window: loaded in the browser only
  useEffect(() => { void import('leaflet').then((m) => setL(m)); }, []);
  useEffect(() => {
    if (!L || !box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true }).setView(KWITANG, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [L]);

  // the markers and the route
  useEffect(() => {
    if (!L || !map.current || !layer.current || !rows) return;
    layer.current.clearLayers();
    markers.current = {};
    for (const p of rows) {
      const c = COLOR[fresh(p)];
      if (p.accuracy && p.accuracy < 300) L.circle([p.lat, p.lng], { radius: p.accuracy, color: c, weight: 0, fillOpacity: 0.08 }).addTo(layer.current);
      const m = L.circleMarker([p.lat, p.lng], { radius: picked === p.driver ? 10 : 7, color: '#fff', weight: 2, fillColor: c, fillOpacity: 1 })
        .bindTooltip(`${p.name} · ${p.fleet ?? ''} · ${time(p.at)}`, { direction: 'top', offset: [0, -6] })
        .on('click', () => setPicked(p.driver))
        .addTo(layer.current);
      markers.current[p.driver] = m;
    }
    if (route.length > 1) L.polyline(route.map((r) => [r.lat, r.lng] as [number, number]), { color: '#2563eb', weight: 3, opacity: 0.8 }).addTo(layer.current);
    const pts = rows.map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length && !picked) map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
  }, [L, rows, route, picked]);

  const focus = (p: Position) => {
    setPicked(p.driver === picked ? null : p.driver);
    map.current?.setView([p.lat, p.lng], 16);
  };

  return (
    <Panel title={tr('Driver location')} description={tr('Last position sent by the COTR app of every driver; pick a driver to see the route of the day')}
      actions={<Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw size={14} /> {tr('Refresh')}</Button>}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <div className="grid lg:grid-cols-[1fr_20rem]">
          <div ref={box} className="h-[480px] w-full bg-slate-100" />
          <div className="max-h-[480px] overflow-y-auto border-t border-slate-100 lg:border-l lg:border-t-0">
            {!rows ? <div className="skeleton m-4 h-24 rounded-xl" /> : rows.length === 0 ? (
              <Empty icon={<LocateFixed size={26} />} title={tr('No position yet')}>{tr('Positions arrive once a driver has checked in with the location allowed.')}</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...rows].sort((a, b) => b.at.localeCompare(a.at)).map((p) => {
                  const tone = fresh(p);
                  return (
                    <li key={p.driver}>
                      <button type="button" onClick={() => focus(p)} className={cx('w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50', picked === p.driver && 'bg-blue-50/70')}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-slate-900">{p.name}</span>
                          <Badge tone={tone} dot>{p.shift === 'open' ? tr('{0} min ago', minutes(p.at)) : tr('Shift ended')}</Badge>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                          <span>{p.fleet ?? p.driver} · {time(p.at)}</span>
                          {p.accuracy !== null && <span>± {Math.round(p.accuracy)} m</span>}
                          {p.speed !== null && p.speed > 0.5 && <span className="inline-flex items-center gap-0.5"><Navigation size={10} />{Math.round(p.speed * 3.6)} km/h</span>}
                          {p.battery !== null && <span className={cx('inline-flex items-center gap-0.5', p.battery <= 20 && 'text-red-600')}><Battery size={11} />{p.battery}%</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
