"use client";

// Rating & Review -> Online Delivery (GrabFood): per outlet, the live open/close status, the official rating and a
// summary of recent reviews, read by the server from the Grab Merchant portal (app/grab.py). A super admin refreshes
// the merchant session here when it expires. Click an outlet to read its reviews.

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Clock, KeyRound, MessageSquareText, RefreshCw, Star, Store } from "lucide-react";
import { Badge, Button, Empty, ErrorState, Page, Panel, SkeletonRows, cx, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { assetUrl } from "@/lib/assets";
import { tr } from "@/lib/i18n";

type Status = { isOpen: boolean | null; label: string | null; isBusy: boolean | null; closeReason: number | null;
  pauseCause: string | null; openUntil: string | null; checkedAt: string | null };
type Rating = { score: number | null; count: number | null; distribution: { score: number; countPercentage: number }[] | null; capturedOn: string | null };
type Reviews30d = { count: number; avg: number | null; low: number; unreplied: number; lastAt: string | null };
type Outlet = { merchantId: string; branchCode: string | null; branchName: string; cityName: string | null;
  status: Status; rating: Rating; reviews30d: Reviews30d };
type Session = { present: boolean; valid: boolean; updatedAt?: string | null; updatedBy?: string | null; note?: string | null } | null;
type Review = { createdAt: string | null; rating: number | null; description: string | null; orderedItems: string[] | null;
  aspects: { aspectName: string; rating: number; reason?: string }[] | null; hasReply: boolean; serviceType: string | null;
  imageUrls: string[] | null; branchName: string | null };

const timeAgo = (iso?: string | null) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return tr("just now");
  if (m < 60) return tr("{0} min ago", m);
  const h = Math.round(m / 60);
  return h < 24 ? tr("{0} h ago", h) : tr("{0} d ago", Math.round(h / 24));
};

export default function GrabFood() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Outlet[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [view, setView] = useState<Outlet | null>(null);
  const [refreshOpen, setRefreshOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/rating/grabfood", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body.data || []);
      setCanEdit(!!body.canEdit);
      setSession(body.session ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const logo = <Image src={assetUrl("assets/grabfood.svg")} alt="GrabFood" width={120} height={20} className="h-5 w-auto" unoptimized />;

  return (
    <Page title={logo} subtitle={tr("Open/close status, rating and reviews of your outlets on GrabFood")}
      actions={canEdit ? <Button variant="secondary" onClick={() => setRefreshOpen(true)}><KeyRound size={15} /> {tr("Session")}</Button> : undefined}>
      <div className="mx-auto max-w-5xl space-y-4">
        {canEdit && session && <SessionBanner session={session} onRefresh={() => setRefreshOpen(true)} />}

        {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div>
          : loading ? <Panel><table className="w-full"><tbody><SkeletonRows cols={4} /></tbody></table></Panel>
          : data.length === 0 ? <Panel><Empty icon={<Store size={28} />} title={tr("No GrabFood outlet yet")}>{tr("Outlets are added as the sync maps them to your branches.")}</Empty></Panel>
          : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.map((o) => <li key={o.merchantId}><OutletCard o={o} onOpen={() => setView(o)} /></li>)}
            </ul>
          )}
      </div>

      {view && <ReviewsDrawer outlet={view} onClose={() => setView(null)} />}
      {refreshOpen && <SessionDrawer onClose={() => setRefreshOpen(false)} onSaved={() => { setRefreshOpen(false); toast(tr("Session updated")); void load(); }} />}
    </Page>
  );
}

function statusBadge(s: Status) {
  if (s.isOpen == null) return <Badge tone="slate">{tr("Unknown")}</Badge>;
  if (!s.isOpen) return <Badge tone="red" icon={<AlertTriangle size={11} />}>{s.label || tr("Closed")}{s.pauseCause ? ` · ${s.pauseCause}` : ""}</Badge>;
  if (s.isBusy) return <Badge tone="amber" icon={<Clock size={11} />}>{tr("Busy")}</Badge>;
  return <Badge tone="green" icon={<CheckCircle2 size={11} />}>{s.label || tr("Open")}</Badge>;
}

