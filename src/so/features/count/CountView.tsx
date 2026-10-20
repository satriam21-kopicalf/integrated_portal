"use client";

// Count screen (06.9 §4, §9): items grouped by area, one quantity per item in its unit of the SO template (GR, PCS,
// PACK@100PCS, ROLL@1000PCS …, 2026-10-15), every line saved when it is left, blind count (no system quantity), up to
// 15 optional evidence photos at the end, then a preview of everything entered with an optional signature (06.9 §12.16,
// D-62) and submit with the location. After submit it is read-only (with the signature); in a recount only the lines
// marked by the reviewer can be changed (the old value stays in the history).
// Phones (2026-10-20): one compact row per item (name left, quantity right with its unit, a quick "0"), the keyboard's
// Next key moves to the next item (the line is saved on leaving it), counted / total per area on the area chips.

import { AlertTriangle, ArrowLeft, Check, CheckCircle2, CloudUpload, Loader2, MapPin, RotateCcw, Search, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, ErrorState, cx, fmtDate, fmtDay, inputClass, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountLine, ENTRY_SOURCE, STATUS, countTypeLabel, fmtQty, getPosition, parseQty } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import Evidence, { SignatureCard } from "./Evidence";
import SubmitPreview from "./SubmitPreview";
import WipSection from "./WipSection";

type Draft = { qty: string };

/** The unit the crew counts the line in (the template / ESB unit) and the quantity in that unit. */
const unitOf = (l: CountLine) => l.esb_uom || l.base_uom;
const factorOf = (l: CountLine) => Number(l.esb_factor || 1) || 1;
/** A line the premix filled (grams from the WIP): it needs no manual entry (2026-10-16). */
const fromWip = (l: CountLine) => Number(l.qty_wip ?? 0) > 0;
const draftOf = (l: CountLine): Draft => ({ qty: l.qty_base === null ? "" : fmtQty(Number(l.qty_base) / factorOf(l)) });

const editableLine = (c: Count, l: CountLine) =>
  c.status === "IN_PROGRESS" || (c.status === "RECOUNT_REQUESTED" && l.flags.includes("RECOUNT"));

