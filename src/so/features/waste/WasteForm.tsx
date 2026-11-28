"use client";

// Waste input (page "waste", integrated_portal_be app/waste.py): the outlet / HUB / PIC enters each wasted item of the
// branch and the day (today, or yesterday when late). Every item: Waste, Usage Management or Premix (the premix / WIP
// recipes of the premix calculator, in grams), the quantity in its unit, a waste category, a note / reason and a camera
// photo as evidence (stamped with the time, the branch and the item). An item is saved at once and listed under the
// form; its author may delete it while Cost Control has not reviewed it.
// The list follows the Waste sheet of docs/Daily SO & Waste.xlsx: No / Product name / Product code / Unit / Qty; a
// filled SKU opens its category, note, production and expired date and photo. Premix is listed and calculated as the
// WIP of the stock opname: the recipes of the branch's location, entered in their count unit (grams, portions, pieces,
// another unit can be picked), the grams of every ingredient follow from the recipe (migration 044).
// Usage Management (migration 045): every SKU filled needs its category and a photo, the reason is optional; each changed
// SKU is saved on its own request (a saved photo is kept when the SKU is saved again without a new one).
// Every day (migration 041): the branch reports its waste, the items or "no waste today", and fills the Usage
// Management list, the quantity of every usage item (saved again to correct it). Usage is not a single waste entry.

import { NativeSelect } from "@/so/ui/Jira";
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, FlaskConical, PenLine, Plus, Save, Search, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast, searchClass } from "@/so/ui";
import Dialog, { ConfirmDialog } from "@/so/ui/Dialog";
import SignaturePad from "@/so/features/count/SignaturePad";
import { FormCard, Segmented } from "@/so/ui/Simple";
import LiveClock from "@/so/ui/LiveClock";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import { TZ, wibDateTime } from "@/so/lib/wib";
import { type Entry, type FormData, type Scope, type WasteItem, ENTRY_SCOPES, explodePremix, usagePhotoUrl, fmtQty, fmtGrams, photoUrl, scopeLabel, statusLabel, statusTone, unitText } from "./waste";
import { SkeletonList } from "@/components/kc/Skeleton";
import { thumb } from "@/lib/assets";

/** uom: the unit a premix is entered in ("" = its count unit) */
/** more: other categories of the same SKU with their own quantity (2026-11-11: e.g. 2 expired + 1 spilled); each one is
 *  saved as its own entry with the photo, note and dates of the SKU */
type Split = { qty: string; category: string };
type Row = { qty: string; uom: string; category: string; note: string; made: string; expires: string; photo: Shot | null; more: Split[] };
const EMPTY: Row = { qty: "", uom: "", category: "", note: "", made: "", expires: "", photo: null, more: [] };
/** a Usage Management SKU of the form: hasPhoto = a photo is saved already */
type ULine = { qty: string; category: string; note: string; photo: Shot | null; hasPhoto: boolean };
const UEMPTY: ULine = { qty: "", category: "", note: "", photo: null, hasPhoto: false };
const uFilled = (l: ULine) => l.qty.trim() !== "";
const uLacks = (l: ULine) => [!l.category && tr("the category"), !l.photo && !l.hasPhoto && tr("the photo")].filter(Boolean) as string[];
const uomOf = (i: WasteItem, r: Row) => r.uom || i.unit;
const qtyOf = (r: Row) => Number(r.qty.replace(",", "."));
const isFilled = (r: Row) => qtyOf(r) > 0;
/** the quantity of each category of the SKU (the first one and the ones added) */
const splitsOf = (r: Row): Split[] => [{ qty: r.qty, category: r.category }, ...(r.more ?? [])];
const totalOf = (r: Row) => splitsOf(r).reduce((a, s) => a + (Number(s.qty.replace(",", ".")) || 0), 0);
const lacks = (r: Row) => {
  const more = r.more ?? [];
  const cats = splitsOf(r).map((s) => s.category).filter(Boolean);
  return [!r.category && tr("the category"), r.note.trim().length < 3 && tr("the note / reason"), more.some((s) => !s.category || !(Number(s.qty.replace(",", ".")) > 0)) && tr("the quantity and category of every added category"),
    new Set(cats).size < cats.length && tr("different categories"), !r.photo && tr("the photo"),
    r.made && r.expires && r.expires < r.made && tr("an expired date after the production date")].filter(Boolean) as string[];
};

