"use client";

// Count screen (06.9 §4, §9): items grouped by area, packages + loose quantity, every line saved when it is left,
// blind count (no system quantity), submit with the location. After submit it is read-only; in a recount only the
// lines marked by the reviewer can be changed (the old value stays in the history).

import { AlertTriangle, ArrowLeft, Check, CheckCircle2, CloudUpload, Loader2, MapPin, RotateCcw, Search, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, ErrorState, cx, fmtDate, fmtDay, inputClass, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountLine, ENTRY_SOURCE, STATUS, countTypeLabel, fmtQty, getPosition, parseQty } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import PhotoStrip from "./Photos";
import WipSection from "./WipSection";

type Draft = { pack: string; loose: string };

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
      setDrafts(Object.fromEntries(c.lines.map((l) => [l.id, { pack: fmtQty(l.qty_pack), loose: fmtQty(l.qty_loose) }])));
    } catch (e) {
      setError(errorText(e));
    }
  }, [countId]);
  useEffect(() => { void load(); }, [load]);

  const save = async (line: CountLine) => {
    const d = pending.current[line.id] ?? drafts[line.id];
    if (!d) return;
    const pack = parseQty(d.pack);
    const loose = parseQty(d.loose);
    const bad = pack === undefined || loose === undefined;
    setInvalid((s) => { const n = new Set(s); if (bad) n.add(line.id); else n.delete(line.id); return n; });
    if (bad) return;
    if (pack === (line.qty_pack === null ? null : String(Number(line.qty_pack))) && loose === (line.qty_loose === null ? null : String(Number(line.qty_loose)))) return;
    setSaving((s) => new Set(s).add(line.id));
    try {
      const c = await api<Count>(`/api/so/counts/${countId}/lines`, {
        method: "PUT",
        json: { lines: [{ line_id: line.id, qty_pack: line.pack_uom ? pack : null, qty_loose: loose }] },
      });
      delete pending.current[line.id];
      setCount(c);
      // a recount replaces the line: carry the typed values to the new line id
      const replaced = c.lines.find((l) => l.recount_of === line.id);
      if (replaced) setDrafts((ds) => ({ ...ds, [replaced.id]: { pack: fmtQty(replaced.qty_pack), loose: fmtQty(replaced.qty_loose) } }));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(line.id); return n; });
    }
  };

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((ds) => {
      const next = { ...(ds[id] ?? { pack: "", loose: "" }), ...patch };
      pending.current[id] = next;
      return { ...ds, [id]: next };
    });

  const submit = async () => {
    setSubmitting(true);
    try {
      const pos = await getPosition();
      const c = await api<Count>(`/api/so/counts/${countId}/submit`, { method: "POST", json: { lat: pos?.lat ?? null, lng: pos?.lng ?? null } });
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
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (count?.lines ?? []).filter((l) => (!area || l.area === area) && (!onlyOpen || l.qty_base === null || l.flags.includes("RECOUNT")) &&
      (!s || l.item_name.toLowerCase().includes(s) || l.item_code.toLowerCase().includes(s)));
  }, [count, q, area, onlyOpen]);

  if (error) return <div className="p-4 sm:p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!count) return <div className="flex justify-center p-10 text-slate-400"><Loader2 className="animate-spin" /></div>;

  const st = STATUS[count.status];
  const open = count.status === "IN_PROGRESS" || count.status === "RECOUNT_REQUESTED";
  const todo = count.lines.filter((l) => l.qty_base === null || l.flags.includes("RECOUNT")).length;
  const photosMissing = count.photo_todo.areas.length + count.photo_todo.items.length;
  const pct = count.progress.lines ? Math.round((count.progress.counted / count.progress.lines) * 100) : 0;
  const busy = saving.size > 0;
  // Cost Control entering a branch's count (D-56): no photos or location needed
  const crew = (count.entry_source ?? "CREW") === "CREW";

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-start gap-3">
          <Link href={backHref} className="mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{countTypeLabel(count.count_type, count.count_type_name)}</h1>
            <p className="truncate text-xs text-slate-500">{count.facility_name} · {count.number}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={st.tone} dot>{st.label()}</Badge>
              {!crew && <Badge tone="violet">{ENTRY_SOURCE[count.entry_source ?? "CREW"]?.()}</Badge>}
              <Badge>{fmtDay(count.business_date)}</Badge>
              {count.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
              {count.outside_radius && <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside the facility radius")}</Badge>}
              {count.progress.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} lines to check", count.progress.flagged)}</Badge>}
            </div>
          </div>
          <span className="flex-shrink-0 text-xs text-slate-400" aria-live="polite">
            {busy ? <span className="inline-flex items-center gap-1"><CloudUpload size={13} /> {tr("Saving…")}</span> : <span className="inline-flex items-center gap-1"><Check size={13} /> {tr("Saved")}</span>}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex gap-2">
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
                className={cx("whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", area === a ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>
                {a || tr("All areas")}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 sm:p-6">
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
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{a}</h2>
              {crew && <PhotoStrip count={count} subject={`AREA:${a}`} required open={open} onChange={setCount} compact />}
            </div>
            <ul className="divide-y divide-slate-100">
              {shown.filter((l) => l.area === a).map((l) => {
                const d = drafts[l.id] ?? { pack: "", loose: "" };
                const edit = editableLine(count, l);
                const bad = invalid.has(l.id);
                return (
                  <li key={l.id} className={cx("px-4 py-3 md:flex md:items-start md:gap-6", l.flags.includes("RECOUNT") && "bg-amber-50/50")}>
                    <div className="flex min-w-0 items-start justify-between gap-2 md:flex-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{l.item_name}</p>
                        <p className="text-[11px] text-slate-400"><span className="font-mono">{l.item_code}</span>{l.counted_by_name ? ` · ${l.counted_by_name}` : ""}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        {saving.has(l.id) ? <Loader2 size={14} className="animate-spin text-blue-600" />
                          : l.qty_base !== null && !l.flags.includes("RECOUNT") ? <CheckCircle2 size={16} className="text-emerald-500" /> : null}
                        {l.flags.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
                        {l.flags.includes("SAMPLE") && <Badge tone="blue" title={tr("Chosen at random for a photo check")}>{tr("Sample")}</Badge>}
                        {l.flags.includes("SPIKE") && <Badge tone="amber" title={tr("More than 3 times higher or lower than the last approved count")}>{tr("Check")}</Badge>}
                      </div>
                    </div>
                    {l.source === "WIP_EXPLODED" ? (
                      <p className="mt-2 text-sm text-violet-700 md:mt-0 md:w-[24rem] md:text-right">{tr("{0} {1} from the WIP", fmtQty(l.qty_wip ?? "0"), l.base_uom)}</p>
                    ) : (
                    <div className="mt-2 flex flex-wrap items-end gap-2 md:mt-0 md:w-[24rem] md:flex-nowrap md:justify-end">
                      {l.pack_uom && (
                        <label className="min-w-[7rem] flex-1 md:w-36 md:flex-none">
                          <span className="mb-0.5 block text-[11px] text-slate-500">{l.pack_uom}</span>
                          <input inputMode="decimal" disabled={!edit} value={d.pack} placeholder="0"
                            onChange={(e) => setDraft(l.id, { pack: e.target.value })} onBlur={() => save(l)}
                            className={cx(inputClass, "h-11 text-base tabular-nums", bad && "border-red-400")} aria-label={`${l.item_name} ${l.pack_uom}`} />
                        </label>
                      )}
                      <label className="min-w-[7rem] flex-1 md:w-36 md:flex-none">
                        <span className="mb-0.5 block text-[11px] text-slate-500">{l.pack_uom ? tr("Loose ({0})", l.base_uom) : l.base_uom}</span>
                        <input inputMode="decimal" disabled={!edit} value={d.loose} placeholder="0"
                          onChange={(e) => setDraft(l.id, { loose: e.target.value })} onBlur={() => save(l)}
                          className={cx(inputClass, "h-11 text-base tabular-nums", bad && "border-red-400")} aria-label={`${l.item_name} ${l.base_uom}`} />
                      </label>
                      {l.pack_uom && l.qty_base !== null && (
                        <span className="pb-3 text-xs text-slate-500">= {fmtQty(l.qty_base)} {l.base_uom}</span>
                      )}
                    </div>
                    )}
                    {l.source !== "WIP_EXPLODED" && Number(l.qty_wip ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-violet-700 md:text-right">{tr("+ {0} {1} from the WIP", fmtQty(l.qty_wip ?? "0"), l.base_uom)}</p>
                    )}
                    {bad && <p className="mt-1 text-xs text-red-600">{tr("Use numbers only, e.g. 2 or 1.5")}</p>}
                    {((crew && (l.photo_required || l.flags.includes("SPIKE"))) || count.photos.some((p) => p.subject === `ITEM:${l.item_id}`)) && (
                      <PhotoStrip count={count} subject={`ITEM:${l.item_id}`} required={l.photo_required || l.flags.includes("SPIKE")}
                        open={editableLine(count, l) || (open && l.is_current)} onChange={setCount} compact />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{tr("No item matches the search or filters")}</p>}
      </div>

      {open && (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-slate-900">{tr("{0} of {1} counted", count.progress.counted, count.progress.lines)}</p>
              <p className="truncate text-xs text-slate-500">
                {wipDirty ? tr("Save the WIP first") : todo ? tr("Enter 0 for items that are not there") : photosMissing ? tr("{0} photos still needed", photosMissing) : tr("Everything is counted")}
              </p>
            </div>
            <Button disabled={todo > 0 || photosMissing > 0 || busy || wipDirty} onClick={() => setConfirming(true)}><Send size={16} /> {tr("Submit")}</Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirming} busy={submitting} onClose={() => setConfirming(false)} onConfirm={submit}
        title={tr("Submit the count?")} description={crew ? tr("After submitting, the quantities are locked and sent to Cost Control for review. Your location is recorded.")
          : tr("After submitting, the quantities are locked and go to Review. Another Cost Control member approves them.")}
        confirmLabel={tr("Submit")} />
    </div>
  );
}
