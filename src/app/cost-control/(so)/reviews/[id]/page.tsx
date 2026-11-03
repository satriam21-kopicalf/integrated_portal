"use client";

// One count for review: every line with flags and history, then approve, ask for a recount of chosen lines, or cancel.
// Cost Control may also correct a quantity directly with a reason, without a recount (2026-10-29): the branch's figure
// stays in the history. The reviewer cannot be one of the counters (D-30): the API refuses it and explains why.
// Layout (2026-11-04): the correction opens in a drawer (full screen on phones, the Save button at the bottom), the
// review actions sit in a bar above the bottom menu on phones and tablets, the lines are cards on phones.

import { AlertTriangle, ArrowLeft, Check, ChevronRight, ClipboardList, FlaskConical, History, MapPin, Pencil, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, cx, fmtDate, fmtDay, inputClass, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { Card, EmptyState, SearchInput, StatCard, StatGrid, btn, kcTable } from "@/components/kc";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountLine, type WipLine, DATE_FIELD_LABEL, ENTRY_SOURCE, STATUS, countTypeLabel, fmtQty, lineDateField, mapsUrl, parseQty } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { photoUrl } from "@/so/lib/photos";
import { CountFileList, EvidenceDownloads, SignatureCard } from "@/so/features/count/Evidence";
import { PageSkeleton } from "@/components/kc/Skeleton";

type Fix = { id: number; qty: string; note: string; wip?: boolean; field?: "roasted_date" | "expired_date" | null; date?: string };
type Action = "APPROVE" | "RECOUNT" | "CANCEL";

