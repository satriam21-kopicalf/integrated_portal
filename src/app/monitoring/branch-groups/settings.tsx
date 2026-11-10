"use client";

// The settings of the PIC assessment kept with the branch groups (2026-11-04, integrated_portal_be migration 069):
// the check-in deadline and time zone of every outlet, the Product / Outlet items each group is asked, and the net sales
// of every outlet against its own month before (no target set by hand). Read by Monitoring → Overview (the PIC score) and the forms.

import { Save, Store } from "lucide-react";
import Drawer from "@/so/ui/Drawer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ErrorState, Input, PageNav, Select, cx, fmtNumber, usePaged, useToast } from "@/so/ui";
import InfoTip from "@/components/ui/InfoTip";
import { Card, EmptyState, Pill, SearchInput, kcTable } from "@/components/kc";
import { SkeletonRows } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr, useLang } from "@/lib/i18n";

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
  const paged = usePaged(rows, q, 25);  // edits are kept per outlet, so paging never loses them
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
      footer={res && rows.length > 0 ? <><span>{tr("{0} outlets", rows.length)}</span><PageNav paged={paged} /></> : undefined}
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
              {paged.rows.map((o) => {
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
type Matrix = { groups: string[]; forms: { form: "product" | "outlet"; sections: { key: string; title: string; titleEn: string; group: string; groupTitle?: string;
  items: MatrixItem[] }[] }[] };
/** migration 085: branches = {outlet code: shown} of the outlets set apart from their group */
type MatrixItem = { key: string; no: number; label: string; labelEn: string; required: boolean; groups: Record<string, Cell>; branches?: Record<string, boolean> };

/** The outlets of one item (migration 085): each follows its group or is set apart — shown or hidden at that outlet only. */
function ItemOutlets({ form, item, canEdit, onClose, onSaved }: { form: "product" | "outlet"; item: MatrixItem; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { lang } = useLang();
  const [outlets, setOutlets] = useState<OutletSetting[] | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(Object.keys(item.branches ?? {}).length > 0);
  const [draft, setDraft] = useState<Record<string, boolean | null>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { void call<Settings>("/api/monitoring/outlet-settings").then((r) => setOutlets(r.data)).catch(() => setOutlets([])); }, []);
  const groupShown = (g: string | null) => (g ? item.groups[g]?.shown ?? true : true);
  const state = (code: string): boolean | null => (code in draft ? draft[code] : item.branches?.[code] ?? null);
  const s = q.trim().toLowerCase();
  const list = (outlets ?? []).filter((o) => (!s || `${o.name} ${o.code}`.toLowerCase().includes(s)) && (!only || state(o.code) !== null));
  const paged = usePaged(list, s + String(only), 50);
  const changes = Object.entries(draft).filter(([code, v]) => v !== (item.branches?.[code] ?? null));
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/monitoring/form-items/branches", { method: "PUT", json: { changes: changes.map(([branch, shown]) => ({ form, itemKey: item.key, branch, shown })) } });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const OPTS: { v: boolean | null; label: string }[] = [{ v: null, label: tr("Group") }, { v: true, label: tr("Show") }, { v: false, label: tr("Hide") }];
  return (
    <Drawer open onClose={onClose} icon={<Store size={18} />} title={`${item.no}. ${lang === "en" ? item.labelEn : item.label}`}
      description={tr("Per outlet: follow its group, or show / hide the item at that outlet only")}
      footer={canEdit ? <Button className="w-full" loading={busy} disabled={!changes.length} onClick={() => void save()}><Save size={15} />{tr("Save {0} changes", changes.length)}</Button> : undefined}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1"><SearchInput value={q} onChange={setQ} placeholder={tr("Search outlet")} /></div>
          <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />{tr("Set apart only")}</label>
        </div>
        {!outlets ? <table className="w-full"><tbody><SkeletonRows cols={2} rows={6} /></tbody></table> : !list.length ? (
          <EmptyState title={only ? tr("No outlet is set apart: every outlet follows its group") : tr("No outlet matches")} />
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {paged.rows.map((o) => {
              const v = state(o.code);
              const byGroup = groupShown(o.groupCode);
              const effective = v === null ? byGroup : v;
              return (
                <li key={o.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">{o.name}</span>
                    <span className="text-[11px] text-neutral-500">{o.code} · {o.groupCode ?? tr("Without a Group")} · {byGroup ? tr("group: asked") : tr("group: not asked")}
                      {" · "}<b className={effective ? "text-emerald-700" : "text-neutral-500"}>{effective ? tr("asked here") : tr("not asked here")}</b></span>
                  </span>
                  <span role="radiogroup" aria-label={o.name} className="flex rounded-lg bg-neutral-100 p-0.5">
                    {OPTS.map((x) => (
                      <button key={String(x.v)} type="button" role="radio" aria-checked={v === x.v} disabled={!canEdit}
                        onClick={() => setDraft((d) => ({ ...d, [o.code]: x.v }))}
                        className={cx("rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60", v === x.v
                          ? x.v === null ? "bg-white text-neutral-900 shadow-sm" : x.v ? "bg-emerald-600 text-white" : "bg-neutral-700 text-white"
                          : "text-neutral-500")}>{x.label}</button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end"><PageNav paged={paged} /></div>
      </div>
    </Drawer>
  );
}

export function FormItems({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const { lang } = useLang();
  const en = lang === "en";
  const [res, setRes] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"product" | "outlet">("product");
  const [q, setQ] = useState("");
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [outletsOf, setOutletsOf] = useState<MatrixItem | null>(null);
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
              <th className="w-32 px-3 py-2.5 text-center">{tr("Per Outlet")}</th>
            </tr></thead>
            {sections.map((sec) => {
              const items = sec.items.filter((it) => !s || `${it.label} ${it.labelEn}`.toLowerCase().includes(s));
              if (!items.length) return null;
              return (
                <tbody key={sec.key} className={kcTable.tbody}>
                  <tr><td colSpan={res.groups.length + 2} className="bg-neutral-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{en ? `${sec.group} · ${sec.titleEn}` : `${sec.groupTitle ?? sec.group} · ${sec.title}`}</td></tr>
                  {items.map((it) => (
                    <tr key={it.key} className="hover:bg-neutral-50">
                      <td className="px-4 py-2"><span className="text-neutral-900">{it.no}. {en ? it.labelEn : it.label}</span>{!it.required && <span className="ml-1.5 text-[11px] text-neutral-400">({tr("optional")})</span>}</td>
                      {res.groups.map((g) => {
                        const c = it.groups[g];
                        const v = shown(it.key, g, c);
                        const changed = v !== c.default;
                        return (
                          <td key={g} className="px-3 py-2 text-center">
                            <label className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-neutral-100">
                              <input type="checkbox" className="h-[18px] w-[18px] cursor-pointer rounded border-neutral-300 accent-brand-700" checked={v} disabled={!canEdit}
                                aria-label={`${en ? it.labelEn : it.label} · ${g}`}
                                onChange={() => setChanges((x) => { const n = { ...x }; const key = k(it.key, g); if (!v === c.shown) delete n[key]; else n[key] = !v; return n; })} />
                              {changed && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden title={tr("Changed from the standard")} />}
                            </label>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const ex = Object.values(it.branches ?? {});
                          const on = ex.filter(Boolean).length, off = ex.length - on;
                          return (
                            <button type="button" onClick={() => setOutletsOf(it)}
                              className={cx("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset",
                                ex.length ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100" : "text-neutral-500 ring-neutral-200 hover:bg-neutral-50")}>
                              <Store size={13} />{ex.length ? <>{on > 0 && `+${on}`}{on > 0 && off > 0 && " · "}{off > 0 && `−${off}`}</> : tr("Follow group")}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {outletsOf && <ItemOutlets form={form} item={outletsOf} canEdit={canEdit} onClose={() => setOutletsOf(null)}
        onSaved={() => { setOutletsOf(null); void load(); }} />}
    </Card>
  );
}

/* ---------------------------------------------------------------- net sales of the outlets */

type SalesOverview = { month: string; baselineFrom: string; baselineTo: string; baselineMonths: number; upTo: string | null;
  data: { code: string; name: string; groupCode: string | null; netSales: number; days: number; perDay: number | null; baselinePerDay: number | null;
    vsBaseline: number | null; score: number | null }[] };
const rupiah = (n: number) => `Rp ${fmtNumber(Math.round(n))}`;
const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const SALES_INFO = {
  title: "Net Sales of the Outlets",
  source: ["Sales Transactions (ESB POS, sales bills: Finished with a bill number), net sales after every discount."],
  definition: [
    "Selling days: the days of the month the outlet has net sales above 0. 0 selling days = no transaction of the outlet has come in from ESB this month (not open yet, closed, or recorded in ESB under another branch code).",
    "Average per Day: net sales this month ÷ its selling days.",
    "Average per Day (1 Month Before): the same outlet's net sales ÷ its selling days in the full month before.",
    "Against 1 Month Before: Average per Day ÷ Average per Day (1 Month Before). 100% = selling as usual; above 100% = more than usual (green); 85–99% a little less (amber); below 85% much less (red).",
  ],
  formula: ["PIC score, Net Sales part = Against 1 Month Before, at most 100, averaged over the outlets of the PIC. An outlet without sales in the month before is left out."],
};
const monthName = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

/** No target is set by hand: every outlet is compared with itself, its net sales per selling day (Sales Transactions)
 *  against its own per day of the month before. The PIC score takes the % (at most 100). */
export function SalesTargets() {
  const [month, setMonth] = useState(thisMonth);
  const [res, setRes] = useState<SalesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    setRes(null);
    try { setRes(await call<SalesOverview>(`/api/monitoring/sales-targets?month=${month}`)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((o) => !q || `${o.name} ${o.code} ${o.groupCode ?? ""}`.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const paged = usePaged(rows, `${q}|${month}`, 25);
  const tone = (v: number | null | undefined) => (v == null ? "text-neutral-400" : v >= 100 ? "text-emerald-600" : v >= 85 ? "text-amber-600" : "text-red-600");
  return (
    <Card flush title={<span className="inline-flex items-center gap-1.5">{tr("Net Sales of the Outlets")} <InfoTip info={SALES_INFO} /></span>}
      footer={res && rows.length > 0 ? <><span>{tr("{0} outlets", rows.length)}</span><PageNav paged={paged} /></> : undefined}
      subtitle={res?.baselineFrom ? tr("From Sales Transactions. Each outlet is compared with itself: its net sales per selling day this month against its own per day in {0}. The PIC score takes this %, at most 100; an outlet without sales before (new) is left out.",
        monthName(res.baselineFrom)) : undefined}
      actions={<Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-40" aria-label={tr("Month")} />}
      toolbar={<SearchInput value={q} onChange={setQ} placeholder={tr("Search outlet, code or group")} />}>
      {error ? <ErrorState message={error} onRetry={load} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={5} /></tbody></table> : rows.length === 0 ? (
        <EmptyState title={tr("No outlet matches")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[820px] text-sm">
            <thead className={kcTable.thead}><tr>
              <th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5 text-right">{tr("Net Sales This Month")}</th>
              <th className="px-4 py-2.5 text-right">{tr("Average per Day")}</th><th className="px-4 py-2.5 text-right">{tr("Average per Day (1 Month Before)")}</th>
              <th className="px-4 py-2.5 text-right">{tr("Against 1 Month Before")}</th>
            </tr></thead>
            <tbody className={kcTable.tbody}>
              {paged.rows.map((o) => (
                <tr key={o.code}>
                  <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{o.name}</span><span className="text-[11px] text-neutral-400">{o.code}{o.groupCode ? ` · ${o.groupCode}` : ""}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-800" data-label={tr("Net Sales This Month")}>{rupiah(o.netSales)}<span className="block text-[11px] text-neutral-400">{tr("{0} selling days", o.days ?? 0)}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums" data-label={tr("Average per Day")}>{o.perDay == null ? <span className="text-neutral-400">—</span> : rupiah(o.perDay)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600" data-label={tr("Average per Day (1 Month Before)")}>{o.baselinePerDay == null ? <Pill>{tr("No sales data yet")}</Pill> : rupiah(o.baselinePerDay)}</td>
                  <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", tone(o.vsBaseline))} data-label={tr("Against 1 Month Before")}>{o.vsBaseline == null ? "—" : `${o.vsBaseline}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
