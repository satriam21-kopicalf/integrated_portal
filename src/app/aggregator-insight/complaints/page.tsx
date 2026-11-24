"use client";

// Aggregator Insight → Complaints (page agg.complaints, 2026-11-25): the tickets of the team, from a low review or entered
// by hand (chat, app), with the first response, the resolution and the compensation. Open ones always stay in the list.

import { useEffect, useMemo, useState } from "react";
import { Download, MessageSquareText, Plus, Save } from "lucide-react";
import { Button, ErrorState, Field, Input, SearchBox, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { JSelect, Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard, jHeadRow, jRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PLATFORMS, PeriodBar, daysAgo, downloadSheets, hours } from "@/aggregator/ui";

type Status = "open" | "progress" | "done";
type Row = { id: number; reviewId: string | null; branchCode: string | null; outlet: string; platform: string; orderNo: string | null; day: string; source: string; category: string; detail: string;
  status: Status; resolution: string | null; compensation: number | null; createdAt: string; createdBy: string | null; responseMin: number | null; resolveMin: number | null; handledBy: string | null; member: string | null };
type Res = { summary: { n: number; open: number; progress: number; done: number; responseMedian: number | null; resolveMedian: number | null; compensation: number };
  categories: { category: string; n: number }[]; topics: string[]; outlets: { code: string; name: string }[]; data: Row[] };
const TONE: Record<Status, LozengeTone> = { open: "red", progress: "amber", done: "green" };
const LABEL: Record<Status, () => string> = { open: () => tr("Open"), progress: () => tr("In Progress"), done: () => tr("Done") };
const SOURCE: Record<string, () => string> = { review: () => tr("Review"), chat: () => tr("Chat"), app: () => tr("Delivery app"), other: () => tr("Other") };
const rp = (v: number | null) => (v == null ? "—" : `Rp ${v.toLocaleString("id-ID")}`);
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export default function Complaints() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [only, setOnly] = useState<Status | "all">("open");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const load = () => {
    setErr(null);
    call<Res>(`/api/aggregator/complaints?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform]);
  const t = q.trim().toLowerCase();
  const rows = useMemo(() => (data?.data ?? []).filter((r) => (only === "all" || r.status === only) && (!t || `${r.id} ${r.outlet} ${r.detail} ${r.orderNo ?? ""} ${r.category} ${r.member ?? ""}`.toLowerCase().includes(t))), [data, only, t]);
  const s = data?.summary;
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Complaints ${from} - ${to}`, [
        { sheet: "Summary", title: `Complaints ${from} – ${to}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Complaints"), data.summary.n], [tr("Open"), data.summary.open], [tr("In Progress"), data.summary.progress], [tr("Done"), data.summary.done],
          [tr("Median first response (min)"), data.summary.responseMedian], [tr("Median resolution (min)"), data.summary.resolveMedian], [tr("Compensation"), data.summary.compensation], ...data.categories.map((c) => [c.category, c.n])] },
        { sheet: "Data", header: ["#", tr("Date"), tr("Outlet"), tr("Platform"), tr("Order no."), tr("Source"), tr("Category"), tr("Complaint"), tr("Status"), tr("Resolution"), tr("Compensation"), tr("Response (min)"), tr("Resolved (min)"), tr("Handled by"), tr("On duty")],
          rows: data.data.map((r) => [r.id, r.day, r.outlet, r.platform, r.orderNo, SOURCE[r.source]?.() ?? r.source, r.category, r.detail, LABEL[r.status](), r.resolution, r.compensation, r.responseMin, r.resolveMin, r.handledBy, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Page title={tr("Complaints")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Tickets from low reviews, chat and the delivery apps, with response and resolution times")} media={<MessageSquareText size={19} />}
      actions={<div className="flex gap-2"><Button size="sm" onClick={() => setAdding(true)} disabled={!data}><Plus size={14} /> {tr("New complaint")}</Button>
        <Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button></div>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={4} label={tr("Complaints")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Open")} value={s ? s.open : <StatSkeleton />}>{s && <p>{tr("{0} in progress", s.progress)}</p>}</Stat>
            <Stat label={tr("Done")} value={s ? s.done : <StatSkeleton />} />
            <Stat label={tr("Median first response")} value={s ? (s.responseMedian == null ? "—" : hours(s.responseMedian)) : <StatSkeleton />}>{s?.resolveMedian != null && <p>{tr("resolved in {0}", hours(s.resolveMedian))}</p>}</Stat>
            <Stat label={tr("Compensation")} value={s ? rp(s.compensation) : <StatSkeleton />} />
          </StatStrip>
          <WorkCard tabs={[{ key: "list", label: tr("Tickets"), count: data?.data.length ?? null }]} active="list" onTab={() => {}}
            left={<PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />}>
            <Toolbar>
              <div className="flex flex-1 flex-wrap items-center gap-2"><div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet, order or complaint")} /></div>
                <QuickChips value={only} onChange={setOnly} label={tr("Status")} items={[{ key: "open", label: LABEL.open(), count: s?.open ?? null }, { key: "progress", label: LABEL.progress(), count: s?.progress ?? null }, { key: "done", label: LABEL.done(), count: s?.done ?? null }, { key: "all", label: tr("All") }]} /></div>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className={cx(jTable, "min-w-[860px]")}>
                <thead><tr className={jHeadRow}>{["#", tr("Date"), tr("Outlet"), tr("Platform"), tr("Complaint"), tr("Status"), tr("Response"), tr("On duty")].map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                <tbody>
                  {!data ? <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">…</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("No complaint here")}</td></tr>
                    : rows.slice(0, 500).map((r) => (
                      <tr key={r.id} className={cx(jRow, "align-top")} onClick={() => setEdit(r)}>
                        <td className={cx(jTd, "font-semibold text-brand-700")}>{r.id}</td><td className={cx(jTd, "whitespace-nowrap")}>{dm(r.day)}</td><td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td>
                        <td className={cx(jTd, "max-w-[26rem]")}><span className="block text-neutral-900">{r.detail}</span><span className="block text-[11px] text-neutral-500">{r.category} · {SOURCE[r.source]?.() ?? r.source}{r.orderNo ? ` · ${r.orderNo}` : ""}</span>
                          {r.resolution && <span className="block text-[11px] text-emerald-700">{r.resolution}</span>}</td>
                        <td className={jTd}><Lozenge tone={TONE[r.status]}>{LABEL[r.status]()}</Lozenge></td>
                        <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{r.responseMin != null ? hours(r.responseMin) : "—"}</td><td className={cx(jTd, "text-neutral-600")}>{r.member ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </WorkCard>
        </div>
      )}
      {edit && data && <Edit key={edit.id} row={edit} topics={data.topics} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {adding && data && <Add res={data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </Page>
  );
}

function Edit({ row, topics, onClose, onSaved }: { row: Row; topics: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>(row.status === "open" ? "progress" : row.status);
  const [category, setCategory] = useState(row.category);
  const [resolution, setResolution] = useState(row.resolution ?? "");
  const [comp, setComp] = useState(row.compensation != null ? String(row.compensation) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await call(`/api/aggregator/complaints/${row.id}`, { method: "PATCH", json: { status, category, resolution: resolution.trim() || null, compensation: comp ? Number(comp) : null } }); toast(tr("Saved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<MessageSquareText size={18} />} title={tr("Complaint #{0}", row.id)} description={`${row.outlet} · ${row.platform} · ${dm(row.day)}${row.orderNo ? ` · ${row.orderNo}` : ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={status === "done" && !resolution.trim()} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <p className="whitespace-pre-line rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-800">{row.detail}</p>
        <Field label={tr("Status")}><JSelect placeholder={tr("Status")} value={status} onChange={(v) => setStatus(v as Status)} options={(["open", "progress", "done"] as Status[]).map((s) => ({ value: s, label: LABEL[s]() }))} /></Field>
        <Field label={tr("Category")}><JSelect placeholder={tr("Category")} value={category} onChange={setCategory} options={[...new Set([...topics, category])].map((c) => ({ value: c, label: c }))} /></Field>
        <Field label={tr("Resolution")} hint={tr("Required to close the ticket")}><textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} maxLength={2000} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
        <Field label={tr("Compensation (Rp)")}><Input inputMode="numeric" value={comp} onChange={(e) => setComp(e.target.value.replace(/\D/g, ""))} /></Field>
      </div>
    </Drawer>
  );
}

function Add({ res, onClose, onSaved }: { res: Res; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ branchCode: "", platform: "", orderNo: "", day: daysAgo(0), source: "chat", category: "", detail: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await call("/api/aggregator/complaints", { method: "POST", json: { ...f, category: f.category || null } }); toast(tr("Saved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Plus size={18} />} title={tr("New complaint")} description={tr("A complaint from chat or a delivery app that is not a review")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!f.branchCode || !f.platform || !f.detail.trim()} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Outlet")}><JSelect value={f.branchCode} onChange={(v) => setF({ ...f, branchCode: v })} placeholder={tr("Choose the outlet")} options={res.outlets.map((o) => ({ value: o.code, label: o.name }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Platform")}><JSelect value={f.platform} onChange={(v) => setF({ ...f, platform: v })} placeholder={tr("Choose")} options={PLATFORMS.map((p) => ({ value: p, label: p }))} /></Field>
          <Field label={tr("Source")}><JSelect placeholder={tr("Source")} value={f.source} onChange={(v) => setF({ ...f, source: v })} options={["chat", "app", "other"].map((s) => ({ value: s, label: SOURCE[s]() }))} /></Field>
          <Field label={tr("Date")}><Input type="date" value={f.day} max={daysAgo(0)} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          <Field label={tr("Order no.")}><Input value={f.orderNo} maxLength={60} onChange={(e) => setF({ ...f, orderNo: e.target.value })} /></Field>
        </div>
        <Field label={tr("Category")}><JSelect value={f.category} onChange={(v) => setF({ ...f, category: v })} placeholder={tr("Read from the words")} options={res.topics.map((c) => ({ value: c, label: c }))} /></Field>
        <Field label={tr("Complaint")}><textarea value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} rows={4} maxLength={2000} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
      </div>
    </Drawer>
  );
}
