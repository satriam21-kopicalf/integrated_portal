"use client";

// Monitoring COTR → Incentive Calculator (page cotr.incentive, backend migration 053): the monthly incentive of every
// driver (cups sold per segment of the tiers, product bonus, late / absent deductions of Master Schedule, minimum
// attendance), the schemes the COTR team adjusts (versioned by the month they start) and a simulator.

import { Calculator, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, cx } from "@/so/ui";
import { kcTable } from "@/components/kc";
import { Page, Panel } from "@/components/kc/compat";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool } from "@/cotr/types";
import { MasterTable, rupiah, useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

type Tier = { from: number; to: number | null; rate: number };
type Bonus = { menu: string; rate: number };
type Scheme = { code: string; name: string; valid_from: string; tiers: Tier[]; product_bonus: Bonus[]; late_penalty: number; absent_penalty: number; min_attendance_pct: number; is_active: boolean; note: string | null };
type Part = { cups: number; rate: number; pay: number };
type Row = { driver: string; name: string; pool: string | null; attendance: { scheduled: number; worked: number; late: number; absent: number };
  cups: number; tiers: (Part & Tier)[]; bonus: (Part & { menu: string })[]; gross: number; deduction: number; attendancePct: number | null; eligible: boolean; total: number };
type Recap = { month: string; scheme: Scheme; rows: Row[]; total: number; cups: number };

const num = (n: number) => n.toLocaleString(locale());

/** The same formula as the backend (app/cotr.py incentive), for the simulator and the scheme preview. */
function tierPay(cups: number, tiers: Tier[]) {
  return tiers.map((t) => { const n = Math.max(0, (t.to === null ? cups : Math.min(cups, t.to)) - t.from); return { ...t, cups: n, pay: n * t.rate }; });
}

export default function CotrIncentivePage() {
  const [tab, setTab] = useState<"recap" | "simulate" | "schemes">("recap");
  return (
    <Page eyebrow="Monitoring COTR" media={<Calculator size={19} />} title={tr("Incentive Calculator")} subtitle={tr("Monthly incentive of the drivers from cups sold and the attendance of Master Schedule")}>
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[
        { value: "recap", label: tr("Monthly recap") }, { value: "simulate", label: tr("Simulator") }, { value: "schemes", label: tr("Schemes") },
      ]} />
      {tab === "recap" && <RecapView />}
      {tab === "simulate" && <Simulator />}
      {tab === "schemes" && <Schemes />}
    </Page>
  );
}

