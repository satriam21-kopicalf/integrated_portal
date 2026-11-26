"use client";

// Branch Groups → Travel Path (2026-11-25; integrated_portal_be app/travel_path.py settings): the sessions of the day and the
// branch groups that do them, the score and the repair deadline of every category. Its areas are in Form Items.
// 2026-11-26: four numbered cards with what each setting does, hours in 24 h, a save bar that shows while something changed.

import { TimeField } from "@/aggregator/fields";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Gauge, Plus, RotateCcw, Save, Settings2, Trash2, Wrench } from "lucide-react";
import { Button, ErrorState, Input, cx, useToast } from "@/so/ui";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { categoryLabel, categoryTone } from "./itemEditor";

type Session = { key: string; label: string; labelEn: string; from: string; to: string; active: boolean; groups: string[] };
type Settings = { since: string; dayEnds: string; reportMinutes: number; needSupervisor: boolean; sessions: Session[]; criticalCap: number; standard: number; pass: number;
  due: Record<string, number | null>; escalation: Record<string, string> };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

function Card({ n, icon, title, hint, aside, children }: { n: number; icon: ReactNode; title: string; hint: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-neutral-900"><span className="mr-1.5 text-neutral-400">{n}.</span>{title}</h3><p className="mt-0.5 text-xs text-neutral-500">{hint}</p></div>
        {aside}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
const Label = ({ t, hint }: { t: string; hint?: string }) => <span className="mb-1.5 block"><span className="block text-[13px] font-medium text-neutral-800">{t}</span>{hint && <span className="block text-xs text-neutral-500">{hint}</span>}</span>;
function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50", on ? "bg-brand-700" : "bg-neutral-300")}>
      <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow transition", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

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
  const lock = !canEdit && "pointer-events-none opacity-60";
  const num = (k: "reportMinutes" | "criticalCap" | "standard" | "pass", label: string, suffix: string, hint: string) => (
    <div><Label t={label} hint={hint} /><span className="flex items-center gap-2"><span className="block w-24"><Input type="number" inputMode="numeric" min={0} value={d[k]} disabled={!canEdit} onChange={(e) => set({ [k]: Number(e.target.value) })} className="text-right tabular-nums" /></span><span className="text-sm text-neutral-500">{suffix}</span></span></div>);
  const cats = [...new Set(["Kritikal", "Mayor", "Minor", ...Object.keys(d.due)])];
  const dirty = JSON.stringify(d) !== saved;
  const band = (from: number, to: number, cls: string, t: string) => <span className={cx("flex h-full items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[11px] font-semibold", cls)} style={{ width: `${Math.max(0, to - from)}%` }}>{to - from >= 10 ? t : ""}</span>;
  return (
    <div className="space-y-4 pb-20">
      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">{tr("The areas of the Travel Path, their category, and which group or outlet is asked are in the Form Items tab.")}</p>

      <Card n={1} icon={<CalendarClock />} title={tr("Sessions of the day")} hint={tr("When the outlets walk the Travel Path. Sent after the end of its session counts as late.")}
        aside={canEdit ? <Button size="sm" variant="secondary" onClick={add}><Plus size={14} /> {tr("Add a session")}</Button> : undefined}>
        <ul className="space-y-3">
          {d.sessions.map((s, i) => (
            <li key={s.key} className={cx("rounded-xl border p-3 sm:p-4", s.active ? "border-neutral-200" : "border-dashed border-neutral-200 bg-neutral-50")}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 basis-44"><Label t={tr("Session name")} /><Input value={s.label} disabled={!canEdit} maxLength={40} onChange={(e) => ses(i, { label: e.target.value, labelEn: e.target.value })} placeholder={tr("e.g. Opening")} aria-label={tr("Session name")} /></div>
                <div className={cx(lock || undefined)}><Label t={tr("Time (WIB, 24 h)")} />
                  <span className="flex items-center gap-1.5"><span className="block w-24"><TimeField label={tr("From")} value={s.from} onChange={(v) => ses(i, { from: v })} /></span><span className="text-neutral-400">–</span><span className="block w-24"><TimeField label={tr("To")} value={s.to} onChange={(v) => ses(i, { to: v })} /></span></span></div>
                <label className="flex h-10 items-center gap-2 text-sm text-neutral-700"><Switch on={s.active} disabled={!canEdit} onChange={(v) => ses(i, { active: v })} label={tr("Active")} />{s.active ? tr("Active") : tr("Inactive")}</label>
                {canEdit && !saved.includes(`"key":"${s.key}"`) && <button type="button" aria-label={tr("Remove")} onClick={() => set({ sessions: d.sessions.filter((_, n) => n !== i) })} className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
              </div>
              <div className="mt-3"><Label t={tr("Done by")} />
                <span className="flex flex-wrap gap-1.5" role="group" aria-label={tr("Branch Groups")}>
                  <button type="button" disabled={!canEdit} aria-pressed={!s.groups.length} onClick={() => ses(i, { groups: [] })} className={cx("h-9 rounded-full border px-3 text-xs font-semibold", !s.groups.length ? "border-brand-700 bg-brand-700 text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")}>{tr("Every outlet")}</button>
                  {groups.map((g) => { const on = s.groups.includes(g); return <button key={g} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => ses(i, { groups: on ? s.groups.filter((x) => x !== g) : [...s.groups, g] })} className={cx("h-9 rounded-full border px-3 text-xs font-semibold", on ? "border-brand-700 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")}>{g}</button>; })}
                </span></div>
            </li>))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">{tr("An outlet in Bali (WITA) uses the same hours on its own clock. A session in use is made inactive instead of removed, its reports stay.")}</p>
      </Card>

      <Card n={2} icon={<Gauge />} title={tr("Score")} hint={tr("Score = areas that meet ÷ areas rated (N/A left out).")}>
        <div className="mb-4 flex h-7 overflow-hidden rounded-lg ring-1 ring-neutral-200" aria-hidden>
          {band(0, d.pass, "bg-red-100 text-red-800", tr("Not passed"))}{band(d.pass, d.standard, "bg-amber-100 text-amber-800", tr("Needs repair"))}{band(d.standard, 100, "bg-emerald-100 text-emerald-800", tr("Standard"))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {num("pass", tr("Passed from"), "%", tr("Below it: not passed"))}
          {num("standard", tr("Standard from"), "%", tr("From it: meets the standard"))}
          {num("criticalCap", tr("Highest score with a critical finding"), "%", tr("One critical finding caps the score"))}
        </div>
      </Card>

      <Card n={3} icon={<Settings2 />} title={tr("Rules of sending")} hint={tr("What a report must have, and which days count.")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {num("reportMinutes", tr("Report after the last photo"), tr("minutes"), tr("Later counts as reported late"))}
          <div className={cx(lock || undefined)}><Label t={tr("The day ends at")} hint={tr("A closing after midnight belongs to the day before")} /><span className="flex items-center gap-1.5"><span className="block w-24"><TimeField label={tr("The day ends at")} value={d.dayEnds} onChange={(v) => set({ dayEnds: v })} /></span><span className="text-xs font-semibold text-neutral-500">WIB</span></span></div>
          <div><Label t={tr("Counted from")} hint={tr("Days before are not expected")} /><span className="block w-44"><Input type="date" value={d.since} disabled={!canEdit} onChange={(e) => e.target.value && set({ since: e.target.value })} /></span></div>
          <div><Label t={tr("Outlet Supervisor")} hint={tr("The name of the Outlet Supervisor is required")} /><Switch on={d.needSupervisor} disabled={!canEdit} onChange={(v) => set({ needSupervisor: v })} label={tr("The name of the Outlet Supervisor is required")} /></div>
        </div>
      </Card>

      <Card n={4} icon={<Wrench />} title={tr("Repair deadline of a finding")} hint={tr("By category: how long the outlet has to close a finding with its after photo, and who is mentioned in the message.")}>
        <ul className="space-y-3">
          {cats.map((c) => { const h = d.due[c] === undefined ? 24 : d.due[c]; return (
            <li key={c} className="rounded-xl border border-neutral-200 p-3">
              <span className={cx("inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", categoryTone(c))}>{categoryLabel(c)}</span>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <div><Label t={tr("Deadline")} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex overflow-hidden rounded-lg border border-neutral-200" role="group">
                      <button type="button" disabled={!canEdit} aria-pressed={h !== null} onClick={() => set({ due: { ...d.due, [c]: h ?? 24 } })} className={cx("h-10 px-3 text-xs font-semibold", h !== null ? "bg-brand-700 text-white" : "bg-white text-neutral-600")}>{tr("Hours")}</button>
                      <button type="button" disabled={!canEdit} aria-pressed={h === null} onClick={() => set({ due: { ...d.due, [c]: null } })} className={cx("h-10 px-3 text-xs font-semibold", h === null ? "bg-brand-700 text-white" : "bg-white text-neutral-600")}>{tr("Before the next Travel Path")}</button>
                    </span>
                    {h !== null && <span className="inline-flex items-center gap-2 text-sm text-neutral-600"><span className="block w-20"><Input type="number" inputMode="numeric" min={1} value={h} disabled={!canEdit} onChange={(e) => set({ due: { ...d.due, [c]: Number(e.target.value) } })} className="text-right tabular-nums" aria-label={tr("Hours")} /></span>{tr("hours")}</span>}
                  </div></div>
                <div><Label t={tr("Escalation")} hint={tr("Mentioned in the WhatsApp message")} /><Input value={d.escalation[c] ?? ""} disabled={!canEdit} maxLength={80} onChange={(e) => set({ escalation: { ...d.escalation, [c]: e.target.value } })} placeholder={tr("e.g. Area Supervisor")} aria-label={tr("Escalation")} /></div>
              </div>
            </li>); })}
        </ul>
      </Card>

      {canEdit && dirty && (
        <div className="fixed inset-x-3 bottom-24 z-30 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:shadow-none">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <span className="mr-auto text-sm font-medium text-neutral-700">{tr("Unsaved changes")}</span>
            <Button variant="secondary" onClick={() => setD(JSON.parse(saved))}><RotateCcw size={14} /> {tr("Undo")}</Button>
            <Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save changes")}</Button>
          </div>
        </div>)}
    </div>
  );
}