function OutletCard({ o, onOpen }: { o: Outlet; onOpen: () => void }) {
  const r = o.rating, rv = o.reviews30d;
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{o.branchName}</p>
          <p className="truncate text-xs text-slate-500">{o.cityName || o.merchantId}</p>
        </div>
        {statusBadge(o.status)}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Star size={18} className="fill-amber-400 text-amber-400" />
          <span className="text-xl font-bold tabular-nums text-slate-900">{r.score != null ? r.score.toFixed(2) : "—"}</span>
          <span className="text-xs text-slate-500">{r.count != null ? tr("({0} ratings)", r.count.toLocaleString()) : ""}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {rv.unreplied > 0 && <Badge tone="blue">{tr("{0} to reply", rv.unreplied)}</Badge>}
          {rv.low > 0 && <Badge tone="red" dot>{tr("{0} ≤2★ (30d)", rv.low)}</Badge>}
          <span className="inline-flex items-center gap-1 text-slate-500"><MessageSquareText size={13} /> {rv.count}</span>
        </div>
      </div>
      {o.status.openUntil && o.status.isOpen && <p className="text-[11px] text-slate-400">{tr("open until {0}", new Date(o.status.openUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }))} · {tr("checked {0}", timeAgo(o.status.checkedAt))}</p>}
    </button>
  );
}

function SessionBanner({ session, onRefresh }: { session: NonNullable<Session>; onRefresh: () => void }) {
  const ok = session.present && session.valid;
  return (
    <div className={cx("flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm", ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900")}>
      {ok ? <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className="flex-shrink-0 text-amber-600" />}
      <span className="min-w-0 flex-1">
        {ok ? tr("Grab session active") : session.present ? tr("Grab session expired — refresh it to resume updates") : tr("No Grab session yet — add one to start")}
        {session.updatedAt && <span className="text-xs opacity-80"> · {tr("updated {0}", timeAgo(session.updatedAt))}{session.updatedBy ? ` ${tr("by {0}", session.updatedBy)}` : ""}</span>}
      </span>
      {!ok && <Button size="sm" onClick={onRefresh}><RefreshCw size={13} /> {tr("Refresh")}</Button>}
    </div>
  );
}

function ReviewsDrawer({ outlet, onClose }: { outlet: Outlet; onClose: () => void }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!outlet.branchCode) { setRows([]); return; }
    fetch(`/api/rating/grabfood/${encodeURIComponent(outlet.branchCode)}/reviews`, { cache: "no-store" })
      .then((r) => r.json()).then((b) => setRows(b.data || [])).catch((e) => setErr(e.message));
  }, [outlet.branchCode]);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MessageSquareText size={18} />} title={outlet.branchName}
      description={tr("GrabFood reviews · rating {0}", outlet.rating.score != null ? outlet.rating.score.toFixed(2) : "—")} focusFirstField={false}>
      {err ? <ErrorState message={err} /> : rows === null ? <div className="space-y-2"><div className="skeleton h-20 rounded-xl" /><div className="skeleton h-20 rounded-xl" /></div>
        : rows.length === 0 ? <Empty title={tr("No reviews with text")} />
        : (
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={i} className="rounded-xl border border-slate-200/80 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={cx(n <= (r.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}
                    <span className="ml-1 text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                  </span>
                  {r.hasReply ? <Badge tone="green">{tr("replied")}</Badge> : <Badge tone="blue" dot>{tr("not replied")}</Badge>}
                </div>
                {r.description && <p className="mt-1.5 text-sm text-slate-700">{r.description}</p>}
                {r.orderedItems && r.orderedItems.length > 0 && <p className="mt-1 text-xs text-slate-400">{r.orderedItems.join(" · ")}</p>}
                {r.aspects && r.aspects.filter((a) => a.rating).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">{r.aspects.filter((a) => a.rating).map((a) => <Badge key={a.aspectName} tone={a.rating <= 2 ? "red" : "slate"}>{a.aspectName}: {a.rating}★</Badge>)}</div>
                )}
              </li>
            ))}
          </ul>
        )}
    </Drawer>
  );
}

function SessionDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/rating/grabfood/session", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cookie: cookie.trim() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} size="md" icon={<KeyRound size={18} />} title={tr("Refresh Grab session")}
      description={tr("Paste the merchant cookie from the Grab portal")} focusFirstField={false}>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
        <li>{tr("Log in to merchant.grab.com in Chrome.")}</li>
        <li>{tr("Press F12 → Network, click any request, open Headers.")}</li>
        <li>{tr("Copy the whole value of the \"cookie:\" line and paste it below.")}</li>
      </ol>
      <textarea value={cookie} onChange={(e) => setCookie(e.target.value)} rows={6} spellCheck={false}
        placeholder="_gcl_au=...; mexusers_authn_token=...; ..."
        className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      <p className="mt-2 text-[11px] text-slate-400">{tr("The cookie is stored on the server for the sync only. The session lasts about 2 days; refresh it here when it expires.")}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={saving} disabled={cookie.trim().length < 20} onClick={() => void save()}>{tr("Save session")}</Button>
      </div>
    </Drawer>
  );
}
