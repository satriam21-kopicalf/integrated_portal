"use client";

// Waste Monitor → Analysis (2026-11-10): what the period says rather than the list to review — the value wasted per day,
// the items and branches that weigh most, the categories and types, and what needs a look (no price, waiting review,
// rejected). Read from the same data as the other tabs (rejected entries left out of the values).

import { AlertTriangle, CalendarDays, Layers, Package, Store, Tags } from "lucide-react";
import { useMemo } from "react";
import { Empty, cx, fmtNumber } from "@/so/ui";
import { Skeleton } from "@/components/kc/Skeleton";
import { dmy } from "@/so/ui/Filters";
import { tr } from "@/lib/i18n";
import { type MonitorData, type Scope, fmtRp, scopeLabel } from "./waste";

const day = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function WasteAnalysis({ res, onBranch, onItem }: { res: MonitorData | null; onBranch: (code: string) => void; onItem: (name: string) => void }) {
  const a = useMemo(() => {
    if (!res) return null;
    const kept = res.data.filter((e) => e.status !== "rejected");
    // value per day over the whole period (a day without waste stays at 0)
    const perDay = new Map<string, number>();
    for (let d = day(res.period.from); d <= day(res.period.to); d.setDate(d.getDate() + 1)) perDay.set(iso(d), 0);
    for (const e of kept) perDay.set(e.businessDate, (perDay.get(e.businessDate) ?? 0) + (e.value ?? 0));
    const days = [...perDay.entries()];
    const total = days.reduce((s, [, v]) => s + v, 0);
    const peak = days.reduce((m, d) => (d[1] > m[1] ? d : m), ["", 0] as [string, number]);
    const byScope = new Map<Scope, { value: number; entries: number }>();
    for (const e of kept) {
      const x = byScope.get(e.scope) ?? { value: 0, entries: 0 };
      x.value += e.value ?? 0; x.entries += 1;
      byScope.set(e.scope, x);
    }
    const unpriced = kept.filter((e) => e.value == null).length;
    const waiting = res.data.filter((e) => e.status === "submitted" || e.status === "investigating");
    const oldest = waiting.reduce<string | null>((m, e) => (!m || e.businessDate < m ? e.businessDate : m), null);
    return {
      days, total, peak, avg: days.length ? total / days.length : 0,
      items: [...res.byItem].sort((x, y) => (y.value ?? 0) - (x.value ?? 0)).slice(0, 5),
      branches: [...res.byBranch].sort((x, y) => (y.value ?? 0) - (x.value ?? 0)).slice(0, 5),
      categories: [...res.byCategory].sort((x, y) => y.entries - x.entries).slice(0, 6),
      scopes: [...byScope.entries()].sort((x, y) => y[1].value - x[1].value),
      unpriced, waiting: waiting.length, oldest, rejected: res.summary.rejected, entries: res.summary.entries,
      waitingBranches: res.byBranch.filter((b) => b.submitted > 0).length,
    };
  }, [res]);

  if (!a) return <AnalysisSkeleton />;
  if (!res?.data.length) return <Empty title={tr("No waste in this period")} />;
  const max = Math.max(1, ...a.days.map(([, v]) => v));
  const itemMax = Math.max(1, ...a.items.map((i) => i.value ?? 0));
  const branchMax = Math.max(1, ...a.branches.map((b) => b.value ?? 0));
  const catMax = Math.max(1, ...a.categories.map((c) => c.entries));
  const scopeMax = Math.max(1, ...a.scopes.map(([, s]) => s.value));
  const checks = [
    a.waiting > 0 && { tone: "amber", text: tr("{0} entries of {1} branches still wait for review", fmtNumber(a.waiting), fmtNumber(a.waitingBranches))
      + (a.oldest ? ` · ${tr("the oldest from {0}", dmy(a.oldest))}` : "") },
    a.unpriced > 0 && { tone: "amber", text: tr("{0} entries have no price: their value is not counted (set it in List & Pricelist Items)", fmtNumber(a.unpriced)) },
    a.rejected > 0 && { tone: "slate", text: tr("{0} of {1} entries rejected ({2}%)", fmtNumber(a.rejected), fmtNumber(a.entries), ((a.rejected / Math.max(1, a.entries)) * 100).toFixed(1)) },
  ].filter(Boolean) as { tone: "amber" | "slate"; text: string }[];

  return (
    <div className="space-y-5 p-4 sm:p-5">
      {/* the value wasted per day */}
      <section>
        <Head icon={<CalendarDays size={15} />} title={tr("Waste value per day")}
          aside={<>{tr("Average {0} a day", fmtRp(a.avg))}{a.peak[1] > 0 && <> · {tr("highest {0} on {1}", fmtRp(a.peak[1]), dmy(a.peak[0]))}</>}</>} />
        <div className="flex h-40 items-end gap-1 rounded-xl border border-neutral-200 bg-white px-3 pb-2 pt-4" role="img"
          aria-label={tr("Waste value per day")}>
          {a.days.map(([d, v]) => (
            <div key={d} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dmy(d)} · ${fmtRp(v)}`}>
              <span className={cx("block w-full rounded-t-[4px] transition-colors", v ? "bg-brand-500 group-hover:bg-brand-700" : "bg-neutral-100")}
                style={{ height: `${v ? Math.max(4, (v / max) * 100) : 2}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-400"><span>{dmy(a.days[0][0])}</span><span>{dmy(a.days[a.days.length - 1][0])}</span></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <Head icon={<Package size={15} />} title={tr("Top items by value")} />
          <Bars rows={a.items.map((i) => ({ key: `${i.scope}:${i.code}`, label: i.name, sub: `${fmtNumber(i.entries)} ${tr("entries")} · ${fmtNumber(i.branches)} ${tr("branches")}`,
            value: i.value ?? 0, text: i.value == null ? tr("No price") : fmtRp(i.value), onClick: () => onItem(i.name) }))} max={itemMax} total={a.total} />
        </section>
        <section>
          <Head icon={<Store size={15} />} title={tr("Top branches by value")} />
          <Bars rows={a.branches.map((b) => ({ key: b.code, label: b.name, sub: `${fmtNumber(b.entries)} ${tr("entries")} · ${fmtNumber(b.days)} ${tr("days with waste")}`,
            value: b.value ?? 0, text: fmtRp(b.value ?? 0), onClick: () => onBranch(b.code) }))} max={branchMax} total={a.total} />
        </section>
        <section>
          <Head icon={<Tags size={15} />} title={tr("Categories")} aside={tr("entries")} />
          <Bars rows={a.categories.map((c) => ({ key: c.name, label: c.name || "—", value: c.entries, text: fmtNumber(c.entries) }))} max={catMax} />
        </section>
        <section>
          <Head icon={<Layers size={15} />} title={tr("Per type")} />
          <Bars rows={a.scopes.map(([s, x]) => ({ key: s, label: scopeLabel(s), sub: `${fmtNumber(x.entries)} ${tr("entries")}`, value: x.value, text: fmtRp(x.value) }))}
            max={scopeMax} total={a.total} />
        </section>
      </div>

      {checks.length > 0 && (
        <section>
          <Head icon={<AlertTriangle size={15} />} title={tr("To check")} />
          <ul className="space-y-1.5">
            {checks.map((c, i) => (
              <li key={i} className={cx("flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset",
                c.tone === "amber" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-neutral-50 text-neutral-700 ring-neutral-200")}>
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />{c.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Head({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><span className="text-neutral-400">{icon}</span>{title}</h3>
      {aside && <span className="text-xs text-neutral-500">{aside}</span>}
    </div>
  );
}

/** Horizontal bars, the label and figure in text colours (the bar carries the size only). */
function Bars({ rows, max, total }: { rows: { key: string; label: string; sub?: string; value: number; text: string; onClick?: () => void }[]; max: number; total?: number }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">—</p>;
  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {rows.map((r) => {
        const Tag = r.onClick ? "button" : "div";
        return (
          <li key={r.key}>
            <Tag {...(r.onClick ? { type: "button" as const, onClick: r.onClick } : {})}
              className={cx("block w-full px-3 py-2.5 text-left", r.onClick && "hover:bg-neutral-50")}>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-neutral-800">{r.label}</span>
                <span className="flex-shrink-0 tabular-nums text-neutral-900">{r.text}
                  {total ? <span className="ml-1.5 text-xs text-neutral-400">{((r.value / Math.max(1, total)) * 100).toFixed(1)}%</span> : null}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
              </span>
              {r.sub && <span className="mt-1 block text-[11px] text-neutral-400">{r.sub}</span>}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

/** The Analysis tab while loading: the day bars, then two columns of bar lists. */
function AnalysisSkeleton() {
  return (
    <div className="space-y-5 p-4 sm:p-5" role="status" aria-label={tr("Loading…")}>
      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-3.5 w-48" />
        <div className="flex h-40 items-end gap-1 rounded-xl border border-neutral-200 px-3 pb-2 pt-4">
          {[40, 65, 30, 80, 55, 70, 45].map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-[4px] rounded-b-none" style={{ height: `${h}%` }} />)}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {[0, 1, 2].map((r) => <div key={r} className="space-y-2 px-3 py-3"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-1.5 w-full rounded-full" /></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