export default function CountView({ countId, backHref = "/stock-opname" }: { countId: string; backHref?: string }) {
  const toast = useToast();
  const [count, setCount] = useState<Count | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [invalid, setInvalid] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [area, setArea] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wipDirty, setWipDirty] = useState(false);
  const pending = useRef<Record<number, Draft>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const c = await api<Count>(`/api/so/counts/${countId}`);
      setCount(c);
      setDrafts(Object.fromEntries(c.lines.map((l) => [l.id, draftOf(l)])));
    } catch (e) {
      setError(errorText(e));
    }
  }, [countId]);
  useEffect(() => { void load(); }, [load]);

  const save = async (line: CountLine) => {
    const d = pending.current[line.id] ?? drafts[line.id];
    if (!d) return;
    const qty = parseQty(d.qty);
    const bad = qty === undefined;
    setInvalid((s) => { const n = new Set(s); if (bad) n.add(line.id); else n.delete(line.id); return n; });
    if (bad) return;
    if (qty === (draftOf(line).qty === "" ? null : String(Number(draftOf(line).qty)))) return;
    setSaving((s) => new Set(s).add(line.id));
    try {
      const c = await api<Count>(`/api/so/counts/${countId}/lines`, {
        method: "PUT",
        json: { lines: [{ line_id: line.id, qty_unit: qty }] },
      });
      delete pending.current[line.id];
      setCount(c);
      // a recount replaces the line: carry the typed values to the new line id
      const replaced = c.lines.find((l) => l.recount_of === line.id);
      if (replaced) setDrafts((ds) => ({ ...ds, [replaced.id]: draftOf(replaced) }));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(line.id); return n; });
    }
  };

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((ds) => {
      const next = { ...(ds[id] ?? { qty: "" }), ...patch };
      pending.current[id] = next;
      return { ...ds, [id]: next };
    });

  const submit = async (signature: string | null = null, signedName = "") => {
    setSubmitting(true);
    try {
      const pos = await getPosition();
      const c = await api<Count>(`/api/so/counts/${countId}/submit`, { method: "POST",
        json: { lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy_m: pos?.accuracy ?? null, located_at: pos?.at ?? null,
          signature, signed_name: signature ? signedName : null } });
      setCount(c);
      setConfirming(false);
      toast(tr("Count submitted"));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const areas = useMemo(() => Array.from(new Set((count?.lines ?? []).map((l) => l.area))), [count]);
  const areaDone = useMemo(() => {
    const m: Record<string, [number, number]> = {};
    for (const l of count?.lines ?? []) {
      const a = (m[l.area] ??= [0, 0]);
      a[1] += 1;
      if ((l.qty_base !== null || fromWip(l)) && !l.flags.includes("RECOUNT")) a[0] += 1;
    }
    return m;
  }, [count]);
  /** the keyboard's Next / Enter: on to the next quantity field of the list */
  const nextField = (el: HTMLInputElement) => {
    const all = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-qty]:not(:disabled)"));
    const n = all[all.indexOf(el) + 1];
    if (n) { n.focus(); n.scrollIntoView({ block: "center", behavior: "smooth" }); } else el.blur();
  };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (count?.lines ?? []).filter((l) => (!area || l.area === area) && (!onlyOpen || (l.qty_base === null && !fromWip(l)) || l.flags.includes("RECOUNT")) &&
      (!s || l.item_name.toLowerCase().includes(s) || l.item_code.toLowerCase().includes(s)));
  }, [count, q, area, onlyOpen]);

  if (error) return <div className="p-4 sm:p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!count) return <div className="flex justify-center p-10 text-slate-400"><Loader2 className="animate-spin" /></div>;

  const st = STATUS[count.status];
  const open = count.status === "IN_PROGRESS" || count.status === "RECOUNT_REQUESTED";
  const todo = count.lines.filter((l) => (l.qty_base === null && !fromWip(l)) || l.flags.includes("RECOUNT")).length;
  const pct = count.progress.lines ? Math.round((count.progress.counted / count.progress.lines) * 100) : 0;
  const busy = saving.size > 0;
  // Cost Control entering a branch's count (D-56): no photos or location needed
  const crew = (count.entry_source ?? "CREW") === "CREW";

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-start gap-2 sm:gap-3">
          <Link href={backHref} className="-ml-1.5 mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{countTypeLabel(count.count_type, count.count_type_name)}</h1>
            <p className="truncate text-xs text-slate-500">{count.facility_name} · {fmtDay(count.business_date)} · {count.number}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={st.tone} dot>{st.label()}</Badge>
              {!crew && <Badge tone="violet">{ENTRY_SOURCE[count.entry_source ?? "CREW"]?.()}</Badge>}
              {count.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
              {count.outside_radius && <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside the facility radius")}</Badge>}
              {count.progress.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} lines to check", count.progress.flagged)}</Badge>}
            </div>
          </div>
          <span className="flex-shrink-0 text-xs text-slate-400" aria-live="polite">
            {busy ? <span className="inline-flex items-center gap-1"><CloudUpload size={13} /> {tr("Saving…")}</span> : <span className="inline-flex items-center gap-1"><Check size={13} /> {tr("Saved")}</span>}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cx("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-600">{count.progress.counted}/{count.progress.lines}</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search item")} aria-label={tr("Search item")}
              className={`${inputClass} h-9 pl-8 pr-8`} />
            {q && <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label={tr("Clear search")}><X size={14} /></button>}
          </div>
          {open && (
            <button type="button" onClick={() => setOnlyOpen((v) => !v)} aria-pressed={onlyOpen}
              className={cx("h-9 whitespace-nowrap rounded-lg border px-3 text-xs font-medium", onlyOpen ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>
              {tr("To do")} ({todo})
            </button>
          )}
        </div>
        {areas.length > 1 && (
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {["", ...areas].map((a) => (
              <button key={a || "all"} type="button" onClick={() => setArea(a)} aria-pressed={area === a}
                className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", area === a ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>
                {a || tr("All areas")}
                {a && areaDone[a] && (
                  <span className={cx("tabular-nums", areaDone[a][0] === areaDone[a][1] ? "text-emerald-600" : "text-slate-400")}>
                    {areaDone[a][0] === areaDone[a][1] ? "✓" : `${areaDone[a][0]}/${areaDone[a][1]}`}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-3 py-4 sm:p-6">
        {count.status === "RECOUNT_REQUESTED" && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <RotateCcw size={16} className="mt-0.5 flex-shrink-0" />
            <span>{tr("Recount requested by {0}", count.reviewed_by_name ?? tr("the reviewer"))}{count.review_note ? `: ${count.review_note}` : ""}</span>
          </p>
        )}
        {!open && (
          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            {count.submitted_at ? tr("Submitted {0}. The count is locked.", fmtDate(count.submitted_at)) : tr("The count is locked.")}
          </p>
        )}

        {count.wip?.enabled && <WipSection count={count} open={open} onSaved={setCount} onDirty={setWipDirty} />}

        {areas.filter((a) => shown.some((l) => l.area === a)).map((a) => (
          <section key={a} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{a}</h2>
              {areaDone[a] && <span className="text-[11px] tabular-nums text-slate-400">{areaDone[a][0]}/{areaDone[a][1]}</span>}
            </div>
            <ul className="divide-y divide-slate-100">
              {shown.filter((l) => l.area === a).map((l) => {
                const d = drafts[l.id] ?? { qty: "" };
                const edit = editableLine(count, l);
                const bad = invalid.has(l.id);
                const done = (l.qty_base !== null || fromWip(l)) && !l.flags.includes("RECOUNT");
                return (
                  <li key={l.id} className={cx("flex items-center gap-3 px-3 py-2.5 sm:px-4", l.flags.includes("RECOUNT") && "bg-amber-50/50")}>
                    <span className="flex w-5 flex-shrink-0 justify-center" aria-hidden>
                      {saving.has(l.id) ? <Loader2 size={15} className="animate-spin text-blue-600" />
                        : done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-200" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{l.item_name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400"><span className="font-mono">{l.item_code}</span>{l.counted_by_name ? ` · ${l.counted_by_name}` : ""}</p>
                      {(l.flags.includes("RECOUNT") || l.flags.includes("SPIKE")) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {l.flags.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
                          {l.flags.includes("SPIKE") && <Badge tone="amber" title={tr("More than 3 times higher or lower than the last approved count")}>{tr("Check")}</Badge>}
                        </span>
                      )}
                      {l.source !== "WIP_EXPLODED" && Number(l.qty_wip ?? 0) > 0 && (
                        <p className="mt-0.5 text-[11px] text-violet-700">{tr("+ {0} {1} from the WIP", fmtQty(l.qty_wip ?? "0"), l.base_uom)}</p>
                      )}
                      {bad && <p className="mt-0.5 text-[11px] text-red-600">{tr("Use numbers only, e.g. 2 or 1.5")}</p>}
                    </div>
                    {l.source === "WIP_EXPLODED" ? (
                      <p className="flex-shrink-0 text-right text-xs font-medium text-violet-700">{fmtQty(l.qty_wip ?? "0")} {l.base_uom}<span className="block text-[10px] font-normal">{tr("from the WIP")}</span></p>
                    ) : (
                      <div className="flex flex-shrink-0 items-start gap-1.5">
                        {edit && d.qty === "" && (
                          <button type="button" onClick={() => { setDraft(l.id, { qty: "0" }); setTimeout(() => void save(l), 0); }}
                            className="h-11 w-10 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800"
                            aria-label={tr("{0}: none (0)", l.item_name)} title={tr("None (0)")}>0</button>
                        )}
                        <div>
                          <label className="relative block w-28 sm:w-36">
                            <input inputMode="decimal" enterKeyHint="next" data-qty disabled={!edit} value={d.qty} placeholder="—"
                              onChange={(e) => setDraft(l.id, { qty: e.target.value })} onBlur={() => save(l)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); nextField(e.currentTarget); } }}
                              onFocus={(e) => e.currentTarget.select()}
                              className={cx(inputClass, "h-11 text-right text-base font-semibold tabular-nums", done && "border-emerald-200 bg-emerald-50/40", bad && "border-red-400")}
                              aria-label={`${l.item_name} ${unitOf(l)}`} />
                          </label>
                          <p className="mt-0.5 max-w-[7rem] truncate text-right text-[10px] font-semibold uppercase text-slate-500 sm:max-w-[9rem]" title={unitOf(l)}>
                            {unitOf(l)}{factorOf(l) !== 1 && l.qty_base !== null ? <span className="font-normal normal-case text-slate-400"> = {fmtQty(l.qty_base)} {l.base_uom}</span> : null}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{tr("No item matches the search or filters")}</p>}
        {(crew || count.photos.length > 0) && <Evidence count={count} open={open} onChange={setCount} />}
        {!open && <SignatureCard count={count} />}
      </div>

      {open && (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-slate-900">{tr("{0} of {1} counted", count.progress.counted, count.progress.lines)}</p>
              <p className="truncate text-xs text-slate-500">
                {wipDirty ? tr("Save the WIP first") : todo ? tr("Enter 0 for items that are not there") : tr("Everything is counted")}
              </p>
            </div>
            <Button disabled={todo > 0 || busy || wipDirty} onClick={() => setConfirming(true)}><Send size={16} /> {crew ? tr("Review & submit") : tr("Submit")}</Button>
          </div>
        </div>
      )}
      {crew ? (
        confirming && <SubmitPreview count={count} open busy={submitting} onClose={() => setConfirming(false)}
          onSubmit={(signature, name) => void submit(signature, name)} />
      ) : (
        <ConfirmDialog open={confirming} busy={submitting} onClose={() => setConfirming(false)} onConfirm={() => void submit()}
          title={tr("Submit the count?")} description={tr("After submitting, the quantities are locked and go to Review. Another Cost Control member approves them.")}
          confirmLabel={tr("Submit")} />
      )}
    </div>
  );
}
