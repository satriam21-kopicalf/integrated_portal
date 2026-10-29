"use client";

// Form → Pengajuan (Form Fund, page form.pengajuan; the outlet accounts in Operations), approved by management in the
// portal along the steps set per kind. Two doors: the weekly petty cash (baristas, period, opening balance with the
// previous closing balance suggested, money in with its proof, every expense with its receipt, the closing balance and
// the top-up up to the plafon; no request, no transfer) and the budget requests (emergency purchase, marketing, event,
// bills: purpose, date needed, the lines with their estimate or receipt). Every kind: who submits it (barista / PIC,
// phone) and the bank account. The draft is saved as it is filled; what is still missing is listed above the Send button.
// A request sent back for a revision opens here again with the notes. Mobile first.

import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, CloudUpload, Loader2, Paperclip, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { FormCard, Segmented } from "@/so/ui/Simple";
import LiveClock from "@/so/ui/LiveClock";
import { useFocusMode } from "@/components/layout/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { call } from "@/so/features/checkin/checkin";
import { TZ, wibDate, wibDateTime, wibDay } from "@/so/lib/wib";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import PengajuanView, { Balances, FileChip, StatusBadge } from "./PengajuanView";
import { type Barista, type FileKind, type FormState, type Kind, type Line, type Pengajuan, type PgFile, CATEGORY_LABEL, DOC_LABEL, KINDS, KIND_HINT,
  NEEDED_LABEL, OPEN, STATUS_LABEL, fmtRp, kindLabel, parseRp, typeRp, upload } from "./pengajuan";