function RecapView() {
  const pools = useMaster<Pool>("pools");
  const schemes = useMaster<Scheme>("incentive-schemes");
  const [month, setMonth] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7));
  const [scheme, setScheme] = useState("");
  const [pool, setPool] = useState("");
  const [data, setData] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    call<Recap>(`/api/cotr/incentives?month=${month}${scheme ? `&scheme=${encodeURIComponent(scheme)}` : ""}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((d) => { if (alive) setData(d); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [month, scheme, pool, tick]);

  const exportCsv = () => {
    if (!data) return;
    const head = ["Kode", "Driver", "Pool", "Cup", "Terjadwal", "Bekerja", "Terlambat", "Tidak hadir", "Kehadiran %", "Insentif tier", "Bonus produk", "Potongan", "Total"];
    const lines = data.rows.map((r) => [r.driver, r.name, r.pool ?? "", r.cups, r.attendance.scheduled, r.attendance.worked, r.attendance.late, r.attendance.absent,
      r.attendancePct ?? "", r.tiers.reduce((a, t) => a + t.pay, 0), r.bonus.reduce((a, b) => a + b.pay, 0), r.deduction, r.total]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `insentif-cotr-${data.month}.csv`;
    a.click();
  };

  return (
    <Panel title={tr("Incentives of {0}", month)} description={data ? `${tr("Scheme")}: ${data.scheme.name} · ${num(data.cups)} ${tr("cups")} · ${tr("Total")} ${rupiah(data.total)}` : undefined}
      actions={<Button size="sm" variant="secondary" disabled={!data?.rows.length} onClick={exportCsv}><Download size={14} /> {tr("Export CSV")}</Button>}
      toolbar={<div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Month")} className="w-40"><Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
        <Field label={tr("Scheme")} className="w-56"><Select value={scheme} onChange={(e) => setScheme(e.target.value)}><option value="">{tr("Scheme of the month")}</option>{(schemes.rows ?? []).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</Select></Field>
        <Field label={tr("Pool / HUB")} className="w-48"><Select value={pool} onChange={(e) => setPool(e.target.value)}><option value="">{tr("All pools")}</option>{(pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Button variant="secondary" onClick={() => setTick((t) => t + 1)}><RefreshCw size={15} /> {tr("Refresh")}</Button>
      </div>}>
      {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <div className="skeleton m-4 h-40 rounded-xl" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Driver")}</th><th className="px-3 py-2.5 text-right">{tr("Cups")}</th><th className="px-3 py-2.5 text-right">{tr("Attendance")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Tiers")}</th><th className="px-3 py-2.5 text-right">{tr("Product bonus")}</th><th className="px-3 py-2.5 text-right">{tr("Deduction")}</th><th className="px-4 py-2.5 text-right">{tr("Incentive")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <Fragment key={r.driver}>
                  <tr className="cursor-pointer hover:bg-neutral-50" onClick={() => setOpen(open === r.driver ? null : r.driver)}>
                    <td className="px-4 py-2"><span className="block font-medium text-neutral-900">{r.name}</span><span className="text-[11px] text-neutral-400">{r.driver}{r.pool ? ` · ${r.pool}` : ""}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.cups)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      <span className="tabular-nums">{r.attendance.worked}/{r.attendance.scheduled}{r.attendancePct !== null ? ` · ${r.attendancePct}%` : ""}</span>
                      {!r.eligible && <Badge tone="red">{tr("Below minimum")}</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupiah(r.tiers.reduce((a, t) => a + t.pay, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupiah(r.bonus.reduce((a, b) => a + b.pay, 0))}</td>
                    <td className={cx("px-3 py-2 text-right tabular-nums", r.deduction ? "text-red-700" : "")}>{r.deduction ? `−${rupiah(r.deduction)}` : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{rupiah(r.total)}</td>
                  </tr>
                  {open === r.driver && (
                    <tr className="bg-neutral-50/60">
                      <td colSpan={7} className="px-4 py-3"><Breakdown row={r} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">{tr("No drivers in this pool")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Breakdown({ row }: { row: Pick<Row, "tiers" | "bonus" | "deduction" | "attendance"> }) {
  return (
    <div className="grid gap-3 text-xs sm:grid-cols-3">
      <div>
        <p className="mb-1 font-semibold text-neutral-700">{tr("Tiers")}</p>
        {row.tiers.map((t, i) => (
          <p key={i} className="flex justify-between gap-3 tabular-nums"><span>{num(t.from)}–{t.to === null ? "∞" : num(t.to)}: {num(t.cups)} × {rupiah(t.rate)}</span><span>{rupiah(t.pay)}</span></p>
        ))}
      </div>
      <div>
        <p className="mb-1 font-semibold text-neutral-700">{tr("Product bonus")}</p>
        {row.bonus.length === 0 ? <p className="text-neutral-400">—</p> : row.bonus.map((b) => (
          <p key={b.menu} className="flex justify-between gap-3 tabular-nums"><span>{b.menu}: {num(b.cups)} × {rupiah(b.rate)}</span><span>{rupiah(b.pay)}</span></p>
        ))}
      </div>
      <div>
        <p className="mb-1 font-semibold text-neutral-700">{tr("Attendance")}</p>
        <p>{tr("Late")}: {row.attendance.late} · {tr("Absent")}: {row.attendance.absent}</p>
        <p className="tabular-nums">{tr("Deduction")}: {row.deduction ? `−${rupiah(row.deduction)}` : "—"}</p>
      </div>
    </div>
  );
}

function Simulator() {
  const schemes = useMaster<Scheme>("incentive-schemes");
  const [code, setCode] = useState("");
  const [cups, setCups] = useState(2600);
  const [att, setAtt] = useState({ scheduled: 26, worked: 26, late: 0, absent: 0 });
  const s = (schemes.rows ?? []).find((x) => x.code === code) ?? schemes.rows?.[0];
  const result = useMemo(() => {
    if (!s) return null;
    const tiers = tierPay(cups, s.tiers);
    const gross = tiers.reduce((a, t) => a + t.pay, 0);
    const deduction = att.late * s.late_penalty + att.absent * s.absent_penalty;
    const pct = att.scheduled ? Math.round((att.worked * 1000) / att.scheduled) / 10 : null;
    const eligible = !s.min_attendance_pct || (pct !== null && pct >= s.min_attendance_pct);
    return { tiers, gross, deduction, pct, eligible, total: eligible ? Math.max(0, gross - deduction) : 0 };
  }, [s, cups, att]);
  return (
    <Panel title={tr("Simulator")} description={tr("Try a number of cups and an attendance against a scheme (the product bonus is counted in the monthly recap)")}>
      <div className="grid gap-4 p-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-3">
          <Field label={tr("Scheme")}><Select value={s?.code ?? ""} onChange={(e) => setCode(e.target.value)}>{(schemes.rows ?? []).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</Select></Field>
          <Field label={tr("Cups in the month")}><Input type="number" min={0} value={cups} onChange={(e) => setCups(Math.max(0, Number(e.target.value)))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            {(["scheduled", "worked", "late", "absent"] as const).map((k) => (
              <Field key={k} label={{ scheduled: tr("Scheduled"), worked: tr("Worked"), late: tr("Late"), absent: tr("Absent") }[k]}>
                <Input type="number" min={0} value={att[k]} onChange={(e) => setAtt({ ...att, [k]: Math.max(0, Number(e.target.value)) })} />
              </Field>
            ))}
          </div>
        </div>
        {result && (
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">{tr("Incentive")}</p>
            <p className="text-3xl font-bold tabular-nums text-neutral-900">{rupiah(result.total)}</p>
            {!result.eligible && <p className="mt-1 text-xs text-red-700">{tr("Attendance {0}% is below the minimum {1}%", result.pct ?? 0, s!.min_attendance_pct)}</p>}
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {result.tiers.map((t, i) => (
                  <tr key={i} className={t.cups ? "" : "text-neutral-400"}><td className="py-1.5">{num(t.from)}–{t.to === null ? "∞" : num(t.to)} {tr("cups")}</td><td className="py-1.5 text-right tabular-nums">{num(t.cups)} × {rupiah(t.rate)}</td><td className="py-1.5 text-right tabular-nums">{rupiah(t.pay)}</td></tr>
                ))}
                <tr><td className="py-1.5" colSpan={2}>{tr("Deduction")}</td><td className="py-1.5 text-right tabular-nums text-red-700">{result.deduction ? `−${rupiah(result.deduction)}` : "—"}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}

function TiersInput({ value, onChange }: { value: Tier[]; onChange: (v: Tier[]) => void }) {
  const tiers = value ?? [];
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <Input type="number" value={t.from} onChange={(e) => onChange(tiers.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)))} className="h-9 w-24 text-right" aria-label={tr("From")} />
          <span>–</span>
          <Input type="number" value={t.to ?? ""} placeholder="∞" onChange={(e) => onChange(tiers.map((x, j) => (j === i ? { ...x, to: e.target.value === "" ? null : Number(e.target.value) } : x)))} className="h-9 w-24 text-right" aria-label={tr("To")} />
          <span>{tr("cups")} ×</span>
          <Input type="number" value={t.rate} onChange={(e) => onChange(tiers.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) } : x)))} className="h-9 w-28 text-right" aria-label={tr("Rate")} />
          <button type="button" aria-label={tr("Delete")} onClick={() => onChange(tiers.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => { const last = tiers[tiers.length - 1]; onChange([...tiers, { from: last?.to ?? 0, to: null, rate: 0 }]); }}><Plus size={13} /> {tr("Tier")}</Button>
    </div>
  );
}

function BonusInput({ value, onChange, menus }: { value: Bonus[]; onChange: (v: Bonus[]) => void; menus: Menu[] }) {
  const rows = value ?? [];
  return (
    <div className="space-y-2">
      {rows.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <Select value={b.menu} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, menu: e.target.value } : x)))} className="h-9 flex-1">
            <option value="">{tr("Choose a menu")}</option>{menus.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </Select>
          <span>×</span>
          <Input type="number" value={b.rate} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) } : x)))} className="h-9 w-28 text-right" aria-label={tr("Rate")} />
          <button type="button" aria-label={tr("Delete")} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...rows, { menu: "", rate: 0 }])}><Plus size={13} /> {tr("Bonus")}</Button>
    </div>
  );
}

function Schemes() {
  const master = useMaster<Scheme>("incentive-schemes");
  const menus = useMaster<Menu>("menus");
  const [edit, setEdit] = useState<Scheme | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!edit) return;
    setBusy(true); setError(null);
    try { await master.save(edit, edit.code); setEdit(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <MasterTable noun={tr("scheme")} title={tr("Schemes")} master={master}
        description={tr("A month uses the latest active scheme started by then; the tiers pay the cups of every segment")}
        blank={(): Partial<Scheme> => ({ code: "", name: "", valid_from: `${new Date().toISOString().slice(0, 7)}-01`, tiers: [], product_bonus: [], late_penalty: 0, absent_penalty: 0, min_attendance_pct: 0, is_active: true })}
        rowActions={(s) => <Button size="sm" variant="ghost" onClick={() => setEdit({ ...s, tiers: [...s.tiers], product_bonus: [...s.product_bonus] })}>{tr("Tiers & bonus")}</Button>}
        columns={[
          { label: tr("Scheme"), render: (s) => <><span className="block font-medium text-neutral-900">{s.name}</span><span className="text-[11px] text-neutral-400">{s.code}</span></> },
          { label: tr("From"), render: (s) => s.valid_from.slice(0, 7) },
          { label: tr("Tiers"), render: (s) => <span className="text-xs">{s.tiers.map((t) => `${num(t.from)}–${t.to === null ? "∞" : num(t.to)} × ${num(t.rate)}`).join(" · ") || "—"}</span> },
          { label: tr("Deductions"), render: (s) => <span className="text-xs">{tr("Late")} {rupiah(s.late_penalty)} · {tr("Absent")} {rupiah(s.absent_penalty)}</span> },
          { label: tr("Status"), render: (s) => s.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge tone="slate">{tr("Inactive")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "PROGRESIF-2027" },
          { key: "name", label: tr("Name"), required: true },
          { key: "valid_from", label: tr("Applies from (month)"), type: "date", required: true },
          { key: "late_penalty", label: tr("Deduction per late day (Rp)"), type: "number" },
          { key: "absent_penalty", label: tr("Deduction per absent day (Rp)"), type: "number" },
          { key: "min_attendance_pct", label: tr("Minimum attendance (%)"), type: "number", hint: tr("0: no minimum") },
          { key: "is_active", label: tr("Active"), type: "bool" },
          { key: "note", label: tr("Note"), type: "textarea" },
        ]} />
      {edit && (
        <Panel title={tr("Tiers & bonus of {0}", edit.name)} description={tr("Cups of every segment are paid at its rate; the last tier without an end")}
          actions={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>{tr("Cancel")}</Button><Button size="sm" loading={busy} onClick={() => void save()}>{tr("Save")}</Button></div>}>
          <div className="grid gap-6 p-4 lg:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold text-neutral-700">{tr("Tiers")}</p><TiersInput value={edit.tiers} onChange={(tiers) => setEdit({ ...edit, tiers })} /></div>
            <div><p className="mb-2 text-xs font-semibold text-neutral-700">{tr("Product bonus (per cup)")}</p><BonusInput value={edit.product_bonus} menus={menus.rows ?? []} onChange={(product_bonus) => setEdit({ ...edit, product_bonus })} /></div>
          </div>
          {error && <p className="px-4 pb-4 text-xs text-red-700">{error}</p>}
        </Panel>
      )}
    </>
  );
}