const factor = (l: CountLine) => Number(l.esb_factor || 1) || 1;
const unit = (l: CountLine) => l.esb_uom || l.base_uom;
const gramsUnit = (w: WipLine) => (w.uom.toLowerCase() === "gram" ? "g" : w.uom);

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useMe();
  const [count, setCount] = useState<Count | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // premix lines for a recount (2026-10-29): only their grams are worked out again, not the items counted by hand
  const [pickedWip, setPickedWip] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  // the line being corrected: quantity in the line's unit, its roasted / expired date, and the reason (2026-10-29)
  const [fix, setFix] = useState<Fix | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCount(await api<Count>(`/api/so/counts/${id}?history=${history}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id, history]);
  useEffect(() => { void load(); }, [load]);

  const lines = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (count?.lines ?? []).filter((l) => (!onlyFlagged || l.flags.length > 0) && (!s || l.item_name.toLowerCase().includes(s) || l.item_code.toLowerCase().includes(s)));
  }, [count, q, onlyFlagged]);
  // the dates asked in this count (item groups can ask a different date than the count type)
  const dateFields = useMemo(() => count ? [...new Set(count.lines.map((l) => lineDateField(l, count)).filter((d) => d !== null))] : [], [count]);

  const saveFix = async () => {
    if (!fix) return;
    setBusy(true);
    try {
      setCount(await api<Count>(`/api/so/counts/${id}/corrections`, { method: "POST",
        json: fix.wip ? { note: fix.note.trim(), wip_lines: [{ wip_line_id: fix.id, qty: fix.qty.replace(",", ".").trim() }] }
          : { note: fix.note.trim(), lines: [{ line_id: fix.id, qty_unit: fix.qty.replace(",", ".").trim(), ...(fix.field ? { [fix.field]: fix.date || null } : {}) }] } }));
      setFix(null);
      toast(tr("Quantity corrected"));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const run = async (note: string) => {
    if (!action) return;
    setBusy(true);
    try {
      const c = await api<Count>(`/api/so/counts/${id}/review`, {
        method: "POST",
        json: { action, note: note || null, line_ids: action === "RECOUNT" && picked.size ? Array.from(picked) : null,
          wip_line_ids: action === "RECOUNT" && pickedWip.size ? Array.from(pickedWip) : null },
      });
      setCount(c);
      setPicked(new Set());
      setPickedWip(new Set());
      setAction(null);
      toast(action === "APPROVE" ? tr("Count approved") : action === "RECOUNT" ? tr("Recount requested") : tr("Count cancelled"));
    } catch (e) {
      toast(errorText(e), "error");
      // the count may have moved on meanwhile (e.g. reviewed in another tab): show its current status
      setAction(null);
      void load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="p-4 sm:p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!count) return <PageSkeleton />;
  const st = STATUS[count.status];
  const reviewable = count.status === "SUBMITTED" && can("inventory.count.review");
  // Cost Control corrects quantities, premixes and dates also after the approval (2026-10-30), not once exported to ESB
  const correctable = ["SUBMITTED", "APPROVED"].includes(count.status) && can("inventory.count.review");
  const cancellable = ["IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED"].includes(count.status) && can("inventory.count.review");
  const togglePick = (lineId: number) => setPicked((s) => { const n = new Set(s); if (n.has(lineId)) n.delete(lineId); else n.add(lineId); return n; });
  const toggleWip = (wipId: number) => setPickedWip((s) => { const n = new Set(s); if (n.has(wipId)) n.delete(wipId); else n.add(wipId); return n; });
  const selected = picked.size + pickedWip.size;
  const clearPicks = () => { setPicked(new Set()); setPickedWip(new Set()); };
  const pct = count.progress.lines ? Math.round((count.progress.counted / count.progress.lines) * 100) : 0;

  const fixLine = (l: CountLine) => {
    const df = lineDateField(l, count);
    // a material that only comes from a premix (2026-11-04): the figure is its hand count, starting empty (its 0 is
    // not counted); its premix grams stay
    setFix({ id: l.id, qty: l.qty_base === null || l.source === "WIP_EXPLODED" ? "" : String(+(Number(l.qty_base) / factor(l)).toFixed(2)),
      field: df, date: df ? l[df] ?? "" : "", note: "" });
  };
  const fixing = fix ? (fix.wip ? count.wip?.lines.find((w) => w.id === fix.id) : count.lines.find((l) => l.id === fix.id)) : undefined;
  const actions = { reviewable, cancellable, selected, onAction: setAction, onClear: clearPicks };

  return (
    <div className="min-h-full bg-neutral-50">
      <div className={cx("mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6", (reviewable || cancellable) && "pb-28 lg:pb-6")}>
        {/* header: the count, its status and (desktop) the review actions */}
        <header className="flex flex-wrap items-start gap-3">
          <Link href="/cost-control/reviews" className={cx(btn("outline"), "w-9 px-0")} aria-label={tr("Back")}><ArrowLeft size={16} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{tr("Review Stock Opname")}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900">{count.facility_name}</h1>
            <p className="mt-0.5 text-[13px] text-neutral-500">{countTypeLabel(count.count_type, count.count_type_name)} · {fmtDay(count.business_date)} · <span className="font-mono">{count.number}</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={st.tone} dot>{st.label()}</Badge>
              {count.entry_source && count.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[count.entry_source]?.()}</Badge>}
              {count.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
              {count.outside_radius && <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>}
            </div>
          </div>
          <div className="hidden lg:flex"><ReviewActions {...actions} /></div>
        </header>

        <FlowBanner count={count} reviewable={reviewable} />

        <StatGrid label={tr("Summary")} cols={4}>
          <StatCard label={tr("Counted")} icon={<ClipboardList />} value={`${count.progress.counted}/${count.progress.lines}`}
            sub={<span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></span>{pct}%</span>} />
          <StatCard label={tr("To check")} icon={<AlertTriangle />} tone={count.progress.flagged ? "warn" : "default"} value={count.progress.flagged}
            onClick={() => setOnlyFlagged((v) => !v)} active={onlyFlagged} sub={onlyFlagged ? tr("Showing the lines to check") : tr("Tap to show only them")} />
          <StatCard label={tr("Started")} value={<span className="text-base sm:text-lg">{fmtDate(count.started_at)}</span>} sub={count.started_by_name ?? "—"} />
          <StatCard label={tr("Submitted")} value={<span className="text-base sm:text-lg">{count.submitted_at ? fmtDate(count.submitted_at) : "—"}</span>}
            sub={count.reviewed_at ? tr("Reviewed {0}", `${fmtDate(count.reviewed_at)}${count.reviewed_by_name ? ` · ${count.reviewed_by_name}` : ""}`) : st.label()} />
        </StatGrid>

        {count.review_note && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><span className="font-semibold">{tr("Review Note")}:</span> {count.review_note}</p>
        )}

        <Card title={tr("Location")} subtitle={tr("Where the count was started and sent, against the outlet location")}>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Position label={tr("Location at Start")} lat={count.start_lat} lng={count.start_lng} distance={count.start_distance_m}
              accuracy={count.start_accuracy_m} at={count.start_located_at} none={count.entry_source && count.entry_source !== "CREW" ? "—" : tr("No location")} />
            <Position label={tr("Location at Submit")} lat={count.submit_lat} lng={count.submit_lng} distance={count.submit_distance_m}
              accuracy={count.submit_accuracy_m} at={count.submit_located_at} none={count.submitted_at && count.entry_source === "CREW" ? tr("No location") : "—"} />
            <Info label={tr("Outlet Location")} value={count.facility_lat != null
              ? `${Number(count.facility_lat).toFixed(5)}, ${Number(count.facility_lng).toFixed(5)} · ${tr("radius {0} m", count.facility_radius_m ?? "")}`
              : tr("No coordinates yet")} href={count.facility_lat != null ? mapsUrl(count.facility_lat, count.facility_lng ?? 0) : "/cost-control/locations"} />
          </dl>
        </Card>

        {reviewable && (
          <p className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-[13px] text-brand-900">
            <RotateCcw size={15} className="mt-0.5 flex-shrink-0" />
            <span>{tr("Tick a material to have it counted again by hand (its premix grams stay), or tick a premix to have only the premix counted again (only its grams change). Nothing ticked: every item is asked again.")}</span>
          </p>
        )}

        {(count.wip?.lines.length ?? 0) > 0 && (
          <Card flush title={<span className="inline-flex items-center gap-2"><FlaskConical size={16} className="text-violet-600" />{tr("WIP / Premix")}</span>}
            subtitle={correctable ? tr("Grams entered by the branch · correcting a premix changes only its grams on the materials") : tr("Grams entered by the branch; for Cost Control only, not in the ESB export")}>
            <ul className="divide-y divide-neutral-100">
              {count.wip!.lines.map((w) => (
                <li key={w.id} className={cx("flex items-start gap-3 px-4 py-3 sm:px-5", w.flags?.includes("RECOUNT") && "bg-amber-50/50", pickedWip.has(w.id) && "bg-brand-50/50")}>
                  {reviewable && <PickBox checked={pickedWip.has(w.id)} onChange={() => toggleWip(w.id)} label={tr("Recount {0}", w.name)} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{w.name} <span className="font-mono text-[11px] font-normal text-neutral-400">{w.code}</span></p>
                    {w.previous_qty !== null && w.previous_qty !== undefined && <p className="text-[11px] text-neutral-500">{tr("Before the recount: {0} {1}", w.previous_qty, gramsUnit(w))}</p>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {w.flags?.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
                      {w.flags?.includes("RECOUNTED") && <Badge tone="green">{tr("Recounted")}</Badge>}
                      {w.flags?.includes("CORRECTED") && <Badge tone="blue" title={`${w.corrected_by_name ?? ""}: ${w.correction_note ?? ""}`}>{tr("Corrected by Cost Control")}</Badge>}
                    </div>
                    {w.flags?.includes("CORRECTED") && w.correction_note && <p className="mt-1 text-[11px] text-neutral-500">{w.corrected_by_name}: {w.correction_note}</p>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <p className="text-right text-sm font-semibold tabular-nums text-neutral-900">{w.uom.toLowerCase() === "gram" ? "" : `${w.qty} ${w.uom} · `}{fmtQty(w.qty_base)} g</p>
                    {correctable && <CorrectButton onClick={() => setFix({ id: w.id, qty: String(w.qty), note: "", wip: true })} label={tr("Correct {0}", w.name)} />}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card flush title={tr("Items")} subtitle={tr("{0} of {1} counted", count.progress.counted, count.progress.lines)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={setQ} placeholder={tr("Search item")} />
              <button type="button" onClick={() => setOnlyFlagged((v) => !v)} aria-pressed={onlyFlagged} className={cx(btn(onlyFlagged ? "solid" : "outline"))}>
                <AlertTriangle size={14} /> {tr("To check")}{count.progress.flagged ? ` (${count.progress.flagged})` : ""}
              </button>
              <button type="button" onClick={() => setHistory((v) => !v)} aria-pressed={history} className={cx(btn(history ? "solid" : "outline"))}>
                <History size={14} /> {tr("History")}
              </button>
            </div>
          }>
          {lines.length === 0 ? <EmptyState icon={<ClipboardList />} title={tr("No item matches")} /> : (
            <>
              {/* phones: one card per item, the tick and Correct big enough to tap */}
              <ul className="divide-y divide-neutral-100 md:hidden">
                {lines.map((l) => (
                  <li key={l.id} className={cx("flex items-start gap-3 px-4 py-3.5", !l.is_current && "bg-neutral-50", picked.has(l.id) && "bg-brand-50/50")}>
                    {reviewable && (l.is_current ? <PickBox checked={picked.has(l.id)} onChange={() => togglePick(l.id)} label={tr("Select {0}", l.item_name)} /> : <span className="w-11 flex-shrink-0" />)}
                    <div className="min-w-0 flex-1">
                      <ItemName l={l} />
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <Qty l={l} count={count} />
                        {correctable && l.is_current && <CorrectButton onClick={() => fixLine(l)} label={tr("Correct {0}", l.item_name)} />}
                      </div>
                      <LineMarks l={l} />
                    </div>
                  </li>
                ))}
              </ul>
              {/* tablets and up: the table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className={kcTable.thead}>
                    <tr>
                      {reviewable && <th className="w-12 px-4 py-2.5"><span className="sr-only">{tr("Recount")}</span></th>}
                      <th className="px-4 py-2.5">{tr("Item")}</th>
                      <th className="px-4 py-2.5">{tr("Area")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Counted")}</th>
                      {dateFields.length > 0 && <th className="px-4 py-2.5">{dateFields.length === 1 ? DATE_FIELD_LABEL[dateFields[0]]() : tr("Date")}</th>}
                      <th className="px-4 py-2.5">{tr("Counted by")}</th>
                      <th className="px-4 py-2.5">{tr("Check")}</th>
                      {correctable && <th className="w-24 px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody className={kcTable.tbody}>
                    {lines.map((l) => {
                      const df = lineDateField(l, count);
                      return (
                        <tr key={l.id} className={cx("align-top transition-colors hover:bg-neutral-50", !l.is_current && "bg-neutral-50 text-neutral-400", picked.has(l.id) && "bg-brand-50/50")}>
                          {reviewable && (
                            <td className="px-4 py-3">
                              {l.is_current && <input type="checkbox" className="h-[18px] w-[18px] cursor-pointer rounded border-neutral-300 accent-brand-700" checked={picked.has(l.id)}
                                onChange={() => togglePick(l.id)} aria-label={tr("Select {0}", l.item_name)} />}
                            </td>
                          )}
                          <td className="max-w-[20rem] px-4 py-3"><ItemName l={l} /></td>
                          <td className="px-4 py-3 text-xs text-neutral-500">{l.area}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right"><Qty l={l} count={count} right /></td>
                          {dateFields.length > 0 && (
                            <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-neutral-700">
                              {df && l[df] ? fmtDay(l[df]!) : <span className="text-neutral-300">—</span>}
                              {df && dateFields.length > 1 && <span className="block text-[10px] text-neutral-400">{DATE_FIELD_LABEL[df]()}</span>}
                            </td>
                          )}
                          <td className="px-4 py-3 text-xs text-neutral-500">{l.counted_by_name ?? "—"}{l.counted_at && <span className="block">{fmtDate(l.counted_at)}</span>}</td>
                          <td className="px-4 py-3"><LineMarks l={l} inline /></td>
                          {correctable && <td className="px-4 py-3 text-right">{l.is_current && <CorrectButton onClick={() => fixLine(l)} label={tr("Correct {0}", l.item_name)} />}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {(count.photos.length > 0 || count.status === "APPROVED" || count.status === "EXPORTED") && (
          <Card flush title={tr("Evidence Photos")} actions={<EvidenceDownloads count={count} />}
            subtitle={tr("{0} photos · time and position recorded by the server; SHA-256 proves the file is unchanged", count.photos.length)}>
            {count.photos.length === 0 ? <p className="px-4 py-6 text-sm text-neutral-500 sm:px-5">{tr("No evidence photos were taken.")}</p> : (
              <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5 lg:grid-cols-6">
                {count.photos.map((ph) => {
                  const item = ph.subject.startsWith("ITEM:") ? count.lines.find((l) => l.item_id === ph.subject.slice(5))?.item_name : null;
                  return (
                    <li key={ph.id} className="min-w-0">
                      <a href={photoUrl(ph.id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-neutral-200">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                        <img src={photoUrl(ph.id)} alt={ph.subject} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                      </a>
                      <p className="mt-1 truncate text-xs font-medium text-neutral-700">{item ?? (ph.subject === "GENERAL" ? tr("Count photo") : ph.subject.replace("AREA:", ""))}</p>
                      <p className="truncate text-[11px] text-neutral-400">{fmtDate(ph.uploaded_at)}{ph.uploaded_by_name ? ` · ${ph.uploaded_by_name}` : ""}</p>
                      <p className="truncate font-mono text-[10px] text-neutral-300" title={ph.sha256}>{ph.sha256.slice(0, 16)}…</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {(count.files?.length ?? 0) > 0 && (
          <Card title={tr("Evidence Files")} subtitle={tr("{0} files attached by the branch · tap to download; also in the ZIP once approved", count.files!.length)}>
            <CountFileList files={count.files!} />
          </Card>
        )}

        <SignatureCard count={count} />
      </div>

      {/* phones and tablets: the review actions in a bar above the bottom menu */}
      {(reviewable || cancellable) && (
        <div className="fixed inset-x-0 z-30 px-3 lg:hidden" style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-md rounded-2xl bg-white/95 p-2 shadow-[0_10px_32px_-8px_rgba(15,23,42,0.28)] ring-1 ring-neutral-200 backdrop-blur">
            <ReviewActions {...actions} bar />
          </div>
        </div>
      )}

      <Drawer open={!!fix && !!fixing} onClose={() => !busy && setFix(null)} size="sm" icon={<Pencil size={18} />} title={tr("Correct quantity")}
        description={fixing ? ("item_name" in fixing ? fixing.item_name : fixing.name) : undefined}
        footer={fix && (
          <>
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setFix(null)} disabled={busy}>{tr("Cancel")}</Button>
            <Button className="flex-1 sm:flex-none" loading={busy} disabled={!fix.note.trim() || !parseQty(fix.qty)} onClick={() => void saveFix()}><Check size={16} /> {tr("Save")}</Button>
          </>
        )}>
        {fix && fixing && (
          <>
            <DrawerSection title={tr("Quantity")}>
              {"item_name" in fixing ? (
                <p className="text-[13px] text-neutral-600">{tr("Entered by the branch")}: <b className="tabular-nums text-neutral-900">{fixing.qty_base === null || fixing.source === "WIP_EXPLODED" ? "—" : `${fmtQty(Number(fixing.qty_base) / factor(fixing))} ${unit(fixing)}`}</b></p>
              ) : (
                <p className="text-[13px] text-neutral-600">{tr("Entered by the branch")}: <b className="tabular-nums text-neutral-900">{fixing.qty} {gramsUnit(fixing)}</b></p>
              )}
              <Field label={tr("Corrected Quantity")} required>
                <div className="flex items-center gap-2">
                  <input autoFocus inputMode="decimal" value={fix.qty} onChange={(e) => setFix({ ...fix, qty: e.target.value })} aria-label={tr("Corrected Quantity")}
                    className={cx(inputClass, "h-12 flex-1 text-right text-lg font-semibold tabular-nums")} />
                  <span className="min-w-[3rem] text-sm font-semibold text-neutral-500">{"item_name" in fixing ? unit(fixing) : gramsUnit(fixing)}</span>
                </div>
              </Field>
              {fix.qty && parseQty(fix.qty) === undefined && <p className="text-xs text-red-600">{tr("Numbers only, at most 2 decimals, e.g. 2 or 1.25")}</p>}
              {"item_name" in fixing && Number(fixing.qty_wip ?? 0) > 0 && (
                <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">{tr("Counted by hand; the {0} {1} from the WIP stay", fmtQty(fixing.qty_wip ?? "0"), fixing.base_uom)}</p>
              )}
              {!("item_name" in fixing) && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">{tr("Only the grams of this premix change on its materials; the items counted by hand stay.")}</p>}
              {fix.field && (
                <Field label={DATE_FIELD_LABEL[fix.field]()}>
                  <input type="date" value={fix.date ?? ""} onChange={(e) => setFix({ ...fix, date: e.target.value })} aria-label={DATE_FIELD_LABEL[fix.field]()} className={cx(inputClass, "h-11")} />
                </Field>
              )}
            </DrawerSection>
            <DrawerSection title={tr("Reason")}>
              <Field label={tr("Reason (required)")} required>
                <textarea value={fix.note} onChange={(e) => setFix({ ...fix, note: e.target.value })} maxLength={500} rows={3} className={cx(inputClass, "h-auto py-2.5")} />
              </Field>
              <p className="text-xs text-neutral-500">{tr("The branch's figure stays in the history with who corrected it, when and why.")}</p>
            </DrawerSection>
          </>
        )}
      </Drawer>

      <ConfirmDialog open={!!action} busy={busy} onClose={() => setAction(null)} onConfirm={run} danger={action === "CANCEL"} reasonRequired={action !== "APPROVE"}
        reasonLabel={action === "APPROVE" ? tr("Note (optional)") : tr("Reason (required)")}
        title={action === "APPROVE" ? tr("Approve this count?") : action === "RECOUNT" ? (selected ? tr("Ask to recount {0} lines?", selected) : tr("Ask to recount every line?")) : tr("Cancel this count?")}
        description={action === "APPROVE" ? tr("Approved counts become the final quantities for the ESB import and the comparison.")
          : action === "RECOUNT" ? tr("The crew counts these lines again; the first values stay in the history.") : tr("The count is cancelled and can be started again.")}
        confirmLabel={action === "APPROVE" ? tr("Approve") : action === "RECOUNT" ? tr("Request recount") : tr("Cancel count")} />
    </div>
  );
}

/** Where the count is in its flow (counting → sent → review → approved → ESB), who acts now and what comes next. */
function FlowBanner({ count, reviewable }: { count: Count; reviewable: boolean }) {
  const recountItems = count.lines.filter((l) => l.is_current && l.flags.includes("RECOUNT")).length;
  const recountWip = count.wip?.lines.filter((w) => w.flags?.includes("RECOUNT")).length ?? 0;
  const STEPS = [
    { key: "IN_PROGRESS", label: tr("Counting") }, { key: "SUBMITTED", label: tr("Sent") }, { key: "REVIEW", label: tr("Review") },
    { key: "APPROVED", label: tr("Approved") }, { key: "EXPORTED", label: tr("In ESB") },
  ];
  const at = { IN_PROGRESS: 0, SUBMITTED: 2, RECOUNT_REQUESTED: 0, APPROVED: 3, EXPORTED: 4, CANCELLED: -1 }[count.status] ?? 0;
  const text: Record<string, { tone: string; title: string; body: string }> = {
    IN_PROGRESS: { tone: "border-brand-100 bg-brand-50/60 text-brand-900", title: tr("The branch is still counting"),
      body: tr("{0} of {1} lines counted so far. The review opens once the branch sends the count.", count.progress.counted, count.progress.lines) },
    SUBMITTED: { tone: "border-violet-200 bg-violet-50 text-violet-900", title: reviewable ? tr("Waiting for your review") : tr("Waiting for the review of Cost Control"),
      body: tr("Check the lines, correct a figure if needed, then approve it or ask the branch to recount chosen lines.") },
    RECOUNT_REQUESTED: { tone: "border-amber-200 bg-amber-50 text-amber-900", title: tr("Waiting for the recount of the branch"),
      body: [recountItems ? tr("{0} materials to count again by hand", recountItems) : "", recountWip ? tr("{0} premixes to count again", recountWip) : ""].filter(Boolean).join(" · ")
        + (recountItems || recountWip ? ". " : "") + tr("The branch sees them marked Recount in Operations; once it sends again the count comes back here for review.") },
    APPROVED: { tone: "border-emerald-200 bg-emerald-50 text-emerald-900", title: tr("Approved"),
      body: tr("These are the final quantities for the ESB import and the comparison. Cost Control can still correct a figure until the ESB export.") },
    EXPORTED: { tone: "border-emerald-200 bg-emerald-50 text-emerald-900", title: tr("Exported to ESB"), body: tr("The count is closed: it can no longer be corrected.") },
    CANCELLED: { tone: "border-neutral-200 bg-neutral-100 text-neutral-700", title: tr("Cancelled"), body: tr("The branch can start this count again.") },
  };
  const t = text[count.status] ?? text.IN_PROGRESS;
  return (
    <section className={cx("rounded-xl border px-4 py-3.5", t.tone)} aria-label={tr("Flow of the count")}>
      <p className="text-sm font-semibold">{t.title}</p>
      <p className="mt-0.5 text-[13px] opacity-90">{t.body}</p>
      {at >= 0 && (
        <ol className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
          {STEPS.map((x, i) => (
            <li key={x.key} className="min-w-0">
              <span className={cx("block h-1.5 rounded-full", i < at ? "bg-current opacity-50" : i === at ? "bg-current" : "bg-current opacity-15")} />
              <span className={cx("mt-1 block truncate text-[10px] font-semibold uppercase tracking-wide", i === at ? "" : "opacity-60")}>{x.label}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Approve / recount / cancel: in the header on desktop, in the bar above the bottom menu on phones (`bar`). */
function ReviewActions({ reviewable, cancellable, selected, onAction, onClear, bar }: {
  reviewable: boolean; cancellable: boolean; selected: number; onAction: (a: Action) => void; onClear: () => void; bar?: boolean;
}) {
  const size = bar ? "h-11 text-sm" : "";
  return (
    <div className={cx("flex items-center gap-2", bar && "w-full")}>
      {cancellable && (
        <button type="button" onClick={() => onAction("CANCEL")} className={cx(btn("ghost"), size, "text-red-600 hover:bg-red-50 hover:text-red-700", bar && "w-11 px-0")} aria-label={tr("Cancel count")} title={tr("Cancel count")}>
          <XCircle size={bar ? 18 : 16} />{!bar && tr("Cancel")}
        </button>
      )}
      {reviewable && selected > 0 && (
        <button type="button" onClick={onClear} className={cx(btn("ghost"), size, "px-2 text-xs")} title={tr("Clear the selection")}>{tr("{0} selected", selected)} ✕</button>
      )}
      {reviewable && (
        <button type="button" onClick={() => onAction("RECOUNT")} className={cx(btn("outline"), size, bar && "flex-1")}>
          <RotateCcw size={16} /> {selected ? tr("Recount {0}", selected) : tr("Recount all")}
        </button>
      )}
      {reviewable && (
        <button type="button" onClick={() => onAction("APPROVE")} className={cx(btn("solid"), size, bar && "flex-1")}>
          <Check size={16} /> {tr("Approve")}
        </button>
      )}
    </div>
  );
}

/** A big tap target holding the recount tick (phones). */
function PickBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="-my-1 -ml-1 flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg active:bg-neutral-100">
      <input type="checkbox" className="h-5 w-5 cursor-pointer rounded border-neutral-300 accent-brand-700" checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}

function CorrectButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cx(btn("outline", "sm"), "text-brand-700")}>
      <Pencil size={13} /> {tr("Correct")}
    </button>
  );
}

function ItemName({ l }: { l: CountLine }) {
  return (
    <>
      <p className={cx("text-sm leading-snug", l.is_current ? "font-medium text-neutral-900" : "text-neutral-400 line-through")}>{l.item_name}</p>
      <p className="mt-0.5 truncate text-[11px] text-neutral-400">
        <span className="font-mono">{l.item_code}</span><span className="md:hidden"> · {l.area}</span>
        {!l.is_current ? ` · ${tr("replaced by recount / correction")}` : ""}
      </p>
    </>
  );
}

function Qty({ l, count, right }: { l: CountLine; count: Count; right?: boolean }) {
  const df = lineDateField(l, count);
  return (
    <div className={cx("min-w-0 tabular-nums", right && "text-right")}>
      {l.qty_base === null || (l.source === "WIP_EXPLODED" && Number(l.qty_base) === 0) ? (
        l.source === "WIP_EXPLODED" ? <span className="text-xs text-neutral-400">{tr("not counted by hand")}</span> : <span className="text-neutral-300">—</span>
      ) : (
        <>
          <span className="text-base font-semibold text-neutral-900 md:text-sm">{fmtQty(Number(l.qty_base) / factor(l))} <span className="text-xs font-medium text-neutral-500">{unit(l)}</span></span>
          {factor(l) !== 1 && <span className="block text-[11px] text-neutral-400">= {fmtQty(l.qty_base)} {l.base_uom}</span>}
        </>
      )}
      {Number(l.qty_wip ?? 0) > 0 && <span className="block text-[11px] text-violet-700">{tr("+ {0} {1} from the WIP", fmtQty(l.qty_wip ?? "0"), l.base_uom)}</span>}
      {l.pack_uom && l.qty_pack !== null && <span className="block text-[11px] text-neutral-400">{fmtQty(l.qty_pack)} × {l.pack_uom} + {fmtQty(l.qty_loose)}</span>}
      {/* phones: the date of the item under its quantity (a column on wider screens) */}
      {df && l[df] && <span className="block text-[11px] text-neutral-500 md:hidden">{DATE_FIELD_LABEL[df]()}: {fmtDay(l[df]!)}</span>}
    </div>
  );
}

function LineMarks({ l, inline }: { l: CountLine; inline?: boolean }) {
  const marks = l.flags.includes("SPIKE") || l.flags.includes("RECOUNT") || l.flags.includes("RECOUNTED") || l.flags.includes("CORRECTED");
  if (!marks) return inline ? <span className="text-xs text-neutral-300">—</span> : null;
  return (
    <div className={cx(!inline && "mt-2")}>
      <div className="flex flex-wrap gap-1">
        {l.flags.includes("SPIKE") && <Badge tone="amber">{tr("×3 vs last count")}</Badge>}
        {l.flags.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
        {l.flags.includes("RECOUNTED") && <Badge tone="green">{tr("Recounted")}</Badge>}
        {l.flags.includes("CORRECTED") && <Badge tone="blue" title={`${l.corrected_by_name ?? ""} · ${l.corrected_at ? fmtDate(l.corrected_at) : ""}`}>{tr("Corrected by Cost Control")}</Badge>}
      </div>
      {l.flags.includes("CORRECTED") && l.correction_note && <p className="mt-1 max-w-[18rem] text-[11px] text-neutral-500">{l.corrected_by_name}: {l.correction_note}</p>}
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-800" title={value}>
        {href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">{value}<ChevronRight size={13} /></a> : value}
      </dd>
    </div>
  );
}

/** Where the counter was: distance to the outlet ± GPS accuracy, the device's time, a map link (06.9 §12.15). */
function Position({ label, lat, lng, distance, accuracy, at, none }: {
  label: string; lat?: number | null; lng?: number | null; distance: number | null; accuracy?: number | string | null; at?: string | null; none: string;
}) {
  if (lat == null || lng == null) return <Info label={label} value={none} />;
  const parts = [distance != null ? `${distance} m` : tr("distance unknown"), accuracy != null ? `±${Math.round(Number(accuracy))} m` : null,
    at ? new Date(at).toLocaleTimeString(locale(), { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) + " WIB" : null].filter(Boolean);
  return <Info label={label} value={parts.join(" · ")} href={mapsUrl(lat, lng)} />;
}
