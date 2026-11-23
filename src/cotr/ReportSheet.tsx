"use client";

// Calf On The Road → Report Armada (input), as the sheet of the pools (migration 134, 2026-11-23): one block per armada
// with every menu — B brought, S left, C cupping, W waste, T sold = B − S − C − W and its TOTAL at the menu price — then
// TOTAL PENDAPATAN, PENDAPATAN QRIS, PENDAPATAN CASH, ACTUAL CASH, OPERASIONAL and BALANCE, in the colours of the sheet.
// The storage (page cotr.storage) enters B / S / C / W; the office (page cotr.finance) the QRIS and the actual cash;
// operational = the requests of the driver the office approved that day; balance = actual cash − (cash − operational).
// What is entered here is the official day of the armada; the driver app is shown beside it to match.

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Check, ClipboardList, Save, Smartphone } from "lucide-react";
import { Button, Empty, ErrorState, cx, useToast } from "@/so/ui";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { FilterToolbar, type ActiveFilter } from "@/so/ui/Filters";
import { DayField, dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { rupiah, useMaster } from "@/cotr/ui";
import type { Pool } from "@/cotr/types";
import { useAuth } from "@/lib/auth";
import { tr } from "@/lib/i18n";

type Part = "b" | "s" | "c" | "w";
type Line = Record<Part | "t", number>;
type App = { lines: Record<string, Partial<Line>>; qris: number; cash: number; cashActual: number | null; total: number } | null;
type Armada = { driver: string; name: string; nickname: string | null; fleet: string | null; fleetName: string | null; source: string | null;
  lines: Record<string, Line>; total: number; qris: number | null; cash: number; cashActual: number | null; operational: number; operationalWaiting: number;
  balance: number | null; productsBy: string | null; productsAt: string | null; moneyBy: string | null; moneyAt: string | null; app: App };
type Sheet = { pool: string; day: string; menus: { code: string; name: string; price: number }[]; armadas: Armada[]; canProducts: boolean; canMoney: boolean };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const PARTS: Part[] = ["b", "s", "c", "w"];
const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;

export function ReportSheet() {
  const { user } = useAuth();
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent" && p.is_active);  // the pools of the armadas (HUB)
  const own = user?.hubPool ?? null;
  const [pool, setPool] = useState(own ?? "");
  const [day, setDay] = useState(todayWib());
  const [q, setQ] = useState("");
  const [data, setData] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ pool, day });
  const poolCode = own ?? pool;
  useEffect(() => { if (!poolCode && usable.length) setPool(usable[0].code); }, [poolCode, usable]);
  useEffect(() => {
    if (!poolCode) return;
    let alive = true;
    setData(null); setError(null);
    call<Sheet>(`/api/cotr/report-sheet?pool=${encodeURIComponent(poolCode)}&day=${day}`).then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [poolCode, day]);
  const words = q.trim().toLowerCase();
  const listed = useMemo(() => (data?.armadas ?? []).filter((a) => !words || `${a.name} ${a.nickname ?? ""} ${a.fleet ?? ""}`.toLowerCase().includes(words)), [data, words]);
  const poolName = usable.find((p) => p.code === poolCode)?.name ?? poolCode;
  const filters: ActiveFilter[] = day !== todayWib() ? [{ key: "day", label: `${tr("Day")}: ${dmyOf(day)}`, onRemove: () => setDay(todayWib()) }] : [];
  const sum = (f: (a: Armada) => number) => listed.reduce((s, a) => s + f(a), 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-900">{poolName} · {dmyOf(day)}</p>
        <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search armada or driver")} filters={filters}
          onOpen={() => { setDraft({ pool: poolCode, day }); setSheet(true); }} onClear={() => setDay(todayWib())} />
      </div>
      {sheet && (
        <MonitorFilterSheet active={draft.day !== todayWib() ? 1 : 0} onClose={() => setSheet(false)} onReset={() => setDraft({ ...draft, day: todayWib() })}
          onApply={() => { if (!own) setPool(draft.pool); setDay(draft.day); setSheet(false); }}>
          {!own && <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={usable.find((p) => p.code === draft.pool)?.name ?? null}>
            <ComboFilter value={draft.pool} onChange={(v) => setDraft({ ...draft, pool: v })} allLabel={tr("Choose a pool")} placeholder={tr("Search pool")}
              options={usable.map((p) => ({ value: p.code, label: p.name }))} />
          </FilterRow>}
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Day")} value={dmyOf(draft.day)}>
            <DayField value={draft.day} onChange={(v) => setDraft({ ...draft, day: v })} max={todayWib()} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-xs sm:grid-cols-5">
          {[[tr("Cups sold"), sum((a) => Object.values(a.lines).reduce((s, l) => s + l.t, 0)).toLocaleString("id-ID")], [tr("Total revenue"), rupiah(sum((a) => a.total))],
            [tr("QRIS"), rupiah(sum((a) => a.qris ?? 0))], [tr("Actual cash"), rupiah(sum((a) => a.cashActual ?? 0))],
            [tr("Balance"), rupiah(sum((a) => a.balance ?? 0))]].map(([k, v]) => (
            <div key={k} className="bg-white px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{k}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">{v}</p></div>
          ))}
        </div>
      )}
      {error ? <ErrorState message={error} /> : !data ? <div className="skeleton h-64 rounded-lg" /> : listed.length === 0 ? (
        <Empty icon={<ClipboardList size={28} />} title={tr("No armada in this pool")} />
      ) : (
        <div className="space-y-3">{listed.map((a) => <Block key={a.driver} a={a} sheet={data} onSaved={setData} />)}</div>
      )}
    </div>
  );
}

