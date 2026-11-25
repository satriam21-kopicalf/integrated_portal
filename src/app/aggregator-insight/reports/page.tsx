"use client";

// Aggregator Insight → Reports (page agg.reports, 2026-11-25): everything of a period as one Excel — a summary first, then
// per outlet, the low reviews and their topics, the complaints and the voids with their reasons. Each sheet can be looked at here.

import { useEffect, useState } from "react";
import { FileBarChart } from "lucide-react";
import { ErrorState, cx, useToast } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { type Sheet, downloadSheets } from "@/aggregator/ui";
import { DataTable, FilterBar, FreshLine, useCtx, useFilters, type Col } from "@/aggregator/kit";
import { fmtDay, fmtPeriod, nf } from "@/aggregator/time";

type Res = { from: string; to: string; summary: [string, number | null][]; sheets: Sheet[] };
type R = { id: string; v: (string | number | null)[] };
const cell = (v: string | number | null) => (v == null || v === "" ? "—" : typeof v === "number" ? nf(v, 2) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDay(v) : v);

export default function Reports() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Summary");
  const [q, setQ] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/report?${a.query}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query, version]);
  const excel = async () => {
    if (!data) return;
    setBusy(true);
    try { await downloadSheets(`Aggregator ${data.from} - ${data.to}${a.f.platform ? ` ${a.f.platform}` : ""}`, data.sheets); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const sheet = data?.sheets.find((s) => s.sheet === tab) ?? data?.sheets[0];
  const t = q.trim().toLowerCase();
  const rows: R[] = (sheet?.rows ?? []).map((v, i) => ({ id: String(i), v })).filter((r) => !t || r.v.some((x) => String(x ?? "").toLowerCase().includes(t)));
  const cols: Col<R>[] = (sheet?.header ?? []).map((h, i) => {
    const num = (sheet?.rows ?? []).some((r) => typeof r[i] === "number") && !(sheet?.rows ?? []).some((r) => typeof r[i] === "string" && r[i] !== "");
    return { key: String(i), label: h, card: i === 0 ? "title" as const : (sheet?.header.length ?? 0) === 2 ? "side" as const : undefined, sort: (r) => r.v[i], first: num ? "desc" : "asc", right: num, className: cx("max-w-[26rem]", i === 0 && "font-medium text-neutral-900"), render: (r) => cell(r.v[i]) };
  });
  const filter = (
    <FilterBar a={a} ctx={ctx} outlet={false} q={q} onQ={setQ} placeholder={tr("Search in this sheet")} excel={() => void excel()} excelOff={!data} excelBusy={busy} />
  );
  const card = <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white">{filter}</section>;
  return (
    <Page title={tr("Reports")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The whole period in one Excel, a summary sheet first")} media={<FileBarChart size={19} />}>
      <FreshLine ctx={ctx} sources={["status", "reviews", "daily"]} />
      {err ? <>{card}<ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /></> : (
        <WorkCard<string> active={sheet?.sheet ?? "Summary"} onTab={(k) => { setTab(k); setQ(""); }} label={tr("Sheets in the Excel")} tabs={(data?.sheets ?? [{ sheet: "Summary", rows: [] }]).map((s) => ({ key: s.sheet, label: s.sheet, count: data ? s.rows.length : null }))}>
          {filter}
          <DataTable key={sheet?.sheet} cols={cols.length ? cols : [{ key: "0", label: "", render: () => null }]} rows={rows} loading={!data} rowKey={(r) => r.id} resetKey={`${a.query}${tab}${t}`} minWidth={cols.length > 3 ? cols.length * 125 : 420}
            note={<>{fmtPeriod(a.f.from, a.f.to)}{a.f.platform ? ` · ${a.f.platform}` : ""} · {tr("Opening figures are limits: on time at least, late at most (BotFood sees an opening late).")}</>} />
        </WorkCard>
      )}
    </Page>
  );
}
