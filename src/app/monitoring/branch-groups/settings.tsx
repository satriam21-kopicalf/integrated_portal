"use client";

// The settings of the PIC assessment kept with the branch groups (2026-11-04, integrated_portal_be migration 069):
// the check-in deadline and time zone of every outlet, the Product / Outlet items each group is asked, and the monthly
// net sales target of every outlet. Read by Monitoring → Overview (the PIC score) and the forms.

import { ClipboardPaste, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ErrorState, Input, Select, cx, fmtNumber, inputClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Card, EmptyState, Pill, SearchInput, kcTable } from "@/components/kc";
import { SkeletonRows } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

/* ---------------------------------------------------------------- check-in deadlines */

type OutletSetting = { code: string; name: string; groupCode: string | null; groupDeadline: string | null; deadline: string | null; timezone: string; zone: string };
type Settings = { data: OutletSetting[]; defaultDeadline: string; zones: { value: string; label: string }[] };

export function CheckInDeadlines({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [res, setRes] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Record<string, { deadline: string; timezone: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRes(await call<Settings>("/api/monitoring/outlet-settings")); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((o) => !q || `${o.name} ${o.code} ${o.groupCode ?? ""}`.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const valueOf = (o: OutletSetting) => draft[o.code] ?? { deadline: o.deadline ?? "", timezone: o.timezone };
  const dirty = (o: OutletSetting) => { const d = draft[o.code]; return !!d && (d.deadline !== (o.deadline ?? "") || d.timezone !== o.timezone); };
  const save = async (o: OutletSetting) => {
    const d = valueOf(o);
    setBusy(o.code);
    try {
      await call(`/api/monitoring/outlet-settings/${encodeURIComponent(o.code)}`, { method: "PUT", json: { deadline: d.deadline || null, timezone: d.timezone } });
      toast(tr("Saved"));
      setDraft((x) => { const n = { ...x }; delete n[o.code]; return n; });
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const zoneLabel = (tz: string) => res?.zones.find((z) => z.value === tz)?.label ?? "WIB";
  return (
    <Card flush title={tr("Check-In Deadlines")}
      subtitle={tr("The first check-in of the PIC's day is on time until the deadline of its outlet: its own, else its group's (default {0}). The deadline is in the outlet's own clock: an outlet in WITA is shown in WIB too.", res?.defaultDeadline ?? "11:00")}
      toolbar={<SearchInput value={q} onChange={setQ} placeholder={tr("Search outlet, code or group")} />}>
      {error ? <ErrorState message={error} onRetry={load} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={4} /></tbody></table> : rows.length === 0 ? (
        <EmptyState title={tr("No outlet matches")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[760px] text-sm">
            <thead className={kcTable.thead}><tr>
              <th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Group Deadline")}</th>
              <th className="px-4 py-2.5">{tr("Own Deadline")}</th><th className="px-4 py-2.5">{tr("Time Zone")}</th><th className="px-4 py-2.5">{tr("On Time Until")}</th>
              {canEdit && <th className="w-28 px-4 py-2.5" />}
            </tr></thead>
            <tbody className={kcTable.tbody}>
              {rows.map((o) => {
                const v = valueOf(o);
                const local = v.deadline || o.groupDeadline || res.defaultDeadline;
                const shift = v.timezone === "Asia/Makassar" ? -60 : v.timezone === "Asia/Jayapura" ? -120 : 0;
                const [h, m] = local.split(":").map(Number);
                const wibMin = h * 60 + m + shift;
                const wib = `${String(Math.floor(wibMin / 60)).padStart(2, "0")}:${String(wibMin % 60).padStart(2, "0")}`;
                return (
                  <tr key={o.code} className={cx(dirty(o) && "bg-brand-50/40")}>
                    <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{o.name}</span><span className="text-[11px] text-neutral-400">{o.code}{o.groupCode ? ` · ${o.groupCode}` : ""}</span></td>
                    <td className="px-4 py-2.5 tabular-nums text-neutral-600">{o.groupDeadline ?? <span className="text-neutral-400">{tr("Default {0}", res.defaultDeadline)}</span>}</td>
                    <td className="px-4 py-2.5">
                      {canEdit ? <Input type="time" value={v.deadline} onChange={(e) => setDraft((x) => ({ ...x, [o.code]: { ...v, deadline: e.target.value } }))} className="h-9 w-32" aria-label={tr("Own Deadline")} />
                        : <span className="tabular-nums">{o.deadline ?? "—"}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit ? (
                        <Select value={v.timezone} onChange={(e) => setDraft((x) => ({ ...x, [o.code]: { ...v, timezone: e.target.value } }))} className="h-9 w-28" aria-label={tr("Time Zone")}>
                          {res.zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                        </Select>
                      ) : zoneLabel(o.timezone)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums"><span className="font-semibold text-neutral-900">{local} {zoneLabel(v.timezone)}</span>{shift !== 0 && <span className="block text-[11px] text-neutral-500">= {wib} WIB</span>}</td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-right">
                        {dirty(o) && <Button size="sm" loading={busy === o.code} onClick={() => void save(o)}><Save size={14} /> {tr("Save")}</Button>}
                        {!dirty(o) && (o.deadline || o.timezone !== "Asia/Jakarta") && (
                          <button type="button" className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                            onClick={() => setDraft((x) => ({ ...x, [o.code]: { deadline: "", timezone: "Asia/Jakarta" } }))}>{tr("Back to Group")}</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- form items per group */

type Cell = { shown: boolean; default: boolean; changed: boolean };
type Matrix = { groups: string[]; forms: { form: "product" | "outlet"; sections: { key: string; title: string; titleEn: string; group: string;
  items: { key: string; no: number; label: string; labelEn: string; required: boolean; groups: Record<string, Cell> }[] }[] }[] };

export function FormItems({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [res, setRes] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"product" | "outlet">("product");
  const [q, setQ] = useState("");
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setRes(await call<Matrix>("/api/monitoring/form-items")); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sections = res?.forms.find((f) => f.form === form)?.sections ?? [];
  const k = (item: string, g: string) => `${form}|${item}|${g}`;
  const shown = (item: string, g: string, c: Cell) => changes[k(item, g)] ?? c.shown;
  const count = Object.keys(changes).length;
  const save = async () => {
    setBusy(true);
    try {
      const list = Object.entries(changes).map(([key, v]) => { const [f, itemKey, group] = key.split("|"); return { form: f, itemKey, group, shown: v }; });
      await call("/api/monitoring/form-items", { method: "PUT", json: { changes: list } });
      toast(tr("Saved"));
      setChanges({});
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const s = q.trim().toLowerCase();
  return (
    <Card flush title={tr("Form Items per Group")}
      subtitle={tr("Untick an item for a group and its outlets are not asked it: it is hidden in the form and left out of the score. A dot marks a change from the standard.")}
      actions={canEdit && count > 0 && <Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save {0} changes", count)}</Button>}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={tr("Form")} className="flex rounded-lg bg-neutral-100 p-1">
            {(["product", "outlet"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={form === f} onClick={() => setForm(f)}
                className={cx("rounded-md px-3 py-1 text-xs font-semibold", form === f ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500")}>
                {f === "product" ? "Form Product" : "Form Outlet"}
              </button>
            ))}
          </div>
          <SearchInput value={q} onChange={setQ} placeholder={tr("Search item")} />
        </div>
      }>
      {error ? <ErrorState message={error} onRetry={load} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={4} /></tbody></table> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className={cx(kcTable.thead, "sticky top-0 z-[1]")}><tr>
              <th className="px-4 py-2.5">{tr("Item")}</th>
              {res.groups.map((g) => <th key={g} className="w-24 px-3 py-2.5 text-center">{g}</th>)}
            </tr></thead>
            {sections.map((sec) => {
              const items = sec.items.filter((it) => !s || `${it.label} ${it.labelEn}`.toLowerCase().includes(s));
              if (!items.length) return null;
              return (
                <tbody key={sec.key} className={kcTable.tbody}>
                  <tr><td colSpan={res.groups.length + 1} className="bg-neutral-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{sec.group} · {sec.titleEn}</td></tr>
                  {items.map((it) => (
                    <tr key={it.key} className="hover:bg-neutral-50">
                      <td className="px-4 py-2"><span className="text-neutral-900">{it.no}. {it.labelEn}</span>{!it.required && <span className="ml-1.5 text-[11px] text-neutral-400">({tr("optional")})</span>}</td>
                      {res.groups.map((g) => {
                        const c = it.groups[g];
                        const v = shown(it.key, g, c);
                        const changed = v !== c.default;
                        return (
                          <td key={g} className="px-3 py-2 text-center">
                            <label className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-neutral-100">
                              <input type="checkbox" className="h-[18px] w-[18px] cursor-pointer rounded border-neutral-300 accent-brand-700" checked={v} disabled={!canEdit}
                                aria-label={`${it.labelEn} · ${g}`}
                                onChange={() => setChanges((x) => { const n = { ...x }; const key = k(it.key, g); if (!v === c.shown) delete n[key]; else n[key] = !v; return n; })} />
                              {changed && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden title={tr("Changed from the standard")} />}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- net sales targets */

type Targets = { month: string; days: number; elapsed: number; data: { code: string; name: string; groupCode: string | null; target: number | null; netSales: number;
  achievement: number | null; onPace: number | null }[] };
const rupiah = (n: number) => `Rp ${fmtNumber(Math.round(n))}`;
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);

export function SalesTargets({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth);
  const [res, setRes] = useState<Targets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const load = useCallback(async () => {
    setRes(null);
    try { setRes(await call<Targets>(`/api/monitoring/sales-targets?month=${month}`)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [month]);
  useEffect(() => { void load(); setDraft({}); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((o) => !q || `${o.name} ${o.code} ${o.groupCode ?? ""}`.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const count = Object.keys(draft).length;
  const withTarget = (res?.data ?? []).filter((o) => o.target).length;
  const save = async () => {
    setBusy(true);
    try {
      const list = Object.entries(draft).map(([code, v]) => ({ code, target: Number(v.replace(/\D/g, "")) || 0 }));
      await call("/api/monitoring/sales-targets", { method: "PUT", json: { month, rows: list } });
      toast(tr("Saved"));
      setDraft({});
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const tone = (v: number | null) => (v === null ? "text-neutral-400" : v >= 100 ? "text-emerald-600" : v >= 85 ? "text-amber-600" : "text-red-600");
  return (
    <Card flush title={tr("Net Sales Targets")}
      subtitle={res ? tr("{0} of {1} outlets have a target · {2} of {3} days of the month passed. The PIC score compares the net sales with the target prorated to the working days of the period.", withTarget, res.data.length, res.elapsed, res.days) : undefined}
      actions={<div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-40" aria-label={tr("Month")} />
        {canEdit && <Button variant="secondary" onClick={() => setPaste(true)}><ClipboardPaste size={15} /> {tr("Paste from Excel")}</Button>}
        {canEdit && count > 0 && <Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save {0} changes", count)}</Button>}
      </div>}
      toolbar={<SearchInput value={q} onChange={setQ} placeholder={tr("Search outlet, code or group")} />}>
      {error ? <ErrorState message={error} onRetry={load} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={5} /></tbody></table> : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[820px] text-sm">
            <thead className={kcTable.thead}><tr>
              <th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Target")}</th>
              <th className="px-4 py-2.5 text-right">{tr("Net Sales So Far")}</th><th className="px-4 py-2.5 text-right">{tr("Of the Target")}</th><th className="px-4 py-2.5 text-right">{tr("On Pace")}</th>
            </tr></thead>
            <tbody className={kcTable.tbody}>
              {rows.map((o) => {
                const v = draft[o.code] ?? (o.target ? fmtNumber(o.target) : "");
                return (
                  <tr key={o.code} className={cx(draft[o.code] !== undefined && "bg-brand-50/40")}>
                    <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{o.name}</span><span className="text-[11px] text-neutral-400">{o.code}{o.groupCode ? ` · ${o.groupCode}` : ""}</span></td>
                    <td className="px-4 py-2.5">
                      {canEdit ? (
                        <div className="relative w-44"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">Rp</span>
                          <input inputMode="numeric" value={v} placeholder="0" aria-label={tr("Target {0}", o.name)}
                            onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); setDraft((x) => ({ ...x, [o.code]: raw ? fmtNumber(Number(raw)) : "" })); }}
                            className={cx(inputClass, "h-9 pl-9 text-right tabular-nums")} /></div>
                      ) : o.target ? rupiah(o.target) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-neutral-800">{rupiah(o.netSales)}</td>
                    <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", tone(o.achievement))}>{o.achievement === null ? "—" : `${o.achievement}%`}</td>
                    <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", tone(o.onPace))}>{o.onPace === null ? "—" : `${o.onPace}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paste && res && <PasteTargets outlets={res.data} onClose={() => setPaste(false)}
        onApply={(got) => { setDraft((x) => ({ ...x, ...Object.fromEntries(Object.entries(got).map(([c, n]) => [c, fmtNumber(n)])) })); setPaste(false); }} />}
    </Card>
  );
}

/** Two columns copied from Excel (outlet code or name, target) become the targets of the month, checked before saving. */
function PasteTargets({ outlets, onClose, onApply }: { outlets: Targets["data"]; onClose: () => void; onApply: (got: Record<string, number>) => void }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => {
    const byCode = new Map(outlets.map((o) => [o.code.toLowerCase(), o.code]));
    const byName = new Map(outlets.map((o) => [o.name.toLowerCase(), o.code]));
    const ok: Record<string, number> = {};
    const bad: string[] = [];
    for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const cells = line.split(/\t|;/).map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) { bad.push(line); continue; }
      const who = cells[0].toLowerCase();
      const code = byCode.get(who) ?? byName.get(who) ?? byName.get(`kopi calf ${who}`);
      const n = Number(cells[cells.length - 1].replace(/[^\d]/g, ""));
      if (!code || !n) bad.push(line); else ok[code] = n;
    }
    return { ok, bad };
  }, [text, outlets]);
  const n = Object.keys(parsed.ok).length;
  return (
    <Drawer open onClose={onClose} size="md" icon={<ClipboardPaste size={18} />} title={tr("Paste from Excel")}
      description={tr("Copy two columns from Excel: the outlet code (or name) and the target")}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={!n} onClick={() => onApply(parsed.ok)}>{tr("Use {0} targets", n)}</Button></>}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder={"CTG54\t150000000\nCCI01\t320000000"}
        className={cx(inputClass, "h-auto py-2 font-mono text-xs")} aria-label={tr("Paste from Excel")} />
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Pill tone="green">{tr("{0} recognized", n)}</Pill>
        {parsed.bad.length > 0 && <Pill tone="amber">{tr("{0} lines not recognized", parsed.bad.length)}</Pill>}
      </div>
      {parsed.bad.length > 0 && <ul className="mt-2 space-y-0.5 text-[11px] text-amber-800">{parsed.bad.slice(0, 8).map((l, i) => <li key={i} className="truncate font-mono">{l}</li>)}</ul>}
      <p className="mt-3 text-xs text-neutral-500">{tr("Nothing is saved yet: the targets fill the table, then Save.")}</p>
    </Drawer>
  );
}
