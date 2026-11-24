"use client";

// Aggregator Insight → Reports (page agg.reports, 2026-11-25): everything of a period as one Excel — a summary first, then
// per outlet, the low reviews and their topics, the complaints and the voids with their reasons.

import { useEffect, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { Button, ErrorState, useToast } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { type Sheet, PeriodBar, daysAgo, downloadSheets } from "@/aggregator/ui";

type Res = { from: string; to: string; summary: [string, number | null][]; sheets: Sheet[] };

export default function Reports() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(daysAgo(1));
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/report?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform]);
  const excel = async () => {
    if (!data) return;
    setBusy(true);
    try { await downloadSheets(`Aggregator ${data.from} - ${data.to}${platform ? ` ${platform}` : ""}`, data.sheets); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Page title={tr("Reports")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The whole period in one Excel, a summary sheet first")} media={<FileBarChart size={19} />}
      actions={<Button size="sm" disabled={!data} loading={busy} onClick={() => void excel()}><Download size={14} /> {tr("Excel")}</Button>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title={tr("Summary")} description={`${from} – ${to}${platform ? ` · ${platform}` : ""}`}>
              {!data ? <p className="px-4 py-8 text-center text-sm text-neutral-500">{tr("Working it out …")}</p> : (
                <dl className="divide-y divide-neutral-100 text-sm">{data.summary.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 px-4 py-2"><dt className="text-neutral-600">{k}</dt><dd className="font-semibold tabular-nums text-neutral-900">{v == null ? "—" : v.toLocaleString("id-ID")}</dd></div>)}</dl>
              )}
            </Panel>
            <Panel title={tr("Sheets in the Excel")} description={tr("Opening figures are limits: on time at least, late at most (BotFood sees an opening late).")}>
              {data && <ul className="divide-y divide-neutral-100 text-sm">{data.sheets.map((s) => <li key={s.sheet} className="flex items-center justify-between px-4 py-2"><span className="text-neutral-800">{s.sheet}</span><span className="tabular-nums text-neutral-500">{tr("{0} rows", s.rows.length.toLocaleString("id-ID"))}</span></li>)}</ul>}
            </Panel>
          </div>
        </div>
      )}
    </Page>
  );
}
