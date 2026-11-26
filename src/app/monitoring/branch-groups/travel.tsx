"use client";

// Branch Groups → Travel Path (2026-11-25; integrated_portal_be app/travel_path.py settings): the sessions of the day and the
// branch groups that do them, the score and the repair deadline of every category. Its areas are in Form Items.

import { TimeField } from "@/aggregator/fields";
import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button, ErrorState, Field, Input, cx, useToast } from "@/so/ui";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { categoryLabel, categoryTone } from "./itemEditor";

type Session = { key: string; label: string; labelEn: string; from: string; to: string; active: boolean; groups: string[] };
type Settings = { since: string; dayEnds: string; reportMinutes: number; needSupervisor: boolean; sessions: Session[]; criticalCap: number; standard: number; pass: number;
  due: Record<string, number | null>; escalation: Record<string, string> };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

export function TravelSettings({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [d, setD] = useState<Settings | null>(null);
  const [saved, setSaved] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setErr(null);
    call<{ settings: Settings; groups: string[] }>("/api/monitoring/travel/settings").then((r) => { setD(r.settings); setSaved(JSON.stringify(r.settings)); setGroups(r.groups); }).catch((e: Error) => setErr(e.message));
  };
  useEffect(load, []);
  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!d) return <SkeletonList rows={6} />;
  const set = (p: Partial<Settings>) => setD({ ...d, ...p });
  const ses = (i: number, p: Partial<Session>) => set({ sessions: d.sessions.map((s, n) => (n === i ? { ...s, ...p } : s)) });
  const add = () => {
    let n = d.sessions.length + 1;
    while (d.sessions.some((s) => s.key === `sesi-${n}`)) n += 1;
    set({ sessions: [...d.sessions, { key: `sesi-${n}`, label: "", labelEn: "", from: "12:00", to: "14:00", active: true, groups: [] }] });
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await call<Settings>("/api/monitoring/travel/settings", { method: "PUT", json: { ...d, sessions: d.sessions.map((s) => ({ ...s, key: s.key || slug(s.label), labelEn: s.labelEn || s.label })) } });
      setD(r); setSaved(JSON.stringify(r)); toast(tr("Saved"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const num = (k: "reportMinutes" | "criticalCap" | "standard" | "pass", label: string, suffix: string, hint?: string) => (
    <Field label={label} hint={hint}><span className="flex items-center gap-2"><span className="block w-24"><Input type="number" min={0} value={d[k]} disabled={!canEdit} onChange={(e) => set({ [k]: Number(e.target.value) })} className="text-right tabular-nums" /></span><span className="text-sm text-neutral-500">{suffix}</span></span></Field>);
  const cats = [...new Set(["Kritikal", "Mayor", "Minor", ...Object.keys(d.due)])];
  const dirty = JSON.stringify(d) !== saved;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-neutral-600">{tr("The areas of the Travel Path, their category, and which group or outlet is asked are in the Form Items tab.")}</p>
        {canEdit && <Button loading={busy} disabled={!dirty} onClick={() => void save()}><Save size={15} /> {tr("Save changes")}</Button>}
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-neutral-900">{tr("Sessions of the day")}</h3>{canEdit && <Button size="sm" variant="secondary" onClick={add}><Plus size={14} /> {tr("Add a session")}</Button>}</div>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {d.sessions.map((s, i) => (
            <li key={s.key} className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3", !s.active && "bg-neutral-50")}>
              <span className="block w-44"><Input value={s.label} disabled={!canEdit} maxLength={40} onChange={(e) => ses(i, { label: e.target.value, labelEn: e.target.value })} placeholder={tr("Session name")} aria-label={tr("Session name")} /></span>
              <span className={cx("inline-flex items-center gap-1.5", !canEdit && "pointer-events-none opacity-60")}><span className="block w-24"><TimeField label={tr("From")} value={s.from} onChange={(v) => ses(i, { from: v })} /></span>–<span className="block w-24"><TimeField label={tr("To")} value={s.to} onChange={(v) => ses(i, { to: v })} /></span><span className="text-xs font-semibold text-neutral-500">WIB</span></span>
              <span className="flex flex-wrap items-center gap-1" role="group" aria-label={tr("Branch Groups")}>
                <button type="button" disabled={!canEdit} aria-pressed={!s.groups.length} onClick={() => ses(i, { groups: [] })} className={cx("rounded border px-2 py-1 text-xs font-medium", !s.groups.length ? "border-brand-700 bg-brand-700 text-white" : "border-neutral-200 text-neutral-600")}>{tr("Every outlet")}</button>
                {groups.map((g) => { const on = s.groups.includes(g); return <button key={g} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => ses(i, { groups: on ? s.groups.filter((x) => x !== g) : [...s.groups, g] })} className={cx("rounded border px-2 py-1 text-xs font-medium", on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600")}>{g}</button>; })}
              </span>
              <label className="ml-auto inline-flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={s.active} disabled={!canEdit} onChange={(e) => ses(i, { active: e.target.checked })} /> {tr("Active")}</label>
              {canEdit && !saved.includes(`"key":"${s.key}"`) && <button type="button" aria-label={tr("Remove")} onClick={() => set({ sessions: d.sessions.filter((_, n) => n !== i) })} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button>}
            </li>))}
        </ul>
        <p className="mt-1.5 text-xs text-neutral-500">{tr("The time is the outlet's own clock. A session sent after its time counts as late. A session in use is made inactive instead of removed, its reports stay.")}</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {num("criticalCap", tr("Highest score with a critical finding"), "%")}
        {num("standard", tr("Standard from"), "%")}
        {num("pass", tr("Passed from"), "%")}
        {num("reportMinutes", tr("Report after the last photo"), tr("minutes"))}
        <Field label={tr("The day ends at")} hint={tr("A closing after midnight belongs to the day before")}><span className={cx("inline-flex items-center gap-1.5", !canEdit && "pointer-events-none opacity-60")}><span className="block w-24"><TimeField label={tr("The day ends at")} value={d.dayEnds} onChange={(v) => set({ dayEnds: v })} /></span><span className="text-xs font-semibold text-neutral-500">WIB</span></span></Field>
        <Field label={tr("Counted from")} hint={tr("Days before are not expected")}><span className="block w-40"><Input type="date" value={d.since} disabled={!canEdit} onChange={(e) => e.target.value && set({ since: e.target.value })} /></span></Field>
        <label className="flex items-center gap-2 text-sm text-neutral-800 sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={d.needSupervisor} disabled={!canEdit} onChange={(e) => set({ needSupervisor: e.target.checked })} /> {tr("The name of the Outlet Supervisor is required")}</label>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">{tr("Repair deadline of a finding")}</h3>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {cats.map((c) => { const h = d.due[c] === undefined ? 24 : d.due[c]; return (
            <li key={c} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
              <span className={cx("w-20 rounded px-1.5 py-px text-center text-[10px] font-bold uppercase tracking-wide", categoryTone(c))}>{categoryLabel(c)}</span>
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={h === null} disabled={!canEdit} onChange={(e) => set({ due: { ...d.due, [c]: e.target.checked ? null : 24 } })} /> {tr("Before the next Travel Path")}</label>
              {h !== null && <span className="inline-flex items-center gap-2 text-sm text-neutral-600"><span className="block w-20"><Input type="number" min={1} value={h} disabled={!canEdit} onChange={(e) => set({ due: { ...d.due, [c]: Number(e.target.value) } })} className="text-right" aria-label={tr("Hours")} /></span> {tr("hours")}</span>}
              <span className="ml-auto inline-flex items-center gap-2 text-sm text-neutral-600">{tr("Escalation")} <span className="block w-48"><Input value={d.escalation[c] ?? ""} disabled={!canEdit} maxLength={80} onChange={(e) => set({ escalation: { ...d.escalation, [c]: e.target.value } })} aria-label={tr("Escalation")} /></span></span>
            </li>); })}
        </ul>
      </section>
    </div>
  );
}
