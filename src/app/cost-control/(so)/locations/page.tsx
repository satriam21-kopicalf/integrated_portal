"use client";

// Outlet locations (Cost Control, 06.9 §12.15): the coordinates and check-in radius of every outlet and hub, used to
// check where a stock opname starts. Coordinates are pasted from Google Maps ("-6.26, 106.81" or a maps link), taken
// from the start position of the facility's latest stock opname after checking it on the map, or from the device of a
// Cost Control member on site. Every change is audited (kopicalf inventory.count.location).

import { Crosshair, ExternalLink, MapPin, MapPinOff, Pencil, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Page, Panel, SkeletonRows, fmtDate, fmtNumber, theadClass, useToast } from "@/so/ui";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { locate, mapsUrl } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type LastStart = { number: string; started_at: string; start_lat: number; start_lng: number; start_accuracy_m: number | string | null;
  start_distance_m: number | null; started_by_name: string | null };
type Row = { id: string; code: string; name: string; facility_type: string; latitude: number | string | null; longitude: number | string | null;
  radius_m: number; last_start: LastStart | null };
type F = { state: string; type: string };

const STANDARD_RADIUS = 100;
const located = (r: Row) => r.latitude !== null && r.longitude !== null;

/** Great-circle distance in metres (same formula as the server). */
function distance(a: [number, number], b: [number, number]): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** "-6.2607, 106.8137", a Google Maps link (…/@-6.26,106.81,17z or ?q=-6.26,106.81) → [lat, lng]. */
function parseCoordinates(v: string): [number, number] | null {
  const s = v.trim();
  const m = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ?? s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    ?? s.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

export default function LocationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [f, setF] = useState<F>({ state: "", type: "" });
  const [sheet, setSheet] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<Row[]>("/api/so/count-settings/locations"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => (rows ?? []).filter((r) => r.facility_type !== "VIRTUAL"), [rows]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!f.state || (f.state === "set") === located(r)) && (!f.type || r.facility_type === f.type)
      && (!s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s)))
      .sort((a, b) => Number(located(a)) - Number(located(b)) || a.name.localeCompare(b.name));
  }, [all, search, f]);
  const withCoords = all.filter(located).length;
  const pct = all.length ? Math.round((withCoords / all.length) * 100) : 0;
  const fromSo = all.filter((r) => !located(r) && r.last_start).length;
  const types = Array.from(new Set(all.map((r) => r.facility_type))).sort();

  const chips: ActiveFilter[] = [
    ...(f.state ? [{ key: "s", label: f.state === "set" ? tr("With coordinates") : tr("Without coordinates"), onRemove: () => setF({ ...f, state: "" }) }] : []),
    ...(f.type ? [{ key: "t", label: f.type, onRemove: () => setF({ ...f, type: "" }) }] : []),
  ];

  return (
    <Page title={tr("Outlet locations")} subtitle={tr("Coordinates and check-in radius of every outlet and hub, to check where each stock opname starts")}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Facilities")} icon={<MapPin size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("outlets and hubs that count stock")}</p>}
          </Stat>
          <Stat label={tr("With coordinates")} emphasis value={rows ? `${pct}%` : <StatSkeleton />}>
            {rows && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <p>{tr("{0} of {1}", fmtNumber(withCoords), fmtNumber(all.length))}</p>
              </>
            )}
          </Stat>
          <Stat label={tr("Without coordinates")} icon={<MapPinOff size={13} />} value={rows ? fmtNumber(all.length - withCoords) : <StatSkeleton />}>
            {rows && <p>{tr("{0} can use the position of their latest stock opname", fmtNumber(fromSo))}</p>}
          </Stat>
          <Stat label={tr("Standard radius")} value={`${STANDARD_RADIUS} m`}>
            <p>{tr("GPS accuracy counts for the counter, at most 100 m")}</p>
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or hub")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF({ state: "", type: "" })} />}
        footer={rows ? <span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))} · {tr("Every change is recorded in the audit log")}</span> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className="px-4 py-2.5">{tr("Facility")}</th>
                  <th className="px-4 py-2.5">{tr("Coordinates")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Radius")}</th>
                  <th className="px-4 py-2.5">{tr("Latest stock opname start")}</th>
                  <th className="w-24 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows === null ? <SkeletonRows cols={5} /> : shown.map((r) => {
                  const ls = r.last_start;
                  const off = ls && located(r) ? distance([Number(r.latitude), Number(r.longitude)], [ls.start_lat, ls.start_lng]) : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="max-w-[18rem] px-4 py-3">
                        <span className="block truncate font-medium text-slate-900">{r.name}</span>
                        <span className="block text-xs text-slate-400">{r.code} · {r.facility_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        {located(r) ? (
                          <a href={mapsUrl(r.latitude!, r.longitude!)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-blue-700 hover:underline">
                            {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)} <ExternalLink size={11} />
                          </a>
                        ) : <Badge tone="amber" icon={<MapPinOff size={11} />}>{tr("Not set")}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.radius_m} m</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {ls ? (
                          <>
                            <a href={mapsUrl(ls.start_lat, ls.start_lng)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                              {fmtDate(ls.started_at)}
                            </a>
                            {ls.start_accuracy_m != null && <> · ±{Math.round(Number(ls.start_accuracy_m))} m</>}
                            {off !== null && <span className={off > r.radius_m ? " font-semibold text-amber-700" : ""}> · {tr("{0} m from the coordinates", off)}</span>}
                            {ls.started_by_name && <span className="block text-slate-400">{ls.started_by_name} · {ls.number}</span>}
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setEdit(r)}><Pencil size={13} /> {tr("Set")}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {sheet && <LocationFilters value={f} types={types} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {edit && <LocationDrawer row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </Page>
  );
}

function LocationFilters({ value, types, onApply, onClose }: { value: F; types: string[]; onApply: (v: F) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD({ state: "", type: "" })}>
      <FilterSection title={tr("Coordinates")}>
        <ChoiceGroup label="" value={d.state} onChange={(v) => setD({ ...d, state: v })}
          choices={[{ value: "", label: tr("All") }, { value: "unset", label: tr("Without coordinates") }, { value: "set", label: tr("With coordinates") }]} />
      </FilterSection>
      <FilterSection title={tr("Facility type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All") }, ...types.map((t) => ({ value: t, label: t }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

function LocationDrawer({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(located(row) ? `${row.latitude}, ${row.longitude}` : "");
  const [radius, setRadius] = useState(String(row.radius_m || STANDARD_RADIUS));
  const [busy, setBusy] = useState(false);
  const [here, setHere] = useState<"idle" | "busy">("idle");
  const coords = text.trim() ? parseCoordinates(text) : null;
  const invalid = text.trim() !== "" && !coords;
  const r = Number(radius);
  const radiusOk = Number.isInteger(r) && r >= 10 && r <= 5000;
  const ls = row.last_start;
  const off = ls && coords ? distance(coords, [ls.start_lat, ls.start_lng]) : null;

  const save = async (clear = false) => {
    setBusy(true);
    try {
      await api(`/api/so/count-settings/locations/${row.id}`, { method: "PUT",
        json: { latitude: clear ? null : coords?.[0] ?? null, longitude: clear ? null : coords?.[1] ?? null, radius_m: r } });
      toast(tr("Location saved"));
      onSaved();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const takeHere = async () => {
    setHere("busy");
    const res = await locate();
    setHere("idle");
    if (!res.fix) { toast(tr("Location is not available"), "error"); return; }
    setText(`${res.fix.lat}, ${res.fix.lng}`);
    toast(tr("Position of this device (±{0} m)", Math.round(res.fix.accuracy)));
  };

  return (
    <Drawer open onClose={onClose} size="md" icon={<MapPin size={18} />} title={row.name} description={`${row.code} · ${row.facility_type}`}
      footer={<>
        {located(row) && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={() => void save(true)}><Trash2 size={15} /> {tr("Remove coordinates")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={invalid || !radiusOk || (!coords && !located(row))} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button>
      </>}>
      <DrawerSection title={tr("Coordinates")} description={tr("Paste them from Google Maps: right-click the outlet → copy the numbers, or paste the map link.")}>
        <Field label={tr("Latitude, longitude")} error={invalid ? tr("Not a coordinate, e.g. -6.26071, 106.81372") : undefined}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="-6.26071, 106.81372" inputMode="text" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {ls && (
            <Button variant="secondary" size="sm" onClick={() => setText(`${ls.start_lat}, ${ls.start_lng}`)}>
              <MapPin size={13} /> {tr("Use the latest stock opname start")}
            </Button>
          )}
          <Button variant="secondary" size="sm" loading={here === "busy"} onClick={() => void takeHere()}><Crosshair size={13} /> {tr("Use my position (on site)")}</Button>
          {coords && (
            <a href={mapsUrl(coords[0], coords[1])} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-center text-xs font-medium text-blue-700 hover:underline">
              {tr("Check on Google Maps")} <ExternalLink size={12} />
            </a>
          )}
        </div>
        {ls && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {tr("Latest stock opname {0} started on {1}", ls.number, fmtDate(ls.started_at))}
            {ls.start_accuracy_m != null && ` · ±${Math.round(Number(ls.start_accuracy_m))} m`}
            {ls.started_by_name && ` · ${ls.started_by_name}`}
            {off !== null && <span className={off > r ? "block font-semibold text-amber-700" : "block"}>{tr("{0} m from these coordinates", off)}</span>}
            <span className="block text-slate-400">{tr("Check the point on the map before using it: it is where the phone was, not necessarily the outlet.")}</span>
          </p>
        )}
      </DrawerSection>
      <DrawerSection title={tr("Check-in radius")} description={tr("A stock opname started farther than this (minus the GPS accuracy, at most 100 m) is marked outside the radius.")}>
        <Field label={tr("Radius (m)")} error={!radiusOk ? tr("Between 10 and 5000 m") : undefined}>
          <Input value={radius} onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[50, 100, 150, 250].map((v) => (
            <button key={v} type="button" onClick={() => setRadius(String(v))}
              className={`h-8 rounded-lg border px-3 text-xs font-medium ${r === v ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {v} m{v === STANDARD_RADIUS ? ` · ${tr("standard")}` : ""}
            </button>
          ))}
        </div>
      </DrawerSection>
    </Drawer>
  );
}
