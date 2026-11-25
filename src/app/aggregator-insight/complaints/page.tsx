"use client";

// Aggregator Insight → Complaints (page agg.complaints, 2026-11-25): the tickets of the team, from a low review or entered
// by hand (chat, app), with the first response, the resolution and the compensation. Open ones always stay in the list.

import { useCallback, useEffect, useState } from "react";
import { Download, MessageSquareText, Plus, Save } from "lucide-react";
import { Button, ErrorState, Field, Input, SearchBox, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { JSelect, Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { downloadSheets } from "@/aggregator/ui";
import { DataTable, FilterBar, FreshLine, OutletCell, PLATFORMS, Platform, noMembers, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { ago, daysAgo, fmtDay, fmtPeriod, fmtSpan, fmtStamp, nf, rp, xlStamp } from "@/aggregator/time";

type Status = "open" | "progress" | "done";
type Row = { id: number; reviewId: string | null; branchCode: string | null; outlet: string; platform: string; orderNo: string | null; day: string; source: string; category: string; detail: string;
  status: Status; resolution: string | null; compensation: number | null; createdAt: string; createdBy: string | null; firstResponseAt: string | null; resolvedAt: string | null; responseMin: number | null; resolveMin: number | null; handledBy: string | null; member: string | null };
type Res = { summary: { n: number; open: number; progress: number; done: number; responseMedian: number | null; resolveMedian: number | null; compensation: number };
  categories: { category: string; n: number }[]; topics: string[]; outlets: { code: string; name: string }[]; data: Row[] };
const TONE: Record<Status, LozengeTone> = { open: "red", progress: "amber", done: "green" };
const LABEL: Record<Status, () => string> = { open: () => tr("Open"), progress: () => tr("In Progress"), done: () => tr("Done") };
const SOURCE: Record<string, () => string> = { review: () => tr("Review"), chat: () => tr("Chat"), app: () => tr("Delivery app"), other: () => tr("Other") };
const median = (v: number[]) => { if (!v.length) return null; const x = [...v].sort((a, b) => a - b), m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };

export default function Complaints() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [only, setOnly] = useState<Status | "all">("open");
  const [cat, setCat] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { setErr(null); call<Res>(`/api/aggregator/complaints?${a.query}`).then(setData).catch((e: Error) => setErr(e.message)); }, [a.query]);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/complaints?${a.query}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query]);
  const t = q.trim().toLowerCase();
  const scoped = useScope(data?.data, a.f, ctx).filter((r) => (!cat || r.category === cat) && (!source || r.source === source));
  const rows = scoped.filter((r) => (only === "all" || r.status === only) && (!t || `${r.id} ${r.outlet} ${r.detail} ${r.orderNo ?? ""} ${r.category} ${r.member ?? ""}`.toLowerCase().includes(t)));
  const n = (k: Status) => scoped.filter((r) => r.status === k).length;
  const resp = median(scoped.flatMap((r) => (r.responseMin == null ? [] : [r.responseMin]))), reso = median(scoped.flatMap((r) => (r.resolveMin == null ? [] : [r.resolveMin])));
  const comp = scoped.reduce((x, r) => x + (r.compensation ?? 0), 0);
  const ok = !!data;
  const cols: Col<Row>[] = [
    { key: "id", label: "#", sort: (r) => r.id, first: "desc", className: "font-semibold text-brand-700", render: (r) => r.id },
    { key: "day", label: tr("Date"), sort: (r) => r.day, first: "desc", className: "whitespace-nowrap", render: (r) => <>{fmtDay(r.day)}<span className="block text-[11px] text-neutral-400" title={fmtStamp(r.createdAt)}>{tr("ticket {0}", ago(r.createdAt))}</span></> },
    { key: "outlet", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "detail", label: tr("Complaint"), className: "max-w-[26rem]", render: (r) => <><span className="line-clamp-3 text-neutral-900">{r.detail}</span><span className="block text-[11px] text-neutral-500">{r.category} · {SOURCE[r.source]?.() ?? r.source}{r.orderNo ? ` · ${r.orderNo}` : ""}</span>{r.resolution && <span className="block text-[11px] text-emerald-700">{r.resolution}</span>}</> },
    { key: "status", label: tr("Status"), sort: (r) => ["open", "progress", "done"].indexOf(r.status), render: (r) => <Lozenge tone={TONE[r.status]}>{LABEL[r.status]()}</Lozenge> },
    { key: "resp", label: tr("First response"), sort: (r) => r.responseMin, right: true, className: "whitespace-nowrap", render: (r) => r.responseMin != null ? fmtSpan(r.responseMin) : <span className="text-red-700">{tr("waiting {0}", fmtSpan((Date.now() - new Date(r.createdAt).getTime()) / 60000))}</span> },
    { key: "reso", label: tr("Resolved in"), sort: (r) => r.resolveMin, right: true, className: "whitespace-nowrap", render: (r) => fmtSpan(r.resolveMin) },
    { key: "comp", label: tr("Compensation"), sort: (r) => r.compensation, first: "desc", right: true, hide: !scoped.some((r) => r.compensation), className: "whitespace-nowrap", render: (r) => rp(r.compensation) },
    { key: "member", label: tr("On duty"), sort: (r) => r.member, hide: noMembers(scoped), render: (r) => r.member ?? "—" },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Complaints ${a.f.from} - ${a.f.to}`, [
        { sheet: "Summary", title: `Complaints · ${fmtPeriod(a.f.from, a.f.to)} · WIB`, header: [tr("Measure"), tr("Value")], rows: [[tr("Complaints"), scoped.length], [tr("Open"), n("open")], [tr("In Progress"), n("progress")], [tr("Done"), n("done")],
          [tr("Median first response (min)"), resp], [tr("Median resolution (min)"), reso], [tr("Compensation"), comp]] },
        { sheet: "Data", header: ["#", tr("Date"), tr("Ticket made (WIB)"), tr("Outlet"), tr("Platform"), tr("Order no."), tr("Source"), tr("Category"), tr("Complaint"), tr("Status"), tr("Resolution"), tr("Compensation"), tr("Response (min)"), tr("Resolved (min)"), tr("Handled by"), tr("On duty")],
          rows: rows.map((r) => [r.id, r.day, xlStamp(r.createdAt), r.outlet, r.platform, r.orderNo, SOURCE[r.source]?.() ?? r.source, r.category, r.detail, LABEL[r.status](), r.resolution, r.compensation, r.responseMin, r.resolveMin, r.handledBy, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Page title={tr("Complaints")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Tickets from low reviews, chat and the delivery apps, with response and resolution times")} media={<MessageSquareText size={19} />}
      actions={<><Button variant="secondary" size="sm" disabled={!data} onClick={() => void exportXlsx()}><Download size={14} /> {tr("Excel")}</Button><Button size="sm" onClick={() => setAdding(true)} disabled={!data}><Plus size={14} /> {tr("New complaint")}</Button></>}>
      <FreshLine ctx={ctx} sources={["reviews"]} />
      <FilterBar a={a} ctx={ctx} extra={[{ key: "cat", label: tr("Category"), value: cat, onChange: setCat, options: (data?.topics ?? []).map((c) => ({ value: c, label: c })) },
        { key: "source", label: tr("Source"), value: source, onChange: setSource, options: Object.entries(SOURCE).map(([value, l]) => ({ value, label: l() })) }]} />
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <>
          <StatStrip columns={4} label={tr("Complaints")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Open")} value={ok ? nf(n("open")) : <StatSkeleton />}>{ok && <p>{tr("{0} in progress", n("progress"))}</p>}</Stat>
            <Stat label={tr("Done")} value={ok ? nf(n("done")) : <StatSkeleton />} />
            <Stat label={tr("Median first response")} value={ok ? fmtSpan(resp) : <StatSkeleton />}>{reso != null && <p>{tr("resolved in {0}", fmtSpan(reso))}</p>}</Stat>
            <Stat label={tr("Compensation")} value={ok ? rp(comp) : <StatSkeleton />} />
          </StatStrip>
          <WorkCard tabs={[{ key: "list", label: tr("Tickets"), count: ok ? scoped.length : null }]} active="list" onTab={() => {}}>
            <Toolbar><div className="flex flex-wrap items-center gap-2"><div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet, order or complaint")} /></div>
              <QuickChips<Status | "all"> value={only} onChange={setOnly} label={tr("Status")} items={[{ key: "open", label: LABEL.open(), dot: "bg-red-500", count: n("open") }, { key: "progress", label: LABEL.progress(), dot: "bg-amber-400", count: n("progress") }, { key: "done", label: LABEL.done(), dot: "bg-emerald-500", count: n("done") }, { key: "all", label: tr("All"), count: scoped.length }]} /></div></Toolbar>
            <DataTable cols={cols} rows={rows} loading={!data} rowKey={(r) => String(r.id)} resetKey={`${a.query}${a.f.outlet}${a.f.group}${only}${cat}${source}${t}`} initial={{ key: "id", dir: "desc" }} minWidth={1020} onRow={setEdit} empty={tr("No complaint here")} note={tr("Tickets not done yet stay in the list whatever the period.")} />
          </WorkCard>
        </>
      )}
      {edit && data && <Edit key={edit.id} row={edit} topics={data.topics} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {adding && data && <Add res={data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </Page>
  );
}

/** when the ticket was made, first answered and closed */
function Timeline({ row }: { row: Row }) {
  const steps = [[tr("Made"), row.createdAt, row.createdBy], [tr("First response"), row.firstResponseAt, fmtSpan(row.responseMin)], [tr("Done"), row.resolvedAt, fmtSpan(row.resolveMin)]] as const;
  return <dl className="grid gap-2 text-xs sm:grid-cols-3">{steps.map(([l, at, sub]) => <div key={l} className="rounded-lg border border-neutral-200 px-3 py-2"><dt className="font-semibold text-neutral-500">{l}</dt><dd className="mt-0.5 text-neutral-900">{fmtStamp(at)}</dd>{at && sub && <dd className="text-neutral-500">{sub}</dd>}</div>)}</dl>;
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
    <Drawer open onClose={onClose} icon={<MessageSquareText size={18} />} title={tr("Complaint #{0}", row.id)} description={`${row.outlet} · ${row.platform} · ${fmtDay(row.day)}${row.orderNo ? ` · ${row.orderNo}` : ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={status === "done" && !resolution.trim()} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Timeline row={row} />
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