export default function PengajuanForm() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState<Kind>("PETTY_CASH");
  const [draft, setDraft] = useState<Pengajuan | null>(null);
  const [sent, setSent] = useState<Pengajuan | null>(null);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "open" | "paid" | "rejected">("all");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await call<FormState>("/api/pengajuan/form");
      setData(d);
      setBranch((b) => b || (d.branches.length === 1 ? d.branches[0].code : ""));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id?: string) => {
    setOpening(true);
    try {
      setDraft(id ? await call<Pengajuan>(`/api/pengajuan/requests/${id}`) : await call<Pengajuan>("/api/pengajuan/requests", { method: "POST", json: { branchCode: branch, kind } }));
      setSent(null);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOpening(false);
    }
  };

  if (draft && data) {
    return <Editor data={data} initial={draft} onClose={() => { setDraft(null); void load(); }}
      onSent={(p) => { setDraft(null); setSent(p); void load(); window.scrollTo({ top: 0 }); }} />;
  }

  const editable = (data?.requests ?? []).filter((r) => r.status === "DRAFT" || r.status === "REVISION");
  const mine = (data?.requests ?? []).filter((r) => r.status !== "DRAFT");
  const shown = mine.filter((r) => show === "all" || (show === "open" ? OPEN.includes(r.status) : show === "paid" ? r.status === "PAID" : r.status === "REJECTED"));
  return (
    <Page title={tr("Fund requests")} actions={<LiveClock />}
      subtitle={now ? now.toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}>
      {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-48 rounded-xl" /><div className="skeleton h-64 rounded-xl" /></div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {sent && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{tr("Fund request {0} sent", sent.number ?? "")}</p>
                <p className="text-xs">{kindLabel(sent.kind)} · {sent.branchName} · {fmtRp(sent.requestedAmount ?? sent.totalOut)} · {tr("Management approves it, then Finance transfers")}</p>
                <button type="button" onClick={() => setView(sent.id)} className="mt-1 text-xs font-semibold underline-offset-2 hover:underline">{tr("See the progress")}</button>
              </div>
              <button type="button" onClick={() => setSent(null)} className="rounded-md p-1 opacity-70 hover:bg-white/60" aria-label={tr("Close")}><X size={16} /></button>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <UserAvatar name={data.user.name} src={me?.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{data.user.name}</p>
                <p className="truncate text-xs text-slate-500">@{data.user.username} · {tr("Petty cash and budget requests of the outlet")}</p>
              </div>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">{tr("Branch")}</p>
                {data.branches.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">{tr("No branch is assigned to your account. Ask your administrator to assign your outlets.")}</p>
                ) : data.branches.length === 1 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900">{data.branches[0].name}</p>
                ) : (
                  <select value={branch} onChange={(e) => setBranch(e.target.value)} className={cx(inputClass, "h-11")} aria-label={tr("Branch")}>
                    <option value="">{tr("Choose the branch")}</option>
                    {data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">{tr("Kind of request")}</p>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr("Kind of request")}>
                  {KINDS.map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                      className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", k === "PETTY_CASH" && "sm:col-span-2",
                        kind === k ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:bg-slate-50")}>
                      <span className="block text-sm font-semibold text-slate-900">{kindLabel(k)}{k !== "PETTY_CASH" && <span className="ml-1.5 text-[11px] font-medium text-slate-400">{tr("Budget")}</span>}</span>
                      <span className="block text-xs text-slate-500">{KIND_HINT[k]()}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">{tr("Maintenance and new equipment, decoration or merchandise: use Form → Damaged Equipment.")}</p>
              </div>
              <Button className="w-full sm:w-auto" disabled={!branch} loading={opening} onClick={() => void open()}><Plus size={15} /> {tr("Create: {0}", kindLabel(kind))}</Button>
            </div>
          </section>

          {editable.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-white shadow-sm">
              <p className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-amber-900 sm:px-5">{tr("To finish ({0})", editable.length)}</p>
              <ul className="divide-y divide-slate-100">
                {editable.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => void open(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                      <ClipboardList size={18} className={cx("flex-shrink-0", d.status === "REVISION" ? "text-red-600" : "text-amber-600")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{d.number ?? tr("Draft")} · {kindLabel(d.kind)} · {d.branchName}</span>
                        <span className="block text-xs text-slate-500">{d.status === "REVISION" ? tr("Sent back for a revision: see the team's note") : tr("saved {0}", wibDateTime(d.updatedAt))}</span>
                      </span>
                      <StatusBadge s={d.status} />
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{tr("My fund requests")}</p>
                <p className="text-xs text-slate-500">{tr("Tap one to see every step and note of the team")}</p>
              </div>
              <Segmented label={tr("Show")} value={show} onChange={setShow} options={[
                { value: "all", label: `${tr("All")} ${mine.length}` }, { value: "open", label: `${tr("In progress")} ${mine.filter((r) => OPEN.includes(r.status)).length}` },
                { value: "paid", label: `${tr("Paid")} ${mine.filter((r) => r.status === "PAID").length}` }, { value: "rejected", label: `${tr("Rejected")} ${mine.filter((r) => r.status === "REJECTED").length}` }]} />
            </div>
            {shown.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{mine.length ? tr("Nothing in this view") : tr("No fund request sent yet")}</p> : (
              <ul className="divide-y divide-slate-100">
                {shown.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setView(r.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs font-semibold text-slate-500">{r.number}</span>
                        <StatusBadge s={r.status} />
                        <span className="ml-auto text-[11px] tabular-nums text-slate-400">{wibDateTime(r.submittedAt)}</span>
                      </span>
                      <span className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">{kindLabel(r.kind)} · {r.branchName}{r.kind === "PETTY_CASH" && r.periodFrom && r.periodTo ? ` · ${wibDay(r.periodFrom)} – ${wibDay(r.periodTo)}` : ""}</span>
                        <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-slate-900">{fmtRp(r.requestedAmount ?? r.totalOut)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {view && <MineDrawer id={view} onClose={() => setView(null)} onEdit={(id) => { setView(null); void open(id); }} />}
    </Page>
  );
}

/** One of the outlet's sent pengajuan, read-only. */
function MineDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (id: string) => void }) {
  const [p, setP] = useState<Pengajuan | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { call<Pengajuan>(`/api/pengajuan/requests/${id}`).then(setP).catch((e) => setError((e as Error).message)); }, [id]);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<ClipboardList size={18} />} title={p?.number ?? tr("Fund requests")}
      description={p ? `${p.branchName} · ${STATUS_LABEL[p.status]()}` : undefined}
      footer={p?.status === "REVISION" ? <Button onClick={() => onEdit(p.id)}>{tr("Correct and send again")}</Button> : undefined}>
      {error ? <ErrorState message={error} /> : !p ? <div className="skeleton h-72 rounded-xl" /> : <PengajuanView p={p} />}
    </Drawer>
  );
}

type Local = { baristas: Barista[]; periodFrom: string; periodTo: string; opening: string; openingNote: string; income: string; incomeNote: string;
  note: string; lines: (Line & { key: string })[]; requesterName: string; requesterPhone: string; payeeBank: string; payeeAccount: string;
  payeeName: string; purpose: string; neededOn: string };
let seq = 0;
const newKey = () => `n${++seq}`;
const toLocal = (p: Pengajuan): Local => ({
  baristas: p.baristas, periodFrom: p.periodFrom ?? "", periodTo: p.periodTo ?? "", opening: typeRp(p.openingBalance), openingNote: p.openingNote ?? "",
  income: p.incomeAmount ? typeRp(p.incomeAmount) : "", incomeNote: p.incomeNote ?? "", note: p.note ?? "",
  lines: (p.lines ?? []).map((l) => ({ ...l, key: `l${l.id}` })), requesterName: p.requesterName ?? "", requesterPhone: p.requesterPhone ?? "",
  payeeBank: p.payeeBank ?? "", payeeAccount: p.payeeAccount ?? "", payeeName: p.payeeName ?? "", purpose: p.purpose ?? "", neededOn: p.neededOn ?? "",
});
const payload = (l: Local) => ({
  baristas: l.baristas, periodFrom: l.periodFrom || null, periodTo: l.periodTo || null, openingBalance: parseRp(l.opening), openingNote: l.openingNote,
  incomeAmount: parseRp(l.income) ?? 0, incomeNote: l.incomeNote, note: l.note,
  lines: l.lines.map((x) => ({ id: x.id ?? null, spentOn: x.spentOn || null, category: x.category, description: x.description, amount: x.amount })),
  requesterName: l.requesterName, requesterPhone: l.requesterPhone, payeeBank: l.payeeBank, payeeAccount: l.payeeAccount, payeeName: l.payeeName,
  purpose: l.purpose, neededOn: l.neededOn || null,
});

function Editor({ data, initial, onClose, onSent }: { data: FormState; initial: Pengajuan; onClose: () => void; onSent: (p: Pengajuan) => void }) {
  const toast = useToast();
  useFocusMode(true);
  const [server, setServer] = useState<Pengajuan>(initial);
  const [local, setLocal] = useState<Local>(() => toLocal(initial));
  const [files, setFiles] = useState<PgFile[]>(initial.files ?? []);
  const [saving, setSaving] = useState<"idle" | "pending" | "saving" | "error">("idle");
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const localRef = useRef(local);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<Pengajuan | null> | null>(null);
  const base = `/api/pengajuan/requests/${initial.id}`;

  // saves the current form; the new expenses get their ids back (same order as sent)
  const flush = useCallback(async (): Promise<Pengajuan | null> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inflight.current) await inflight.current;
    const snap = localRef.current;
    setSaving("saving");
    const run = call<Pengajuan>(base, { method: "PATCH", json: payload(snap) }).then((p) => {
      setServer(p);
      setFiles(p.files ?? []);
      setLocal((cur) => {
        const ids = (p.lines ?? []).map((l) => l.id);
        const next = { ...cur, lines: cur.lines.map((l) => {
          const at = snap.lines.findIndex((s) => s.key === l.key);
          return at >= 0 && !l.id && ids[at] ? { ...l, id: ids[at] } : l;
        }) };
        localRef.current = next;
        return next;
      });
      setSaving("idle");
      return p;
    }).catch((e) => { setSaving("error"); toast((e as Error).message, "error"); return null; });
    inflight.current = run;
    const out = await run;
    inflight.current = null;
    return out;
  }, [base, toast]);

  const update = (patch: Partial<Local>) => {
    setLocal((cur) => {
      const next = { ...cur, ...patch };
      localRef.current = next;
      return next;
    });
    setSaving("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const setLine = (key: string, patch: Partial<Line>) => update({ lines: local.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const kind = server.kind;
  const petty = kind === "PETTY_CASH";
  const receipts = data.receiptRequired.includes(kind);
  const lineDate = petty || kind === "EMERGENCY";
  const cats = data.categoriesOf[kind] ?? data.categories;
  const lineWord = petty || kind === "EMERGENCY" ? tr("Expense") : tr("Cost line");
  const addLine = () => update({ lines: [...local.lines, { key: newKey(), spentOn: lineDate ? local.periodTo || wibDate() : null, category: Object.keys(cats)[0] ?? "OTHER", description: "", amount: null }] });
  const removeLine = (key: string) => update({ lines: local.lines.filter((l) => l.key !== key) });

  const attach = async (kind: FileKind, file: File, docType: string, lineKey?: string) => {
    let lineId: number | undefined;
    if (kind === "LINE") {
      const line = localRef.current.lines.find((l) => l.key === lineKey);
      lineId = line?.id;
      if (!lineId) {
        await flush();
        lineId = localRef.current.lines.find((l) => l.key === lineKey)?.id;
      }
      if (!lineId) { toast(tr("Save the expense first"), "error"); return; }
    }
    try {
      const q = new URLSearchParams({ kind, docType, name: file.name.slice(0, 150), ...(lineId ? { line: String(lineId) } : {}) });
      const r = await upload<{ files: PgFile[] }>(`${base}/files?${q}`, file);
      setFiles(r.files);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const removeFile = async (id: string) => {
    try { setFiles((await call<{ files: PgFile[] }>(`${base}/files/${id}`, { method: "DELETE" })).files); } catch (e) { toast((e as Error).message, "error"); }
  };

  // what blocks the sending, the same rules as the server (app/pengajuan.py missing), on the local figures
  const totalOut = local.lines.reduce((a, l) => a + (l.amount ?? 0), 0);
  const opening = parseRp(local.opening);
  const income = parseRp(local.income) ?? 0;
  const closing = opening === null ? null : opening + income - totalOut;
  // what the outlet receives: the top-up back to the plafon (petty cash with a plafon), otherwise the total (app/pengajuan.py requested)
  const asked = petty && server.plafon !== null && opening !== null ? Math.max(server.plafon - (closing ?? 0), 0) : totalOut;
  const todo = useMemo(() => {
    const out: string[] = [];
    if (!local.requesterName.trim()) out.push(tr("Fill in who submits it (barista / PIC)"));
    if (local.requesterPhone.replace(/\D/g, "").length < 9) out.push(tr("Fill in the personal phone number"));
    if (!local.payeeBank.trim() || !local.payeeAccount.trim() || !local.payeeName.trim()) out.push(tr("Fill in the bank account: bank, number and holder"));
    if (petty) {
      if (!local.baristas.length) out.push(tr("Add at least one barista"));
      if (!local.periodFrom || !local.periodTo) out.push(tr("Fill in the period (from – to)"));
      else if (local.periodFrom > local.periodTo) out.push(tr("The period starts after it ends"));
      else if (local.periodTo > wibDate()) out.push(tr("The period cannot go past today"));
      if (opening === null) out.push(tr("Fill in the opening balance"));
      else if (server.openingExpected !== null && opening !== server.openingExpected && !local.openingNote.trim()) out.push(tr("The opening balance differs from the previous closing balance: write why"));
      if (income > 0 && !local.incomeNote.trim()) out.push(tr("Write where the money in comes from"));
      if (income > 0 && !files.some((f) => f.kind === "INCOME")) out.push(tr("Attach the proof of the money in"));
    } else if (!local.purpose.trim()) out.push(tr("Write the purpose of the request"));
    if (NEEDED_LABEL[kind] && !local.neededOn) out.push(tr("Fill in: {0}", NEEDED_LABEL[kind]!().toLowerCase()));
    if (!local.lines.length) out.push(petty || kind === "EMERGENCY" ? tr("Add at least one expense") : tr("Add at least one cost line"));
    local.lines.forEach((l, i) => {
      const p: string[] = [];
      if (lineDate && !l.spentOn) p.push(tr("date"));
      else if (petty && l.spentOn && local.periodFrom && local.periodTo && (l.spentOn < local.periodFrom || l.spentOn > local.periodTo)) p.push(tr("date outside the period"));
      if (!l.description.trim()) p.push(tr("description"));
      if (!l.amount || l.amount <= 0) p.push(tr("amount"));
      if (receipts && !files.some((f) => f.kind === "LINE" && f.lineId === l.id)) p.push(tr("receipt"));
      if (p.length) out.push(`${lineWord} ${i + 1}: ${p.join(", ")}`);
    });
    if (petty && closing !== null && closing < 0 && !local.note.trim()) out.push(tr("Negative closing balance: explain it in the note"));
    return out;
  }, [local, files, opening, income, closing, server.openingExpected, petty, kind, lineDate, receipts, lineWord]);

  const revision = server.status === "REVISION" ? [...(server.events ?? [])].reverse().find((e) => e.to === "REVISION") : undefined;
  const rejectedLines = (server.lines ?? []).filter((l) => l.review === "REJECTED");

  const submit = async () => {
    setSending(true);
    try {
      if (!(await flush())) return;
      onSent(await call<Pengajuan>(`${base}/submit`, { method: "POST" }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
      setConfirm(false);
    }
  };
  const discard = async () => {
    try { await call(base, { method: "DELETE" }); onClose(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const close = async () => { await flush(); onClose(); };

  const options = data.baristas[server.branchCode] ?? [];
  const lineFiles = (id?: number) => files.filter((f) => f.kind === "LINE" && id !== undefined && f.lineId === id);
  return (
    <div className="min-h-full bg-slate-50 pb-40">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button type="button" onClick={() => void close()} className="-ml-1.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-900">{server.number ?? tr("New fund request")} · {kindLabel(kind)}</p>
            <p className="truncate text-xs text-slate-500">{server.branchName}</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-slate-500" aria-live="polite">
            {saving === "saving" ? <><Loader2 size={13} className="animate-spin" /> {tr("Saving")}</> : saving === "pending" ? tr("Not saved yet")
              : saving === "error" ? <span className="text-red-600">{tr("Not saved")}</span> : <><CloudUpload size={13} /> {tr("Saved")}</>}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        {revision && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {tr("Sent back for a revision by {0}", revision.actor ?? "—")}</p>
            <p className="mt-1 whitespace-pre-line">{revision.note}</p>
            {rejectedLines.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">{rejectedLines.map((l) => <li key={l.id}>{l.description}: {l.reviewNote}</li>)}</ul>}
          </div>
        )}

        <FormCard n={1} title={tr("Submitted by & bank account")} hint={tr("The transfer goes to this account")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={tr("Name (barista / PIC)")} value={local.requesterName} onChange={(v) => update({ requesterName: v })} max={80} />
            <Field label={tr("Personal phone number")} value={local.requesterPhone} onChange={(v) => update({ requesterPhone: v })} max={30} inputMode="tel" />
            <Field label={tr("Bank")} value={local.payeeBank} onChange={(v) => update({ payeeBank: v })} max={60} placeholder="BCA" />
            <Field label={tr("Account number")} value={local.payeeAccount} onChange={(v) => update({ payeeAccount: v })} max={40} inputMode="numeric" />
            <div className="sm:col-span-2"><Field label={tr("Account holder")} value={local.payeeName} onChange={(v) => update({ payeeName: v })} max={80} /></div>
          </div>
        </FormCard>

        {petty ? (<>
        <FormCard n={2} title={tr("Baristas")} hint={tr("Who was on duty: pick the accounts of the branch or type a name")}>
          <Baristas value={local.baristas} options={options} onChange={(b) => update({ baristas: b })} />
        </FormCard>

        <FormCard n={3} title={tr("Period")} hint={tr("The week the expenses belong to: one petty cash per period")}>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{tr("From")}</span>
              <input type="date" value={local.periodFrom} max={wibDate()} onChange={(e) => update({ periodFrom: e.target.value })} className={cx(inputClass, "h-11")} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{tr("To")}</span>
              <input type="date" value={local.periodTo} max={wibDate()} min={local.periodFrom || undefined} onChange={(e) => update({ periodTo: e.target.value })} className={cx(inputClass, "h-11")} /></label>
          </div>
        </FormCard>

        <FormCard n={4} title={tr("Opening balance")} hint={server.openingExpected !== null ? tr("Previous closing balance: {0}", fmtRp(server.openingExpected)) : tr("Cash of the outlet at the start of the period")}>
          <RpInput value={local.opening} onChange={(v) => update({ opening: v })} label={tr("Opening balance")} allowNegative />
          {server.openingExpected !== null && opening !== null && opening !== server.openingExpected && (
            <textarea value={local.openingNote} onChange={(e) => update({ openingNote: e.target.value })} rows={2} maxLength={1000}
              placeholder={tr("Why is it different from the previous closing balance? (required)")} className={cx(inputClass, "mt-2 h-auto py-2 text-sm", !local.openingNote.trim() && "border-red-300")} />
          )}
        </FormCard>

        <FormCard n={5} title={tr("Money in")} hint={tr("Top-up received in the period (transfer from Finance, cash …); 0 if none")}>
          <RpInput value={local.income} onChange={(v) => update({ income: v })} label={tr("Money in")} />
          {income > 0 && (
            <div className="mt-2 space-y-2">
              <input value={local.incomeNote} onChange={(e) => update({ incomeNote: e.target.value })} maxLength={1000}
                placeholder={tr("From where and when, e.g. transfer Finance 21/10 (required)")} className={cx(inputClass, "h-11 text-sm", !local.incomeNote.trim() && "border-red-300")} />
              <Attachments files={files.filter((f) => f.kind === "INCOME")} docTypes={["TRANSFER", "KWITANSI", "OTHER"]} required
                onAdd={(f, d) => attach("INCOME", f, d)} onRemove={removeFile} />
            </div>
          )}
        </FormCard>

        </>) : (
        <FormCard n={2} title={tr("Purpose")} hint={KIND_HINT[kind]()}>
          <textarea value={local.purpose} onChange={(e) => update({ purpose: e.target.value })} rows={3} maxLength={1000}
            placeholder={kind === "EVENT" ? tr("Name and place of the event, target sales …") : kind === "BILL" ? tr("Which bill and period, e.g. PLN October") : tr("What it is for and why it is needed")}
            className={cx(inputClass, "h-auto py-2 text-sm", !local.purpose.trim() && "border-red-300")} />
          {NEEDED_LABEL[kind] && (
            <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">{NEEDED_LABEL[kind]!()}</span>
              <input type="date" value={local.neededOn} onChange={(e) => update({ neededOn: e.target.value })} className={cx(inputClass, "h-11", !local.neededOn && "border-red-300")} /></label>
          )}
        </FormCard>
        )}

        <FormCard n={petty ? 6 : 3} title={petty || kind === "EMERGENCY" ? tr("Money out") : tr("Cost details")}
          hint={receipts ? tr("Every line with its proof (bill, receipt, invoice …)") : tr("Every cost with its estimate; attach a quotation if there is one")}
          aside={<span className="text-sm font-semibold tabular-nums text-slate-900">{fmtRp(totalOut)}</span>}>
          <ul className="space-y-3">
            {local.lines.map((l, i) => (
              <li key={l.key} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{lineWord} {i + 1}</span>
                  <button type="button" onClick={() => removeLine(l.key)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove expense")}><Trash2 size={15} /></button>
                </div>
                <div className={cx("grid gap-2", lineDate ? "sm:grid-cols-[9.5rem_minmax(0,1fr)_10rem]" : "sm:grid-cols-[minmax(0,1fr)_10rem]")}>
                  {lineDate && <input type="date" value={l.spentOn ?? ""} max={wibDate()} onChange={(e) => setLine(l.key, { spentOn: e.target.value })} aria-label={tr("Date")} className={cx(inputClass, "h-10 text-sm")} />}
                  <select value={l.category} onChange={(e) => setLine(l.key, { category: e.target.value })} aria-label={tr("Category")} className={cx(inputClass, "h-10 text-sm")}>
                    {Object.keys(cats).map((c) => <option key={c} value={c}>{(CATEGORY_LABEL[c] ?? (() => c))()}</option>)}
                  </select>
                  <RpInput value={typeRp(l.amount)} onChange={(v) => setLine(l.key, { amount: parseRp(v) })} label={tr("Amount")} compact />
                </div>
                <input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} maxLength={300}
                  placeholder={receipts ? tr("What was bought / paid, e.g. Gas 3 kg × 2") : tr("What is needed, e.g. Banner 2 × 1 m × 2")} className={cx(inputClass, "mt-2 h-10 text-sm")} />
                <div className="mt-2">
                  <Attachments files={lineFiles(l.id)} docTypes={receipts ? ["NOTA", "KWITANSI", "INVOICE", "STRUK", "FOTO", "OTHER"] : ["QUOTE", "INVOICE", "FOTO", "OTHER"]} required={receipts}
                    onAdd={(f, d) => attach("LINE", f, d, l.key)} onRemove={removeFile} />
                </div>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3 w-full" onClick={addLine}><Plus size={15} /> {petty || kind === "EMERGENCY" ? tr("Add expense") : tr("Add cost line")}</Button>
        </FormCard>

        <FormCard n={petty ? 7 : 4} title={petty ? tr("Closing balance & top-up") : tr("Total & note")}
          hint={petty ? (server.plafon !== null ? tr("Plafon {0}: the top-up brings the cash back to it", fmtRp(server.plafon)) : tr("No plafon set: the money spent is asked")) : tr("The amount asked is the total of the lines")}>
          {petty && <Balances p={{ ...server, openingBalance: opening, incomeAmount: income }} out={totalOut} />}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
            <span className="text-sm font-semibold text-blue-900">{petty ? tr("Top-up asked") : tr("Amount asked")}</span>
            <span className="text-base font-bold tabular-nums text-blue-900">{fmtRp(asked)}</span>
          </div>
          <textarea value={local.note} onChange={(e) => update({ note: e.target.value })} rows={2} maxLength={1000}
            placeholder={petty && closing !== null && closing < 0 ? tr("Negative closing balance: explain it (required)") : tr("Note for management / Finance (optional)")}
            className={cx(inputClass, "mt-3 h-auto py-2 text-sm", petty && closing !== null && closing < 0 && !local.note.trim() && "border-red-300")} />
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-slate-600">{tr("Other attachments (optional)")}</p>
            <Attachments files={files.filter((f) => f.kind === "OTHER")} docTypes={["OTHER", "QUOTE", "INVOICE", "KWITANSI", "FOTO"]}
              onAdd={(f, d) => attach("OTHER", f, d)} onRemove={removeFile} />
          </div>
        </FormCard>

        {server.status === "DRAFT" && (
          <button type="button" onClick={() => setDiscarding(true)} className="mx-auto flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"><Trash2 size={13} /> {tr("Delete this draft")}</button>
        )}
      </div>

      <div className="action-bar fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-3xl space-y-2">
          {todo.length > 0 && (
            <details className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer font-semibold">{tr("{0} things to complete before sending", todo.length)}</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{todo.map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-xs text-slate-500">
              <p className="font-semibold tabular-nums text-slate-900">{tr("Asked {0}", fmtRp(asked))}</p>
              <p className="tabular-nums">{petty ? tr("Closing {0}", fmtRp(closing)) : tr("{0} lines", local.lines.length)}</p>
            </div>
            <Button disabled={todo.length > 0 || saving === "saving"} onClick={() => setConfirm(true)}><Send size={15} /> {server.status === "REVISION" ? tr("Send again") : tr("Send")}</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void submit()} busy={sending}
        title={tr("Send this fund request?")} confirmLabel={tr("Send")}
        description={tr("{0}: {1} asked. After sending it cannot be changed unless the approver sends it back for a revision.", kindLabel(kind), fmtRp(asked))} />
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} onConfirm={() => void discard()} danger
        title={tr("Delete this draft?")} confirmLabel={tr("Delete")} description={tr("Every figure, expense and attachment of this draft is removed.")} />
    </div>
  );
}

function Field({ label, value, onChange, max, placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; max: number;
  placeholder?: string; inputMode?: "tel" | "numeric" }) {
  return (
    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} inputMode={inputMode}
        className={cx(inputClass, "h-11 text-sm", !value.trim() && "border-red-300")} /></label>
  );
}

/** Rupiah typed with thousands separators (125.000). */
function RpInput({ value, onChange, label, allowNegative, compact }: { value: string; onChange: (v: string) => void; label: string; allowNegative?: boolean; compact?: boolean }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rp</span>
      <input value={value} inputMode="numeric" aria-label={label} placeholder="0"
        onChange={(e) => {
          const raw = e.target.value;
          const n = parseRp(raw);
          onChange(n === null ? (allowNegative && raw.trim() === "-" ? "-" : "") : typeRp(allowNegative ? n : Math.abs(n)));
        }}
        className={cx(inputClass, compact ? "h-10 text-sm" : "h-11 text-base", "pl-9 text-right font-semibold tabular-nums")} />
    </span>
  );
}

/** Accounts of the branch as chips, plus names typed. */
function Baristas({ value, options, onChange }: { value: Barista[]; options: { id: string; name: string }[]; onChange: (v: Barista[]) => void }) {
  const [name, setName] = useState("");
  const has = (n: string) => value.some((b) => b.name.toLowerCase() === n.toLowerCase());
  const add = () => {
    const n = name.split(/\s+/).filter(Boolean).join(" ");
    if (n && !has(n)) onChange([...value, { name: n }]);
    setName("");
  };
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((b) => (
            <span key={b.name} className={cx("inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-xs font-medium", b.userId ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-700")}>
              {b.name}
              <button type="button" onClick={() => onChange(value.filter((x) => x.name !== b.name))} className="rounded-full p-0.5 hover:bg-white" aria-label={tr("Remove {0}", b.name)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {options.filter((o) => !has(o.name)).length > 0 && (
        <select value="" aria-label={tr("Accounts of the branch")} className={cx(inputClass, "h-10 text-sm")}
          onChange={(e) => { const o = options.find((x) => x.id === e.target.value); if (o) onChange([...value, { name: o.name, userId: o.id }]); }}>
          <option value="">{tr("Pick from the accounts of the branch ({0})", options.filter((o) => !has(o.name)).length)}</option>
          {options.filter((o) => !has(o.name)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} maxLength={80}
          placeholder={tr("Another barista's name")} className={cx(inputClass, "h-10 min-w-0 flex-1 text-sm")} />
        <Button variant="secondary" disabled={!name.trim()} onClick={add}><UserPlus size={15} /> {tr("Add")}</Button>
      </div>
    </div>
  );
}

/** The files of one place (an expense, the money in …): pick the kind of document, then the file (camera, gallery or PDF). */
function Attachments({ files, docTypes, required, onAdd, onRemove }: { files: PgFile[]; docTypes: string[]; required?: boolean;
  onAdd: (file: File, docType: string) => Promise<void>; onRemove: (id: string) => void }) {
  const [doc, setDoc] = useState(docTypes[0]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(list)) await onAdd(f, doc);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      {files.map((f) => <FileChip key={f.id} f={f} onRemove={() => onRemove(f.id)} />)}
      <div className={cx("flex items-center gap-1 rounded-lg border p-1", required && !files.length ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-white")}>
        <select value={doc} onChange={(e) => setDoc(e.target.value)} aria-label={tr("Kind of document")} className="h-8 rounded-md border-0 bg-transparent pl-1.5 pr-6 text-xs font-medium text-slate-700 focus:ring-0">
          {docTypes.map((d) => <option key={d} value={d}>{(DOC_LABEL[d] ?? (() => d))()}</option>)}
        </select>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => void pick(e.target.files)} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} {tr("Attach file")}
        </button>
      </div>
      {required && !files.length && <Badge tone="red">{tr("Receipt required")}</Badge>}
    </div>
  );
}

