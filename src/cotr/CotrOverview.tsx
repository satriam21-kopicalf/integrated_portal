"use client";

// Calf On The Road in the Dashboard (2026-11-13; integrated_portal_be app/cotr_overview.py): the cups and the sales of a
// period against its comparison, as the Dashboard of Kopi Calf / Wasgee shows theirs — the summary, the cups per day,
// the pools and the menus with their share and change, cash against QRIS and the drivers who sold most. The cups come
// from the Product stock of the pools (the workbook, else ESB COTR, else the driver app), valued at the menu price.

import { Banknote, Bike, CupSoda, QrCode, Store, Trash2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";

type Change = number | null;
type Row = { cups: number; value: number; share?: number | null; change?: Change };
type Data = {
  period: { from: string; to: string }; compare: { from: string; to: string };
  summary: { cups: number; value: number; days: number; waste: number; cupping: number; cash: number; qris: number; perDay: number | null; drivers: number; avgPrice: number | null };
  previous: { cups: number; value: number; drivers: number; waste: number; cupping: number };
  changes: Record<"cups" | "value" | "drivers" | "waste" | "cupping", Change>;
  trend: { day: string; cups: number; value: number; previousCups: number | null; previousValue: number | null }[];
  pools: (Row & { pool: string; name: string; previousCups: number })[];
  menus: (Row & { code: string; name: string; category: string | null })[];
  drivers: { code: string | null; name: string; poolName: string; cups: number; value: number; days: number }[];
};

const num = (v: number) => Math.round(v).toLocaleString("id-ID");
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const rpShort = (v: number) => (v >= 1e9 ? `Rp ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
  : v >= 1e6 ? `Rp ${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : rp(v));
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const range = (p: { from: string; to: string }) => (p.from === p.to ? dmy(p.from) : `${dmy(p.from)} – ${dmy(p.to)}`);

/** +12.3% / −4.0% with its direction; `inverse`: a rise is bad (waste) */
function Delta({ v, inverse = false }: { v: Change; inverse?: boolean }) {
  if (v == null) return <span className="text-[11px] text-neutral-400">—</span>;
  const up = v >= 0;
  const good = inverse ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${good ? "text-emerald-700" : "text-red-600"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : "−"}{Math.abs(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

function Tile({ icon, label, value, sub, delta }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tabular-nums text-neutral-900 sm:text-2xl">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">{delta}{sub}</div>
    </div>
  );
}

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Cups per day: the period in the brand blue, the comparison as a grey mark at its height (hover / tap for the figures). */
function Trend({ rows }: { rows: Data["trend"] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cups, r.previousCups ?? 0)));
  return (
    <div>
      <div className="flex h-44 items-end gap-1 sm:gap-1.5" role="img" aria-label={tr("Cups sold per day")}>
        {rows.map((r) => (
          <div key={r.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${dm(r.day)} · ${num(r.cups)} ${tr("cups")} · ${rp(r.value)}${r.previousCups != null ? ` · ${tr("comparison")} ${num(r.previousCups)}` : ""}`}>
            {r.previousCups != null && (
              <span className="absolute inset-x-0 border-t-2 border-neutral-300" style={{ bottom: `${(r.previousCups / max) * 100}%` }} aria-hidden />
            )}
            <span className="w-full rounded-t-[4px] bg-brand-600 transition-colors group-hover:bg-brand-800" style={{ height: `${Math.max(2, (r.cups / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 sm:gap-1.5">
        {rows.map((r, i) => (
          <span key={r.day} className="min-w-0 flex-1 text-center text-[10px] tabular-nums text-neutral-400">
            {rows.length <= 16 || i % Math.ceil(rows.length / 12) === 0 ? dm(r.day) : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />{tr("This period")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-neutral-300" />{tr("Comparison period")}</span>
      </div>
    </div>
  );
}

/** Ranked rows with a share bar (one hue). */
function Ranked({ rows, label }: { rows: { key: string; name: string; sub?: string; cups: number; value: number; share?: number | null; change?: Change }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.cups));
  if (!rows.length) return <p className="py-6 text-center text-sm text-neutral-400">{tr("No sales in this period")}</p>;
  return (
    <ul className="space-y-3" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate"><span className="mr-1.5 text-xs tabular-nums text-neutral-400">{i + 1}</span>
              <span className="font-medium text-neutral-900">{r.name}</span>{r.sub && <span className="ml-1.5 text-xs text-neutral-500">{r.sub}</span>}</span>
            <span className="flex flex-shrink-0 items-baseline gap-2 tabular-nums">
              <span className="font-semibold text-neutral-900">{num(r.cups)}</span>
              {r.change !== undefined && <Delta v={r.change ?? null} />}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(r.cups / max) * 100}%` }} /></div>
            <span className="w-24 flex-shrink-0 text-right text-[11px] tabular-nums text-neutral-500">{rpShort(r.value)}{r.share != null ? ` · ${Math.round(r.share * 100)}%` : ""}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CotrOverview({ from, to, compareFrom, compareTo }: { from: string; to: string; compareFrom?: string | null; compareTo?: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    const q = new URLSearchParams({ dateFrom: from, dateTo: to, ...(compareFrom && compareTo ? { compareFrom, compareTo } : {}) });
    fetch(`/api/cotr/overview?${q}`, { credentials: "same-origin" })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.detail || b.error || tr("Couldn’t load the data")); return b as Data; })
      .then((b) => { if (alive) setData(b); }).catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [from, to, compareFrom, compareTo]);

  if (error) return <div className="p-4 sm:p-6"><p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></div>;
  if (!data) {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-200/60" />)}
        <div className="h-64 animate-pulse rounded-xl bg-neutral-200/60 sm:col-span-2 xl:col-span-5" />
      </div>
    );
  }
  const s = data.summary;
  const pay = s.cash + s.qris;
  const qrisShare = pay ? s.qris / pay : 0;
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="text-xs text-neutral-500">{range(data.period)} · {tr("compared with {0}", range(data.compare))}</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Tile icon={<CupSoda size={15} />} label={tr("Cups Sold")} value={num(s.cups)} delta={<Delta v={data.changes.cups} />}
          sub={s.perDay != null ? tr("{0} / day", num(s.perDay)) : undefined} />
        <Tile icon={<Banknote size={15} />} label={tr("Sales Value")} value={rpShort(s.value)} delta={<Delta v={data.changes.value} />}
          sub={s.avgPrice != null ? tr("avg {0} / cup", rp(s.avgPrice)) : undefined} />
        <Tile icon={<Users size={15} />} label={tr("Active Drivers")} value={num(s.drivers)} delta={<Delta v={data.changes.drivers} />}
          sub={tr("{0} days with sales", s.days)} />
        <Tile icon={<QrCode size={15} />} label={tr("Cash / QRIS")} value={`${Math.round((1 - qrisShare) * 100)}% / ${Math.round(qrisShare * 100)}%`}
          sub={`${rpShort(s.cash)} · ${rpShort(s.qris)}`} />
        <Tile icon={<Trash2 size={15} />} label={tr("Waste · Cupping")} value={num(s.waste)}
          delta={<Delta v={data.changes.waste} inverse />} sub={tr("cupping {0}", num(s.cupping))} />
      </div>

      {data.trend.length > 1 && (
        <Card title={tr("Cups Sold per Day")} subtitle={tr("Every pool / HUB together; the grey line is the same day of the comparison period")}>
          <Trend rows={data.trend} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tr("Pools / HUBs")} subtitle={tr("Cups sold, value and share; change against the comparison period")}>
          <Ranked label={tr("Pools / HUBs")} rows={data.pools.map((p) => ({ key: p.pool, name: p.name, cups: p.cups, value: p.value, share: p.share, change: p.change }))} />
        </Card>
        <Card title={tr("Menus")} subtitle={tr("Cups sold per menu, value and share")}>
          <Ranked label={tr("Menus")} rows={data.menus.slice(0, 10).map((m) => ({ key: m.code, name: m.name, cups: m.cups, value: m.value, share: m.share, change: m.change }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={tr("Top Drivers")} subtitle={tr("Cups and value sold, from the app shifts or the workbooks")}>
          {data.drivers.length === 0 ? <p className="py-6 text-center text-sm text-neutral-400">{tr("No sales in this period")}</p> : (
            <ol className="divide-y divide-neutral-100">
              {data.drivers.map((d, i) => (
                <li key={`${d.code ?? d.name}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-5 flex-shrink-0 text-xs tabular-nums text-neutral-400">{i + 1}</span>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Bike size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-neutral-900">{d.name}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{d.poolName} · {tr("{0} days", d.days)}</span></span>
                  <span className="flex-shrink-0 text-right tabular-nums"><span className="block font-semibold text-neutral-900">{num(d.cups)}</span>
                    <span className="block text-[11px] text-neutral-500">{rpShort(d.value)}</span></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title={tr("Payments")} subtitle={tr("Cash and QRIS of the drivers' days")}>
          {pay === 0 ? <p className="py-6 text-center text-sm text-neutral-400">{tr("No payments in this period")}</p> : (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100" role="img" aria-label={tr("Cash / QRIS")}>
                <div className="h-full bg-brand-600" style={{ width: `${(1 - qrisShare) * 100}%` }} />
                <div className="h-full border-l-2 border-white bg-brand-300" style={{ width: `${qrisShare * 100}%` }} />
              </div>
              {[[tr("Cash"), s.cash, 1 - qrisShare, "bg-brand-600", <Banknote key="c" size={15} />], [tr("QRIS"), s.qris, qrisShare, "bg-brand-300", <QrCode key="q" size={15} />]].map(([label, v, share, dot, icon]) => (
                <div key={label as string} className="flex items-center gap-3 text-sm">
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-sm ${dot as string}`} />
                  <span className="flex flex-1 items-center gap-1.5 text-neutral-700">{icon as ReactNode}{label as string}</span>
                  <span className="tabular-nums font-semibold text-neutral-900">{rpShort(v as number)}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-neutral-500">{Math.round((share as number) * 100)}%</span>
                </div>
              ))}
              <p className="flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-500"><Store size={13} />{tr("{0} pools / HUBs with sales", data.pools.filter((p) => p.cups).length)}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
