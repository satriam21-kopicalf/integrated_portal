"use client";

// One count for review: every line with flags and history, then approve, ask for a recount of chosen lines, or cancel.
// The reviewer cannot be one of the counters (D-30): the API refuses it and explains why.

import { AlertTriangle, ArrowLeft, Check, History, Loader2, MapPin, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Panel, SearchBox, cx, fmtDate, fmtDay, theadClass, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { api, errorText } from "@/so/lib/api";
import { type Count, DATE_FIELD_LABEL, ENTRY_SOURCE, STATUS, countTypeLabel, fmtQty, mapsUrl } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { photoUrl } from "@/so/lib/photos";
import { CountFileList, EvidenceDownloads, SignatureCard } from "@/so/features/count/Evidence";

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
  const [action, setAction] = useState<"APPROVE" | "RECOUNT" | "CANCEL" | null>(null);
  const [busy, setBusy] = useState(false);

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

  const run = async (note: string) => {
    if (!action) return;
    setBusy(true);
    try {
      const c = await api<Count>(`/api/so/counts/${id}/review`, {
        method: "POST",
        json: { action, note: note || null, line_ids: action === "RECOUNT" && picked.size ? Array.from(picked) : null },
      });
      setCount(c);
      setPicked(new Set());
      setAction(null);
      toast(action === "APPROVE" ? tr("Count approved") : action === "RECOUNT" ? tr("Recount requested") : tr("Count cancelled"));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="p-4 sm:p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!count) return <div className="flex justify-center p-10 text-slate-400"><Loader2 className="animate-spin" /></div>;
  const st = STATUS[count.status];
  const reviewable = count.status === "SUBMITTED" && can("inventory.count.review");
  const cancellable = ["IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED"].includes(count.status) && can("inventory.count.review");
  const toggle = (lineId: number) => setPicked((s) => { const n = new Set(s); if (n.has(lineId)) n.delete(lineId); else n.add(lineId); return n; });

  return (
    <div className="min-h-full bg-slate-50">
      <header className="px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-start gap-3">
          <Link href="/cost-control/reviews" className="mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-slate-900">{count.facility_name}</h1>
            <p className="text-xs text-slate-500 sm:text-sm">{countTypeLabel(count.count_type, count.count_type_name)} · {fmtDay(count.business_date)} · <span className="font-mono">{count.number}</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={st.tone} dot>{st.label()}</Badge>
              {count.entry_source && count.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[count.entry_source]?.()}</Badge>}
              {count.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
              {count.outside_radius && <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>}
              {count.progress.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} lines to check", count.progress.flagged)}</Badge>}
            </div>
          </div>
          {(reviewable || cancellable) && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {cancellable && <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setAction("CANCEL")}><XCircle size={16} /> {tr("Cancel")}</Button>}
              {reviewable && <Button variant="secondary" onClick={() => setAction("RECOUNT")}><RotateCcw size={16} /> {picked.size ? tr("Recount {0} lines", picked.size) : tr("Recount all")}</Button>}
              {reviewable && <Button onClick={() => setAction("APPROVE")}><Check size={16} /> {tr("Approve")}</Button>}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-sm shadow-sm lg:grid-cols-4">
          <Info label={tr("Started")} value={`${fmtDate(count.started_at)}${count.started_by_name ? ` · ${count.started_by_name}` : ""}`} />
          <Position label={tr("Location at start")} lat={count.start_lat} lng={count.start_lng} distance={count.start_distance_m}
            accuracy={count.start_accuracy_m} at={count.start_located_at} none={count.entry_source && count.entry_source !== "CREW" ? "—" : tr("No location")} />
          <Info label={tr("Submitted")} value={count.submitted_at ? fmtDate(count.submitted_at) : "—"} />
          <Position label={tr("Location at submit")} lat={count.submit_lat} lng={count.submit_lng} distance={count.submit_distance_m}
            accuracy={count.submit_accuracy_m} at={count.submit_located_at} none={count.submitted_at && count.entry_source === "CREW" ? tr("No location") : "—"} />
          <Info label={tr("Outlet location")} value={count.facility_lat != null
            ? `${Number(count.facility_lat).toFixed(5)}, ${Number(count.facility_lng).toFixed(5)} · ${tr("radius {0} m", count.facility_radius_m ?? "")}`
            : tr("No coordinates yet")} href={count.facility_lat != null ? mapsUrl(count.facility_lat, count.facility_lng ?? 0) : "/cost-control/locations"} />
          {count.reviewed_at && <Info label={tr("Reviewed")} value={`${fmtDate(count.reviewed_at)} · ${count.reviewed_by_name ?? ""}`} />}
          {count.review_note && <Info label={tr("Review note")} value={count.review_note} />}
        </dl>

        {(count.photos.length > 0 || count.status === "APPROVED" || count.status === "EXPORTED") && (
          <Panel title={tr("Evidence photos")} actions={<EvidenceDownloads count={count} />}
            description={tr("{0} photos · time and position recorded by the server; SHA-256 proves the file is unchanged", count.photos.length)}>
            {count.photos.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">{tr("No evidence photos were taken.")}</p>}
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
              {count.photos.map((ph) => {
                const item = ph.subject.startsWith("ITEM:") ? count.lines.find((l) => l.item_id === ph.subject.slice(5))?.item_name : null;
                return (
                  <li key={ph.id} className="min-w-0">
                    <a href={photoUrl(ph.id)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                      <img src={photoUrl(ph.id)} alt={ph.subject} loading="lazy" className="aspect-square w-full object-cover" />
                    </a>
                    <p className="mt-1 truncate text-xs font-medium text-slate-700">{item ?? (ph.subject === "GENERAL" ? tr("Count photo") : ph.subject.replace("AREA:", ""))}</p>
                    <p className="truncate text-[11px] text-slate-400">{fmtDate(ph.uploaded_at)}{ph.uploaded_by_name ? ` · ${ph.uploaded_by_name}` : ""}</p>
                    <p className="truncate font-mono text-[10px] text-slate-300" title={ph.sha256}>{ph.sha256.slice(0, 16)}…</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {(count.files?.length ?? 0) > 0 && (
          <Panel title={tr("Evidence files")} description={tr("{0} files attached by the branch · tap to download; also in the ZIP once approved", count.files!.length)}>
            <div className="p-4"><CountFileList files={count.files!} /></div>
          </Panel>
        )}

        <SignatureCard count={count} />

        {(count.wip?.lines.length ?? 0) > 0 && (
          <Panel title={tr("WIP / premix")} description={tr("Grams entered by the branch; for Cost Control only, not in the ESB export")}>
            <ul className="divide-y divide-slate-100">
              {count.wip!.lines.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate"><span className="font-medium text-slate-900">{w.name}</span> <span className="font-mono text-[11px] text-slate-400">{w.code}</span></span>
                  <span className="tabular-nums text-slate-700">{fmtQty(w.qty_base)} g</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchBox value={q} onChange={setQ} placeholder={tr("Search item")} />
            <div className="flex gap-2">
              <Button variant={onlyFlagged ? "primary" : "secondary"} size="sm" onClick={() => setOnlyFlagged((v) => !v)}><AlertTriangle size={14} /> {tr("To check")}</Button>
              <Button variant={history ? "primary" : "secondary"} size="sm" onClick={() => setHistory((v) => !v)}><History size={14} /> {tr("History")}</Button>
            </div>
          </div>
        }
          footer={<span>{tr("{0} of {1} counted", count.progress.counted, count.progress.lines)}{reviewable ? ` · ${tr("Tick lines to recount only those")}` : ""}</span>}>
          <div className="overflow-x-auto">
            <table className="m-cards w-full min-w-[680px] text-sm">
              <thead className={theadClass}>
                <tr>
                  {reviewable && <th className="w-10 px-3 py-2.5" />}
                  <th className="px-3 py-2.5">{tr("Item")}</th>
                  <th className="px-3 py-2.5">{tr("Area")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Counted")}</th>
                  {count.date_field && <th className="px-3 py-2.5">{DATE_FIELD_LABEL[count.date_field]()}</th>}
                  <th className="px-3 py-2.5">{tr("Counted by")}</th>
                  <th className="px-3 py-2.5">{tr("Check")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id} className={cx(!l.is_current && "bg-slate-50 text-slate-400", picked.has(l.id) && "bg-blue-50/50")}>
                    {reviewable && (
                      <td className="px-3 py-2.5">
                        {l.is_current && <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={tr("Select {0}", l.item_name)} />}
                      </td>
                    )}
                    <td className="max-w-[18rem] px-3 py-2.5">
                      <span className={cx("block truncate", l.is_current ? "font-medium text-slate-900" : "line-through")}>{l.item_name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{l.item_code}{!l.is_current ? ` · ${tr("replaced by recount")}` : ""}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{l.area}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {l.qty_base === null ? <span className="text-slate-300">—</span> : (
                        <>
                          <span>{fmtQty(Number(l.qty_base) / (Number(l.esb_factor || 1) || 1))} {l.esb_uom || l.base_uom}</span>
                          {(Number(l.esb_factor || 1) || 1) !== 1 && <span className="block text-[11px] text-slate-400">= {fmtQty(l.qty_base)} {l.base_uom}</span>}
                        </>
                      )}
                      {Number(l.qty_wip ?? 0) > 0 && <span className="block text-[11px] text-violet-700">{tr("+ {0} {1} from the WIP", fmtQty(l.qty_wip ?? "0"), l.base_uom)}</span>}
                      {l.pack_uom && l.qty_pack !== null && <span className="block text-[11px] text-slate-400">{fmtQty(l.qty_pack)} × {l.pack_uom} + {fmtQty(l.qty_loose)}</span>}
                    </td>
                    {count.date_field && <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-700">{l[count.date_field] ? fmtDay(l[count.date_field]!) : <span className="text-slate-300">—</span>}</td>}
                    <td className="px-3 py-2.5 text-xs text-slate-500">{l.counted_by_name ?? "—"}{l.counted_at && <span className="block">{fmtDate(l.counted_at)}</span>}</td>
                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">
                      {l.flags.includes("SPIKE") && <Badge tone="amber">{tr("×3 vs last count")}</Badge>}
                      {l.flags.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <ConfirmDialog open={!!action} busy={busy} onClose={() => setAction(null)} onConfirm={run} danger={action === "CANCEL"}
        reasonLabel={action === "APPROVE" ? tr("Note (optional)") : tr("Reason (required)")}
        title={action === "APPROVE" ? tr("Approve this count?") : action === "RECOUNT" ? (picked.size ? tr("Ask to recount {0} lines?", picked.size) : tr("Ask to recount every line?")) : tr("Cancel this count?")}
        description={action === "APPROVE" ? tr("Approved counts become the final quantities for the ESB import and the comparison.")
          : action === "RECOUNT" ? tr("The crew counts these lines again; the first values stay in the history.") : tr("The count is cancelled and can be started again.")}
        confirmLabel={action === "APPROVE" ? tr("Approve") : action === "RECOUNT" ? tr("Request recount") : tr("Cancel count")} />
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-700" title={value}>
        {href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-blue-700 hover:underline">{value}</a> : value}
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