/** One armada as the block of the sheet. */
function Block({ a, sheet, onSaved }: { a: Armada; sheet: Sheet; onSaved: (s: Sheet) => void }) {
  const toast = useToast();
  const blank = () => Object.fromEntries(sheet.menus.map((m) => [m.code, Object.fromEntries(PARTS.map((p) => [p, a.lines[m.code]?.[p] ? String(a.lines[m.code][p]) : ""]))])) as Record<string, Record<Part, string>>;
  const [lines, setLines] = useState(blank);
  const [qris, setQris] = useState(a.qris !== null ? String(a.qris) : "");
  const [actual, setActual] = useState(a.cashActual !== null ? String(a.cashActual) : "");
  const [busy, setBusy] = useState<"p" | "m" | null>(null);
  const [showApp, setShowApp] = useState(false);
  useEffect(() => { setLines(blank()); setQris(a.qris !== null ? String(a.qris) : ""); setActual(a.cashActual !== null ? String(a.cashActual) : ""); }, [a]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = (code: string) => { const l = lines[code]; const v = (p: Part) => num(l?.[p] ?? ""); const t = v("b") - v("s") - v("c") - v("w"); return { ...Object.fromEntries(PARTS.map((p) => [p, v(p)])), t } as Line; };
  const price = Object.fromEntries(sheet.menus.map((m) => [m.code, m.price]));
  const rows = sheet.menus.map((m) => ({ m, l: row(m.code) }));
  const tot = (k: Part | "t") => rows.reduce((s, r) => s + r.l[k], 0);
  const revenue = rows.reduce((s, r) => s + Math.max(0, r.l.t) * price[r.m.code], 0);
  const q = num(qris), act = actual === "" ? null : num(actual);
  const cash = revenue - q;
  const balance = act === null ? null : act - (cash - a.operational);
  const bad = rows.some((r) => r.l.t < 0);
  const dirtyP = JSON.stringify(rows.map((r) => PARTS.map((p) => r.l[p]))) !== JSON.stringify(sheet.menus.map((m) => PARTS.map((p) => a.lines[m.code]?.[p] ?? 0)));
  const dirtyM = q !== (a.qris ?? 0) || act !== a.cashActual;
  const saveP = async () => {
    setBusy("p");
    try {
      onSaved(await call<Sheet>("/api/cotr/report-sheet/products", { method: "PUT", json: { pool: sheet.pool, day: sheet.day, driver: a.driver,
        lines: Object.fromEntries(rows.filter((r) => PARTS.some((p) => r.l[p])).map((r) => [r.m.code, Object.fromEntries(PARTS.map((p) => [p, r.l[p]]))])) } }));
      toast(tr("Products saved"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const saveM = async () => {
    setBusy("m");
    try { onSaved(await call<Sheet>("/api/cotr/report-sheet/money", { method: "PUT", json: { pool: sheet.pool, day: sheet.day, driver: a.driver, qris: q, cashActual: act } })); toast(tr("Money saved")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const cell = "border border-neutral-300 px-1.5 py-1";
  const inp = (val: string, set: (v: string) => void, can: boolean, label: string, wide?: boolean) => can
    ? <input inputMode="numeric" value={val} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} aria-label={label} placeholder="0"
        className={cx("h-8 w-full rounded-sm border border-transparent bg-white px-1 text-right tabular-nums hover:border-neutral-300 focus:border-brand-700 focus:outline-none", wide && "text-sm")} />
    : <span className="block text-right tabular-nums">{val || ""}</span>;
  const money = (label: string, value: React.ReactNode, tone: string, note?: React.ReactNode) => (
    <tr><td colSpan={2} className={cx(cell, "text-center text-[11px] font-bold uppercase", tone)}>{label}</td>
      <td colSpan={5} className={cx(cell, "text-[11px] text-neutral-500")}>{note}</td><td className={cx(cell, "text-right font-semibold tabular-nums")}>{value}</td></tr>
  );
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <span className="rounded-[3px] bg-yellow-300 px-1.5 py-0.5 text-xs font-bold text-neutral-900">{a.fleet ?? "—"}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{a.name}{a.nickname ? ` (${a.nickname})` : ""}</span>
        {a.productsAt && <span className="text-[11px] text-neutral-500">{tr("Products: {0}", a.productsBy ?? "—")}</span>}
        {a.moneyAt && <span className="text-[11px] text-neutral-500">· {tr("Money: {0}", a.moneyBy ?? "—")}</span>}
        {a.app && <button type="button" onClick={() => setShowApp((x) => !x)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50">
          <Smartphone size={12} />{showApp ? tr("Hide driver app") : tr("Driver app")}</button>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed border-collapse text-xs">
          <thead><tr className="bg-red-600 text-white">
            <th className={cx(cell, "w-[26%] text-left")}>{tr("Product")}</th><th className={cx(cell, "w-[13%] text-right")}>{tr("Price")}</th>
            {(["B", "S", "C", "W", "T"]).map((h) => <th key={h} className={cx(cell, "text-center")}>{h}</th>)}<th className={cx(cell, "w-[16%] text-right")}>TOTAL</th>
          </tr></thead>
          <tbody>
            {rows.map(({ m, l }) => (
              <tr key={m.code}>
                <td className={cx(cell, "whitespace-nowrap text-neutral-800")}>{m.name}</td><td className={cx(cell, "text-right tabular-nums text-neutral-500")}>{rupiah(m.price)}</td>
                {PARTS.map((p) => <td key={p} className={cx(cell, "p-0.5")}>{inp(lines[m.code]?.[p] ?? "", (v) => setLines((x) => ({ ...x, [m.code]: { ...x[m.code], [p]: v } })), sheet.canProducts, `${a.fleet} ${m.name} ${p.toUpperCase()}`)}
                  {showApp && a.app && <span className="block px-1 text-right text-[10px] text-sky-700">{a.app.lines[m.code]?.[p] ?? 0}</span>}</td>)}
                <td className={cx(cell, "text-right font-semibold tabular-nums", l.t < 0 && "bg-red-50 text-red-700")}>{l.t}
                  {showApp && a.app && <span className="block text-[10px] font-normal text-sky-700">{a.app.lines[m.code]?.t ?? 0}</span>}</td>
                <td className={cx(cell, "text-right tabular-nums")}>{rupiah(Math.max(0, l.t) * m.price)}</td>
              </tr>
            ))}
            <tr className="bg-neutral-300 font-semibold"><td colSpan={2} className={cx(cell, "text-center text-[11px] uppercase")}>{tr("Total products")}</td>
              {(["b", "s", "c", "w", "t"] as const).map((k) => <td key={k} className={cx(cell, "text-right tabular-nums")}>{tot(k)}</td>)}<td className={cell} /></tr>
            {money(tr("Total revenue"), rupiah(revenue), "bg-blue-700 text-cyan-200")}
            {money(tr("QRIS revenue"), inp(qris, setQris, sheet.canMoney, `${a.fleet} QRIS`, true), "bg-sky-300 text-neutral-900", showApp && a.app ? tr("App: {0}", rupiah(a.app.qris)) : undefined)}
            {money(tr("Cash revenue"), rupiah(cash), "bg-green-300 text-neutral-900")}
            {money(tr("Actual cash"), inp(actual, setActual, sheet.canMoney, `${a.fleet} actual cash`, true), "bg-green-300 text-neutral-900",
              showApp && a.app?.cashActual != null ? tr("App: {0}", rupiah(a.app.cashActual)) : undefined)}
            {money(tr("Operational"), rupiah(a.operational), "bg-green-300 text-neutral-900",
              a.operationalWaiting ? <span className="text-amber-700">{tr("{0} waiting for the office in Requests & Maintenance", rupiah(a.operationalWaiting))}</span> : tr("Driver requests approved by the office"))}
            <tr><td colSpan={2} className={cx(cell, "bg-green-300 text-center text-[11px] font-bold uppercase text-neutral-900")}>{tr("Balance")}</td>
              <td colSpan={5} className={cx(cell, "text-[11px] text-neutral-500")}>{tr("Actual cash − (cash revenue − operational)")}</td>
              <td className={cx(cell, "text-right font-bold tabular-nums", balance === null ? "text-neutral-400" : balance < 0 ? "bg-red-50 text-red-700" : balance > 0 ? "bg-emerald-50 text-emerald-700" : "")}>
                {balance === null ? "—" : `${balance > 0 ? "+" : ""}${rupiah(balance)}`}</td></tr>
          </tbody>
        </table>
      </div>
      {(sheet.canProducts || sheet.canMoney) && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 px-3 py-2">
          {bad && <span className="mr-auto text-xs text-red-700">{tr("Left + cupping + waste is more than brought")}</span>}
          {sheet.canProducts && <Button size="sm" variant={dirtyP ? "primary" : "secondary"} disabled={!dirtyP || bad} loading={busy === "p"} onClick={() => void saveP()}>
            {a.productsAt && !dirtyP ? <Check size={14} /> : <Save size={14} />} {tr("Save products")}</Button>}
          {sheet.canMoney && <Button size="sm" variant={dirtyM ? "primary" : "secondary"} disabled={!dirtyM} loading={busy === "m"} onClick={() => void saveM()}>
            {a.moneyAt && !dirtyM ? <Check size={14} /> : <Save size={14} />} {tr("Save QRIS & cash")}</Button>}
        </footer>
      )}
    </section>
  );
}
