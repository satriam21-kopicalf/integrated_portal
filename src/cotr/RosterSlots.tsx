"use client";

// Monitoring COTR → Master → Schedule: the assignments of one driver in one day (migration 080) — 07:00–10:00 area A,
// 10:00–14:00 area B … Every slot starts from a shift template (its times are filled in and may be changed), an area and
// optionally another fleet; slots may not overlap. Saved at once with the day as "work".

import { ArrowDown, ArrowUp, Copy, MapPinned, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { type Area, type Fleet } from "@/cotr/types";
import { SearchSelect, TimeInput, useMaster } from "@/cotr/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

export type Slot = { template: string | null; start: string; end: string; area: string | null; areaName?: string | null; fleet: string | null; note: string | null };
type Template = { code: string; name: string; start_time: string; end_time: string; is_active: boolean };

const hm = (t: string) => t.slice(0, 5);

/** "2 slots · CFD Sudirman, Kantor Pos" — the assignments of a cell in a line. */
export function slotsText(slots: Slot[] | undefined): string {
  if (!slots?.length) return "";
  const areas = [...new Set(slots.map((s) => s.areaName ?? s.area).filter(Boolean))];
  return `${tr("{0} slots", slots.length)}${areas.length ? ` · ${areas.join(", ")}` : ""}`;
}

export function SlotsDrawer({ driver, driverName, day, dayLabel, slots: initial, templates, pool, onClose, onSaved }: {
  driver: string; driverName: string; day: string; dayLabel: string; slots: Slot[]; templates: Template[]; pool: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const areas = useMaster<Area>("areas");
  const fleet = useMaster<Fleet>("fleet");
  const active = templates.filter((t) => t.is_active);
  const [slots, setSlots] = useState<Slot[]>(() => initial.length ? initial.map((s) => ({ ...s })) : [blank(active[0])]);
  const [busy, setBusy] = useState(false);
  function blank(t?: Template, after?: Slot): Slot {
    if (t) return { template: t.code, start: hm(t.start_time), end: hm(t.end_time), area: null, fleet: null, note: null };
    return { template: null, start: after?.end ?? "07:00", end: after?.end ?? "10:00", area: null, fleet: null, note: null };
  }
  const set = (i: number, patch: Partial<Slot>) => setSlots((x) => x.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const problems = sorted.flatMap((s, i) => [
    ...(s.end <= s.start ? [tr("Slot {0}: the end must be after the start", i + 1)] : []),
    ...(i > 0 && s.start < sorted[i - 1].end ? [tr("Slot {0} overlaps the slot before", i + 1)] : []),
    ...(!s.area ? [tr("Slot {0}: choose the area", i + 1)] : []),
  ]);
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/cotr/schedule", { method: "PUT", json: { entries: [{ driver, day, status: "work", template: sorted[0]?.template ?? null, pool,
        slots: sorted.map(({ template, start, end, area, fleet: f, note }) => ({ template, start, end, area, fleet: f, note })) }] } });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MapPinned size={18} />} title={tr("Assignments of {0}", driverName)} description={dayLabel}
      footer={<div className="flex w-full items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">{problems[0] ?? tr("{0} slots · {1}–{2}", sorted.length, sorted[0]?.start ?? "", sorted[sorted.length - 1]?.end ?? "")}</p>
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!slots.length || problems.length > 0} onClick={() => void save()}><Save size={15} />{tr("Save")}</Button></div>}>
      <div className="space-y-3">
        <p className="text-xs text-neutral-500">{tr("Split the day into slots: each slot sends the driver to an area for a time. Pick a shift template to fill the times, then change them if needed.")}</p>
        <ol className="space-y-3">
          {slots.map((s, i) => (
            <li key={i} className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200">{i + 1}</span>
                <span className="text-sm font-semibold text-neutral-900">{tr("Slot {0}", i + 1)}</span>
                <span className="ml-auto flex gap-1">
                  <IconBtn label={tr("Up")} disabled={i === 0} onClick={() => setSlots((x) => { const y = [...x]; [y[i - 1], y[i]] = [y[i], y[i - 1]]; return y; })}><ArrowUp size={14} /></IconBtn>
                  <IconBtn label={tr("Down")} disabled={i === slots.length - 1} onClick={() => setSlots((x) => { const y = [...x]; [y[i + 1], y[i]] = [y[i], y[i + 1]]; return y; })}><ArrowDown size={14} /></IconBtn>
                  <IconBtn label={tr("Duplicate")} onClick={() => setSlots((x) => [...x.slice(0, i + 1), { ...s, start: s.end, end: s.end }, ...x.slice(i + 1)])}><Copy size={14} /></IconBtn>
                  <IconBtn label={tr("Delete")} danger onClick={() => setSlots((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></IconBtn>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <label className="text-[11px] font-medium text-neutral-500">{tr("Shift template")}
                  <select className={cx(inputClass, "mt-1 h-10")} value={s.template ?? ""} onChange={(e) => {
                    const t = active.find((x) => x.code === e.target.value);
                    set(i, t ? { template: t.code, start: hm(t.start_time), end: hm(t.end_time) } : { template: null });
                  }}>
                    <option value="">{tr("Custom time")}</option>
                    {active.map((t) => <option key={t.code} value={t.code}>{t.name} · {hm(t.start_time)}–{hm(t.end_time)}</option>)}
                  </select></label>
                <label className="text-[11px] font-medium text-neutral-500">{tr("Start")}
                  <TimeInput className="mt-1" value={s.start} onChange={(v) => set(i, { start: v })} /></label>
                <label className="text-[11px] font-medium text-neutral-500">{tr("End")}
                  <TimeInput className="mt-1" value={s.end} invalid={s.end <= s.start} onChange={(v) => set(i, { end: v })} /></label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="text-[11px] font-medium text-neutral-500">{tr("Area")}
                  <div className="mt-1"><SearchSelect value={s.area ?? ""} required onChange={(v) => set(i, { area: v || null, areaName: (areas.rows ?? []).find((a) => a.code === v)?.name ?? null })} placeholder={tr("Choose the area")}
                    options={(areas.rows ?? []).filter((a) => a.is_active).map((a) => ({ value: a.code, label: a.name, hint: [a.city, a.address].filter(Boolean).join(" · ") }))} /></div></div>
                <div className="text-[11px] font-medium text-neutral-500">{tr("Fleet (optional)")}
                  <div className="mt-1"><SearchSelect value={s.fleet ?? ""} onChange={(v) => set(i, { fleet: v || null })} placeholder={tr("The driver's own fleet")}
                    options={(fleet.rows ?? []).filter((f) => f.is_active).map((f) => ({ value: f.code, label: f.code, hint: f.name ?? undefined }))} /></div></div>
              </div>
              <input className={cx(inputClass, "mt-2 h-10")} value={s.note ?? ""} maxLength={300} onChange={(e) => set(i, { note: e.target.value || null })} placeholder={tr("Note (optional)")} />
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSlots((x) => [...x, blank(undefined, sorted[sorted.length - 1])])}><Plus size={15} />{tr("Add slot")}</Button>
          {active.map((t) => (
            <Button key={t.code} variant="ghost" size="sm" onClick={() => setSlots((x) => [...x, blank(t)])}>+ {t.name}</Button>
          ))}
        </div>
        {(areas.rows ?? []).length === 0 && areas.rows && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("No area yet: add the areas in Master → Area first.")}</p>}
      </div>
    </Drawer>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cx("rounded-md p-1.5 text-neutral-400 disabled:opacity-30", danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-neutral-100 hover:text-neutral-700")}>{children}</button>
  );
}