export default function WasteForm() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [day, setDay] = useState("");
  const [scope, setScope] = useState<Scope>("waste");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [search, setSearch] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [shooting, setShooting] = useState<(WasteItem & { usage?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [remove, setRemove] = useState<Entry | null>(null);
  const [removing, setRemoving] = useState(false);
  const [usage, setUsage] = useState<Record<string, ULine>>({});
  const [usageChanged, setUsageChanged] = useState<Set<string>>(new Set());
  const [usageSaving, setUsageSaving] = useState(false);
  // the signature asked before submitting (migration 055): the waste SKUs or the Usage Management list
  const [signing, setSigning] = useState<"waste" | "usage" | null>(null);
  const [usageSearch, setUsageSearch] = useState("");
  const [oddAsk, setOddAsk] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const load = useCallback(async (b: string, d: string) => {
    setError(null);
    const get = (branchCode: string, dayIso: string) => {
      const q = new URLSearchParams();
      if (branchCode) q.set("branch", branchCode);
      if (dayIso) q.set("date", dayIso);
      return call<FormData>(`/api/waste/entries?${q}`);
    };
    try {
      let out = await get(b, d);
      const dayIso = d || out.days.to;
      if (!b && out.branches.length === 1) {  // one branch: chosen at once
        b = out.branches[0].code;
        setBranch(b);
        out = await get(b, dayIso);
      }
      setDay(dayIso);
      setData(out);
      setUsage(Object.fromEntries(Object.entries(out.usageDetail ?? {}).map(([k, v]) => [k,
        { qty: String(v.qty), category: v.category ?? "", note: v.note ?? "", photo: null, hasPhoto: v.hasPhoto }])));
      setUsageChanged(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load("", ""); }, [load]);

  const b = data?.branches.find((x) => x.code === branch);
  const items = useMemo(() => {
    const all = data?.items[scope] ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((i) => (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
      && (!onlyFilled || isFilled(rows[i.code] ?? EMPTY)));
  }, [data, scope, search, onlyFilled, rows]);
  // every filled SKU of both types (Waste and Premix) is saved together
  const filled = useMemo(() => ENTRY_SCOPES.flatMap((s) => (data?.items[s] ?? [])
    .filter((i) => isFilled(rows[i.code] ?? EMPTY)).map((i) => ({ scope: s, item: i, row: rows[i.code] }))), [data, rows]);
  const incomplete = filled.filter((f) => lacks(f.row).length).length;
  // premix: grams per ingredient of everything filled (as "filled into the items" of the stock opname WIP)
  const premixTotals = useMemo(() => {
    const out = new Map<string, { name: string; grams: number; stock: boolean }>();
    for (const f of filled) {
      if (f.scope !== "premix") continue;
      for (const c of explodePremix(f.item, uomOf(f.item, f.row), qtyOf(f.row)).ingredients) {
        const k = c.code ?? `n:${c.name}`;
        const cur = out.get(k) ?? { name: c.name, grams: 0, stock: c.isStock };
        cur.grams += c.grams;
        out.set(k, cur);
      }
    }
    return [...out.values()].sort((a, b) => Number(b.stock) - Number(a.stock) || a.name.localeCompare(b.name));
  }, [filled]);
  const setRow = (code: string, patch: Partial<Row>) => setRows((all) => ({ ...all, [code]: { ...(all[code] ?? EMPTY), ...patch } }));

  const pickBranch = (code: string) => { setBranch(code); setRows({}); void load(code, day); };
  const pickDay = (d: string) => { setDay(d); void load(branch, d); };
  const pickScope = (s: Scope) => { setScope(s); setSearch(""); };

  const save = async (signature: string) => {
    if (!b || !filled.length || incomplete) return;
    setSaving(true);
    let ok = 0;
    const failed: string[] = [];
    for (const { scope: s, item, row } of filled) {
      // one entry per category of the SKU; the ones saved leave the row, a failed one stays to send again
      const left: Split[] = [];
      for (const split of splitsOf(row)) {
        try {
          await call<Entry>("/api/waste/entries", { method: "POST", json: {
            branchCode: b.code, businessDate: day, scope: s, itemCode: item.code, qty: Number(split.qty.replace(",", ".")), category: split.category,
            uom: s === "premix" ? uomOf(item, row) : undefined,
            note: row.note.trim() || null, productionDate: row.made || null, expiredDate: row.expires || null,
            photo: row.photo!.image, takenAt: row.photo!.taken_at, latitude: row.photo!.lat, longitude: row.photo!.lng, signature } });
          ok += 1;
        } catch (e) {
          left.push(split);
          failed.push(`${item.name} (${split.category}): ${(e as Error).message}`);
        }
      }
      setRows((all) => {  // saved: the row is cleared (or keeps the categories that failed)
        const n = { ...all };
        if (left.length) n[item.code] = { ...row, qty: left[0].qty, category: left[0].category, more: left.slice(1) };
        else delete n[item.code];
        return n;
      });
    }
    if (ok) toast(tr("{0} SKUs saved", ok));
    if (failed.length) toast(failed.join(" · "), "error");
    setSaving(false);
    await load(branch, day);
  };

  const usageItems = useMemo(() => {
    const all = data?.items.usage ?? [];
    const q = usageSearch.trim().toLowerCase();
    return q ? all.filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) : all;
  }, [data, usageSearch]);
  const usageFilled = (data?.items.usage ?? []).filter((i) => uFilled(usage[i.code] ?? UEMPTY)).length;
  // a quantity far above the usual one of the item (app/usage_fix.py limits, 2026-11-25): shown in the row, asked before saving
  const usageOdd = (code: string) => {
    const u = data?.usageUsual?.[code];
    const q = Number((usage[code]?.qty ?? "").replace(",", "."));
    if (!u || !(q >= u.limit)) return null;
    const packs = u.packSize ? Math.round((q / u.packSize) * 1000) / 1000 : null;
    return { qty: q, usual: u.usual, suggested: packs && packs < u.limit ? packs : null };
  };
  // an unusual quantity needs its reason (2026-11-25), so Cost Control knows it is meant
  const uLacksOf = (code: string) => { const l = usage[code] ?? UEMPTY; return [...uLacks(l), ...(usageChanged.has(code) && usageOdd(code) && l.note.trim().length < 3 ? [tr("the reason of the unusual quantity")] : [])]; };
  const usageIncomplete = [...usageChanged].filter((c) => uFilled(usage[c] ?? UEMPTY) && uLacksOf(c).length).length;
  const setULine = (code: string, patch: Partial<ULine>) => {
    setUsage((all) => ({ ...all, [code]: { ...(all[code] ?? UEMPTY), ...patch } }));
    setUsageChanged((s) => new Set(s).add(code));
  };

  // every changed SKU on its own request (photos are large)
  const usageOdds = [...usageChanged].flatMap((c) => { const o = usageOdd(c); const i = data?.items.usage.find((x) => x.code === c); return o && i ? [{ ...o, item: i }] : []; });
  const saveUsage = async (signature: string) => {
    if (!b || !usageChanged.size || usageIncomplete) return;
    setUsageSaving(true);
    let ok = 0;
    const failed: string[] = [];
    for (const code of usageChanged) {
      const l = usage[code] ?? UEMPTY;
      const line = !uFilled(l) ? null : {
        qty: Number(l.qty.replace(",", ".")), category: l.category, note: l.note.trim() || null,
        ...(l.photo ? { photo: l.photo.image, takenAt: l.photo.taken_at, latitude: l.photo.lat, longitude: l.photo.lng } : {}) };
      try {
        await call("/api/waste/usage", { method: "PUT", json: { branchCode: b.code, businessDate: day, lines: { [code]: line }, signature } });
        ok += 1;
      } catch (e) {
        failed.push(`${data?.items.usage.find((i) => i.code === code)?.name ?? code}: ${(e as Error).message}`);
      }
    }
    if (ok) toast(tr("Usage Management saved: {0} SKUs", ok));
    if (failed.length) toast(failed.join(" · "), "error");
    setUsageSaving(false);
    await load(branch, day);
  };

  const flagNoWaste = async (on: boolean) => {
    if (!b) return;
    setFlagging(true);
    try {
      await call("/api/waste/no-waste", { method: "PUT", json: { branchCode: b.code, businessDate: day, noWaste: on } });
      await load(branch, day);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setFlagging(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await call(`/api/waste/entries/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      await load(branch, day);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRemoving(false);
    }
  };

  const subtitle = tr("Enter the waste of your branch");
  if (error || !data) {
    return (
      <Page title={tr("Waste")} subtitle={subtitle} actions={<LiveClock />}>
        {error ? <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white"><ErrorState message={error} onRetry={() => void load(branch, day)} /></div>
          : <div className="mx-auto max-w-5xl space-y-4"><SkeletonList rows={3} /><SkeletonList rows={5} /></div>}
      </Page>
    );
  }
  const dayName = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "short" });

  return (
    <Page title={tr("Waste")} subtitle={subtitle} actions={<LiveClock />}>
      <div className="mx-auto max-w-5xl space-y-4">
        {data.branches.length === 0 ? (
          <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-6 py-12 text-center text-sm text-[color:var(--j-626F86)]">
            {tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <FormCard n={1} title={tr("Branch and Day")} hint={tr("Waste is entered for today or, late, for yesterday")}>
                <NativeSelect className={inputClass} value={branch} onChange={(e) => pickBranch(e.target.value)} aria-label={tr("Branch")}>
                  <option value="">{tr("Choose the branch")}</option>
                  {data.branches.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                </NativeSelect>
                <Segmented label={tr("Day")} value={day} onChange={pickDay}
                  options={[{ value: data.days.to, label: `${tr("Today")} · ${dayName(data.days.to)}` }, { value: data.days.from, label: `${tr("Yesterday")} · ${dayName(data.days.from)}` }]} />
                {b && (data.data.length > 0 ? (
                  <p className="flex items-center gap-2 rounded-[3px] bg-[color:var(--j-DCFFF1)] px-3 py-2 text-xs text-[color:var(--j-216E4E)]"><CheckCircle2 size={14} />{tr("Waste reported for this day: {0} items", data.data.length)}</p>
                ) : data.noWaste ? (
                  <div className="flex items-center gap-2 rounded-[3px] bg-[color:var(--j-DCFFF1)] px-3 py-2 text-xs text-[color:var(--j-216E4E)]">
                    <CheckCircle2 size={14} /><span className="flex-1">{tr("Reported: no waste this day ({0}, {1})", data.noWaste.by, wibDateTime(data.noWaste.at))}</span>
                    <button type="button" className="font-medium underline" disabled={flagging} onClick={() => void flagNoWaste(false)}>{tr("Undo")}</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-[3px] bg-[color:var(--j-FFF7D6)] px-3 py-2 text-xs text-[color:var(--j-7F5F01)] sm:flex-row sm:items-center">
                    <span className="flex-1">{tr("Waste is reported every day. Enter the wasted items below, or confirm there was none.")}</span>
                    <Button size="sm" variant="secondary" loading={flagging} onClick={() => void flagNoWaste(true)}><CheckCircle2 size={14} />{tr("No waste today")}</Button>
                  </div>
                ))}
              </FormCard>

              <FormCard n={2} title={tr("Wasted Items")} hint={tr("Fill the quantity of each wasted SKU; every filled SKU needs its category, a photo and the note / reason; the dates are optional")}>
                <Segmented label={tr("Type")} value={scope} onChange={pickScope} options={ENTRY_SCOPES.map((s) => ({ value: s, label: scopeLabel(s) }))} />
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
                  <input className={cx(searchClass, "pl-9")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search the item name or code")} />
                </div>
                <label className="flex items-center gap-2 text-xs text-[color:var(--j-44546F)]">
                  <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} />{tr("Show filled SKUs only")}
                </label>
                <div className="max-h-[560px] overflow-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 border-b-2 border-[color:var(--j-DCDFE4)] bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">
                      <tr><th className="w-10 px-2 py-2 text-right">No</th><th className="px-2 py-2">{scope === "premix" ? tr("Premix/WIP name") : tr("Product name")}</th>
                        <th className="hidden whitespace-nowrap px-2 py-2 xl:table-cell">{tr("Product Code")}</th><th className="px-2 py-2">{tr("Unit")}</th><th className="w-24 whitespace-nowrap px-2 py-2 text-right">{tr("Qty")}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
                      {items.slice(0, 250).map((i) => {
                        const r = rows[i.code] ?? EMPTY;
                        const on = isFilled(r);
                        const lack = on ? lacks(r) : [];
                        const uom = uomOf(i, r);
                        const fixed = (i.units ?? []).filter((u) => u.uom.toLowerCase() !== "gram");
                        const calc = scope === "premix" && on ? explodePremix(i, uom, qtyOf(r)) : null;
                        return (
                          <Fragment key={i.code}>
                            <tr className={cx(on && (lack.length ? "bg-[color:var(--j-FFF7D6)]/60" : "bg-[color:var(--j-E9F2FF)]"))}>
                              <td className="px-2 py-1.5 text-right align-top text-xs tabular-nums text-[color:var(--j-626F86)]">{(data.items[scope] ?? []).indexOf(i) + 1}</td>
                              <td className="px-2 py-1.5 align-top">
                                <span className="block text-[color:var(--j-172B4D)]">{i.name}</span>
                                <span className="text-[11px] text-[color:var(--j-626F86)] xl:hidden">{i.code}</span>
                                {scope === "premix" && fixed.length > 0 && <span className="block text-[11px] text-[color:var(--j-626F86)]">{fixed.map((u) => `1 ${u.uom} = ${fmtQty(u.grams)} g`).join(" · ")}</span>}
                              </td>
                              <td className="hidden whitespace-nowrap px-2 py-1.5 align-top text-xs text-[color:var(--j-626F86)] xl:table-cell">{i.code}</td>
                              <td className="px-2 py-1.5 align-top text-xs text-[color:var(--j-626F86)]">
                                {scope === "premix" && (i.units?.length ?? 0) > 1 ? (
                                  <NativeSelect value={uom} onChange={(e) => setRow(i.code, { uom: e.target.value })} aria-label={tr("Unit of {0}", i.name)}
                                    className="h-9 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-1.5 text-xs text-[color:var(--j-44546F)]">
                                    {i.units!.map((u) => <option key={u.uom} value={u.uom}>{unitText(u.uom)}</option>)}
                                  </NativeSelect>
                                ) : scope === "premix" ? unitText(uom) : i.unit}
                              </td>
                              <td className="px-2 py-1.5 text-right align-top">
                                <input className={cx(inputClass, "h-9 w-24 text-right")} inputMode="decimal" placeholder="0" aria-label={i.name} value={r.qty}
                                  onChange={(e) => setRow(i.code, { qty: e.target.value.replace(/[^0-9.,]/g, "") })} />
                                {calc && uom.toLowerCase() !== "gram" && <span className="mt-0.5 block text-[11px] tabular-nums text-[color:var(--j-5E4DB2)]">= {fmtQty(calc.grams)} g</span>}
                              </td>
                            </tr>
                            {on && (
                              <tr className={lack.length ? "bg-[color:var(--j-FFF7D6)]/60" : "bg-[color:var(--j-E9F2FF)]"}>
                                <td />
                                <td colSpan={4} className="px-2 pb-3">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <NativeSelect className={cx(inputClass, "h-9")} value={r.category} onChange={(e) => setRow(i.code, { category: e.target.value })} aria-label={tr("Waste Category")}>
                                      <option value="">{tr("Choose the category")}</option>
                                      {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </NativeSelect>
                                    {/* other categories of the same SKU, each with its own quantity (2026-11-11) */}
                                    {(r.more ?? []).map((m, k) => (
                                      <div key={k} className="flex items-center gap-2 sm:col-span-2">
                                        <input className={cx(inputClass, "h-9 w-24 text-right tabular-nums")} inputMode="decimal" placeholder="0" value={m.qty}
                                          aria-label={tr("Quantity of the category")}
                                          onChange={(e) => setRow(i.code, { more: r.more.map((x, j) => (j === k ? { ...x, qty: e.target.value.replace(/[^0-9.,]/g, "") } : x)) })} />
                                        <NativeSelect className={cx(inputClass, "h-9 flex-1")} value={m.category} aria-label={tr("Waste Category")}
                                          onChange={(e) => setRow(i.code, { more: r.more.map((x, j) => (j === k ? { ...x, category: e.target.value } : x)) })}>
                                          <option value="">{tr("Choose the category")}</option>
                                          {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </NativeSelect>
                                        <button type="button" aria-label={tr("Remove the category")} onClick={() => setRow(i.code, { more: r.more.filter((_, j) => j !== k) })}
                                          className="rounded-[3px] px-2 py-2 text-xs font-medium text-[color:var(--j-626F86)] hover:text-[color:var(--j-C9372C)]">✕</button>
                                      </div>
                                    ))}
                                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                                      <button type="button" onClick={() => setRow(i.code, { more: [...(r.more ?? []), { qty: "", category: "" }] })}
                                        className="rounded-[3px] px-2 py-1 text-xs font-semibold text-[color:var(--j-0C66E4)] ring-1 ring-[color:var(--j-85B8FF)] hover:bg-[color:var(--j-E9F2FF)]">+ {tr("Another category")}</button>
                                      {(r.more ?? []).length > 0 && <span className="text-[11px] text-[color:var(--j-626F86)]">{tr("The first quantity is for the first category; total {0} {1}", fmtQty(totalOf(r)), uom)}</span>}
                                    </div>
                                    <input className={cx(inputClass, "h-9")} value={r.note} maxLength={500} onChange={(e) => setRow(i.code, { note: e.target.value })} placeholder={tr("Note / reason (required)")} aria-required="true" />
                                    <label className="text-[11px] text-[color:var(--j-626F86)]">{tr("Production Date")}
                                      <input type="date" className={cx(inputClass, "mt-0.5 h-9")} value={r.made} max={day} onChange={(e) => setRow(i.code, { made: e.target.value })} />
                                    </label>
                                    <label className="text-[11px] text-[color:var(--j-626F86)]">{tr("Expired Date")}
                                      <input type="date" className={cx(inputClass, "mt-0.5 h-9")} value={r.expires} min={r.made || undefined} onChange={(e) => setRow(i.code, { expires: e.target.value })} />
                                    </label>
                                    {calc && calc.ingredients.length > 0 && (
                                      <div className="rounded-[3px] bg-white/70 px-2.5 py-1.5 text-[11px] text-[color:var(--j-44546F)] ring-1 ring-[color:var(--j-DFD8FD)] sm:col-span-2">
                                        <span className="font-semibold text-[color:var(--j-5E4DB2)]">{tr("Ingredients")}: </span>
                                        {calc.ingredients.map((c) => `${c.name} ${fmtGrams(c.grams)} g`).join(" · ")}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 sm:col-span-2">
                                      {r.photo ? (
                                        <>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={r.photo.image} alt={tr("Photo evidence")} className="h-14 w-14 rounded-[3px] object-cover ring-1 ring-[color:var(--j-DCDFE4)]" />
                                          <Button variant="secondary" size="sm" onClick={() => setShooting(i)}><Camera size={14} />{tr("Retake")}</Button>
                                        </>
                                      ) : (
                                        <Button variant="secondary" size="sm" onClick={() => setShooting(i)} disabled={!b}><Camera size={14} />{tr("Take Photo")}</Button>
                                      )}
                                      {lack.length > 0 && <span className="text-[11px] text-[color:var(--j-7F5F01)]">{tr("Still missing: {0}", lack.join(", "))}</span>}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {!items.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[color:var(--j-626F86)]">{scope === "premix" && !search ? tr("No WIP recipe is active for this location.") : tr("No item found")}</td></tr>}
                    </tbody>
                  </table>
                  {items.length > 250 && <p className="px-3 py-2 text-center text-[11px] text-[color:var(--j-626F86)]">{tr("Search to see the other {0} SKUs", items.length - 250)}</p>}
                </div>
                {premixTotals.length > 0 && (
                  <div className="rounded-[3px] bg-[color:var(--j-F3F0FF)]/60 px-3 py-2">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold capitalize text-[color:var(--j-5E4DB2)]"><FlaskConical size={13} />{tr("Premix ingredients wasted (calculated)")}</p>
                    <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                      {premixTotals.map((p) => (
                        <li key={p.name} className={cx("flex justify-between gap-2", !p.stock && "text-[color:var(--j-626F86)]")}>
                          <span className="truncate">{p.name}{!p.stock && ` (${tr("not stock")})`}</span><span className="tabular-nums">{fmtGrams(p.grams)} g</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-col gap-2 border-t border-[color:var(--j-F1F2F4)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[color:var(--j-626F86)]">{filled.length ? (incomplete ? tr("{0} SKUs filled, {1} still incomplete", filled.length, incomplete) : tr("{0} SKUs ready to save", filled.length)) : tr("No SKU filled yet")}</p>
                  <Button onClick={() => setSigning("waste")} loading={saving} disabled={!b || !filled.length || incomplete > 0}><Plus size={16} />{tr("Save {0} SKUs", filled.length)}</Button>
                </div>
              </FormCard>

              <FormCard n={3} title={tr("Usage Management")} hint={tr("Fill the quantity of every usage item of the day; every filled SKU needs its category and a photo, the reason is optional")}>
                {!b ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("Choose the branch first")}</p> : (
                  <>
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
                      <input className={cx(searchClass, "pl-9")} value={usageSearch} onChange={(e) => setUsageSearch(e.target.value)} placeholder={tr("Search the item name or code")} />
                    </div>
                    <div className="max-h-[460px] overflow-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 border-b-2 border-[color:var(--j-DCDFE4)] bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">
                          <tr><th className="w-10 px-2 py-2 text-right">No</th><th className="px-2 py-2">{tr("Product Name")}</th>
                            <th className="hidden whitespace-nowrap px-2 py-2 xl:table-cell">{tr("Product Code")}</th><th className="px-2 py-2">{tr("Unit")}</th><th className="w-24 whitespace-nowrap px-2 py-2 text-right">{tr("Qty")}</th></tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
                          {usageItems.map((i) => {
                            const l = usage[i.code] ?? UEMPTY;
                            const on = uFilled(l);
                            const lack = on ? uLacksOf(i.code) : [];
                            const odd = usageChanged.has(i.code) ? usageOdd(i.code) : null;
                            return (
                              <Fragment key={i.code}>
                                <tr className={cx(on && (lack.length ? "bg-[color:var(--j-FFF7D6)]/60" : "bg-[color:var(--j-E9F2FF)]"))}>
                                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-[color:var(--j-626F86)]">{data.items.usage.indexOf(i) + 1}</td>
                                  <td className="px-2 py-1.5"><span className="block text-[color:var(--j-172B4D)]">{i.name}</span><span className="text-[11px] text-[color:var(--j-626F86)] xl:hidden">{i.code}</span></td>
                                  <td className="hidden whitespace-nowrap px-2 py-1.5 text-xs text-[color:var(--j-626F86)] xl:table-cell">{i.code}</td>
                                  <td className="px-2 py-1.5 text-xs text-[color:var(--j-626F86)]">{i.unit}</td>
                                  <td className="px-2 py-1.5">
                                    <input className={cx(inputClass, "h-9 w-24 text-right")} inputMode="decimal" placeholder="0" aria-label={i.name} value={l.qty}
                                      onChange={(e) => setULine(i.code, { qty: e.target.value.replace(/[^0-9.,]/g, "") })} />
                                  </td>
                                </tr>
                                {on && (
                                  <tr className={lack.length ? "bg-[color:var(--j-FFF7D6)]/60" : "bg-[color:var(--j-E9F2FF)]"}>
                                    <td />
                                    <td colSpan={4} className="px-2 pb-3">
                                      {odd && (
                                        <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 rounded-[3px] border border-[color:var(--j-F5CD47)] bg-[color:var(--j-FFF7D6)] px-3 py-2 text-xs text-[color:var(--j-7F5F01)]">
                                          <AlertTriangle size={14} className="shrink-0" aria-hidden />
                                          <span className="min-w-0 flex-1">{tr("{0} {1}? Usually about {2}.", fmtQty(odd.qty), i.unit, fmtQty(odd.usual))}{odd.suggested != null && ` ${tr("Did you mean {0} {1}?", fmtQty(odd.suggested), i.unit)}`}</span>
                                          {odd.suggested != null && <Button variant="secondary" size="sm" onClick={() => setULine(i.code, { qty: String(odd.suggested) })}>{tr("Use {0}", fmtQty(odd.suggested))}</Button>}
                                        </div>)}
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <NativeSelect className={cx(inputClass, "h-9")} value={l.category} onChange={(e) => setULine(i.code, { category: e.target.value })} aria-label={tr("Category")}>
                                          <option value="">{tr("Choose the category")}</option>
                                          {(data.usageCategories ?? data.categories).map((c) => <option key={c} value={c}>{c}</option>)}
                                        </NativeSelect>
                                        <input className={cx(inputClass, "h-9")} value={l.note} maxLength={500} onChange={(e) => setULine(i.code, { note: e.target.value })} placeholder={odd ? tr("Reason (required: unusual quantity)") : tr("Reason (optional)")} aria-required={!!odd} />
                                        <div className="flex items-center gap-2 sm:col-span-2">
                                          {l.photo || l.hasPhoto ? (
                                            <>
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={l.photo ? l.photo.image : usagePhotoUrl(b.code, day, i.code)} alt={tr("Photo evidence")} className="h-14 w-14 rounded-[3px] object-cover ring-1 ring-[color:var(--j-DCDFE4)]" />
                                              <Button variant="secondary" size="sm" onClick={() => setShooting({ ...i, usage: true })}><Camera size={14} />{tr("Retake")}</Button>
                                            </>
                                          ) : (
                                            <Button variant="secondary" size="sm" onClick={() => setShooting({ ...i, usage: true })}><Camera size={14} />{tr("Take Photo")}</Button>
                                          )}
                                          {lack.length > 0 && <span className="text-[11px] text-[color:var(--j-7F5F01)]">{tr("Still missing: {0}", lack.join(", "))}</span>}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                          {!usageItems.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[color:var(--j-626F86)]">{tr("No item found")}</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-[color:var(--j-F1F2F4)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex items-center gap-1.5 text-xs text-[color:var(--j-626F86)]"><ClipboardList size={14} />{tr("{0} of {1} items filled", usageFilled, data.items.usage.length)}{usageChanged.size ? ` · ${usageIncomplete ? tr("{0} SKUs filled, {1} still incomplete", usageChanged.size, usageIncomplete) : tr("not saved yet")}` : ""}</p>
                      <Button onClick={() => (usageOdds.length ? setOddAsk(true) : setSigning("usage"))} loading={usageSaving} disabled={!usageChanged.size || usageIncomplete > 0}><Save size={16} />{tr("Save Usage Management")}</Button>
                    </div>
                  </>
                )}
              </FormCard>
            </div>

            <EntryList entries={data.data} branch={b?.name ?? ""} day={day ? dayName(day) : ""} me={me?.id ?? ""} onRemove={setRemove} />
          </div>
        )}
      </div>
      <CameraCapture open={!!shooting} title={shooting?.usage ? tr("Usage Management") : tr("Waste")} branch={b?.name ?? ""} countNumber={shooting?.name ?? ""}
        onClose={() => setShooting(null)} onShot={async (s) => { if (shooting?.usage) setULine(shooting.code, { photo: s }); else if (shooting) setRow(shooting.code, { photo: s }); setShooting(null); }} />
      <ConfirmDialog open={!!remove} title={tr("Delete this waste?")} danger confirmLabel={tr("Delete")} busy={removing}
        description={remove ? `${remove.itemName} · ${fmtQty(remove.qty)} ${remove.unit}` : ""} onConfirm={() => void confirmRemove()} onClose={() => setRemove(null)} />
      <Dialog open={oddAsk} onClose={() => setOddAsk(false)} title={tr("Check the quantity")} description={tr("These quantities are far above the usual. Is the unit right?")}
        footer={<><Button variant="secondary" onClick={() => setOddAsk(false)}>{tr("Check again")}</Button><Button onClick={() => { setOddAsk(false); setSigning("usage"); }}>{tr("It is right, save")}</Button></>}>
        <ul className="divide-y divide-[color:var(--j-F1F2F4)] text-sm">{usageOdds.map((o) => (
          <li key={o.item.code} className="flex items-start justify-between gap-3 py-2"><span className="min-w-0 text-[color:var(--j-172B4D)]">{o.item.name}</span>
            <span className="shrink-0 text-right tabular-nums"><b className="text-[color:var(--j-7F5F01)]">{fmtQty(o.qty)}</b> <span className="text-xs text-[color:var(--j-626F86)]">{o.item.unit}</span>
              <span className="block text-[11px] text-[color:var(--j-626F86)]">{tr("usual {0}", fmtQty(o.usual))}{o.suggested != null && ` · ${tr("suggested {0}", fmtQty(o.suggested))}`}</span>
              <span className="block max-w-[12rem] text-[11px] text-[color:var(--j-44546F)]">“{usage[o.item.code]?.note}”</span></span></li>))}</ul>
      </Dialog>
      {signing && <SignDialog what={signing} count={signing === "waste" ? filled.length : usageChanged.size}
        onClose={() => setSigning(null)}
        onSign={(sig) => { const w = signing; setSigning(null); void (w === "waste" ? save(sig) : saveUsage(sig)); }} />}
    </Page>
  );
}

/** What Cost Control corrected on an entry, shown to the place it belongs to (2026-11-24). */
function OwnCorrections({ entry }: { entry: Entry }) {
  const [rows, setRows] = useState<{ field: string; old: string | null; new: string | null; reason: string | null; by: string | null }[]>([]);
  const n = entry.corrections ?? 0;
  useEffect(() => {
    if (!n) return;
    let off = false;
    call<{ data: typeof rows }>(`/api/waste/entries/${entry.id}/corrections`).then((r) => { if (!off) setRows(r.data); }).catch(() => { /* the entry shows its corrected figures anyway */ });
    return () => { off = true; };
  }, [entry.id, n]);
  if (!n) return null;
  return (
    <div className="mt-1 rounded-[3px] bg-[color:var(--j-E9F2FF)] px-2 py-1 text-[11px] text-[color:var(--j-0055CC)]">
      <p className="font-semibold">{tr("Corrected by Cost Control")}</p>
      {rows.map((x, i) => <p key={i}>{x.field}: {x.old ?? "—"} → {x.new ?? "—"}{x.reason ? ` · ${x.reason}` : ""}{x.by ? ` (${x.by})` : ""}</p>)}
    </div>
  );
}

function EntryList({ entries, branch, day, me, onRemove }: { entries: Entry[]; branch: string; day: string; me: string; onRemove: (e: Entry) => void }) {
  return (
    <section className="h-fit rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--j-F1F2F4)] px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Waste entered")}</span>
          <span className="block truncate text-xs text-[color:var(--j-626F86)]">{branch ? `${branch} · ${day}` : tr("Choose the branch")}</span>
        </span>
        <Badge tone={entries.length ? "blue" : "slate"}>{tr("{0} items", entries.length)}</Badge>
      </header>
      {!entries.length ? (
        <p className="px-4 py-10 text-center text-sm text-[color:var(--j-626F86)]">{branch ? tr("No waste entered yet for this day.") : tr("Choose the branch to see its waste.")}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 px-4 py-3">
              <a href={photoUrl(e.id)} target="_blank" rel="noreferrer" className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(photoUrl(e.id), 160)} decoding="async" alt="" loading="lazy" className="h-14 w-14 rounded-[3px] bg-[color:var(--j-091E420F)] object-cover" />
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{e.itemName}</p>
                  <Badge tone={statusTone(e.status)}>{e.status === "approved" ? <CheckCircle2 size={11} /> : null}{statusLabel(e.status)}</Badge>
                </div>
                <p className="text-xs text-[color:var(--j-44546F)]">{fmtQty(e.qty)} {e.scope === "premix" ? unitText(e.unit) : e.unit}{e.scope === "premix" && e.grams != null && e.unit.toLowerCase() !== "gram" ? ` (${fmtQty(e.grams)} g)` : ""} · {scopeLabel(e.scope)} · {e.category}</p>
                {e.ingredients?.length ? <p className="text-[11px] text-[color:var(--j-5E4DB2)]">{e.ingredients.map((c) => `${c.name} ${fmtGrams(c.grams)} g`).join(" · ")}</p> : null}
                {(e.productionDate || e.expiredDate) && <p className="text-[11px] text-[color:var(--j-626F86)]">{tr("Production")} {e.productionDate ?? "—"} · {tr("Expired")} {e.expiredDate ?? "—"}</p>}
                {e.note && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">“{e.note}”</p>}
                {e.review?.note && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{tr("Cost Control")}: {e.review.note}</p>}
                <OwnCorrections entry={e} />
                <p className="mt-0.5 text-[11px] text-[color:var(--j-626F86)]">{e.name} · {wibDateTime(e.createdAt)}</p>
              </div>
              {e.status === "submitted" && e.userId === me && (
                <button type="button" onClick={() => onRemove(e)} className="h-fit rounded-[3px] p-1.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-FFECEB)] hover:text-[color:var(--j-C9372C)]" aria-label={tr("Delete")}><Trash2 size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The signature of the person who submits (migration 055): drawn before the waste SKUs or the Usage Management list
 * are saved; it is kept with every entry and shown to Cost Control. */
function SignDialog({ what, count, onSign, onClose }: { what: "waste" | "usage"; count: number; onSign: (image: string) => void; onClose: () => void }) {
  const [sig, setSig] = useState<string | null>(null);
  return (
    <Dialog open size="sm" onClose={onClose} title={tr("Sign Before Submitting")}
      description={what === "waste" ? tr("{0} waste SKUs", count) : tr("Usage Management: {0} SKUs", count)}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button disabled={!sig} onClick={() => sig && onSign(sig)}><PenLine size={15} />{tr("Sign & Submit")}</Button>
      </>}>
      <p className="mb-3 text-xs text-[color:var(--j-626F86)]">{tr("By signing, I confirm the quantities, categories and photos entered are true.")}</p>
      <SignaturePad onChange={setSig} />
    </Dialog>
  );
}
