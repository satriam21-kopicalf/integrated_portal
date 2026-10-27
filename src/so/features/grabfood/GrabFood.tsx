"use client";

// Rating & Review -> GrabFood (page rating.grabfood), the same file in the portal and in Operations: every Kopi Calf
// outlet on GrabFood, read by the server from the Grab Merchant portal (integrated_portal_be app/grab.py):
//   Outlets  open / closed / paused status (checked every 5 min), official rating, merchant photo, menu availability
//   Reviews  every review, filtered (outlet, stars, photo, reply, text, period) and paged; a preview with its photos
//   Menu     items and add-ons that are out of stock or switched off, per outlet (read every 30 min)
// Only a super admin sees and refreshes the Grab merchant session.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ImageIcon, KeyRound, MapPin, MessageSquareText,
  PackageX, RefreshCw, Search, Star, Store, UtensilsCrossed, X,
} from "lucide-react";
import { Badge, Button, Empty, ErrorState, Page, Panel, cx, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { tr } from "@/lib/i18n";

/* ------------------------------------------------------------------ types */

type Status = { isOpen: boolean | null; label: string | null; isBusy: boolean | null; closeReason: number | null;
  pauseCause: string | null; openUntil: string | null; pauseUntil: string | null; checkedAt: string | null };
type Rating = { score: number | null; count: number | null; distribution: { score: number; countPercentage: number }[] | null; capturedOn: string | null };
type Outlet = {
  merchantId: string; merchantName: string; branchCode: string | null; branchName: string; cityName: string | null; address: string | null;
  photoUrl: string | null; status: Status; rating: Rating;
  reviews30d: { count: number; avg: number | null; low: number; unreplied: number; lastAt: string | null };
  reviewsAll: { count: number; withPhoto: number };
  menu: { outOfStock: number; off: number; syncedAt: string | null };
};
type Session = { present: boolean; valid: boolean; updatedAt?: string | null; updatedBy?: string | null; note?: string | null } | null;
type Aspect = { aspectName: string; rating: number; reason?: string };
type Review = {
  reviewId: string; merchantId: string; branchCode: string | null; branchName: string; createdAt: string | null; rating: number | null;
  description: string | null; orderedItems: string[]; aspects: Aspect[]; hasReply: boolean; serviceType: string | null;
  imageUrls: string[]; eaterName: string | null; orderId: string | null;
};
type ReviewPage = { data: Review[]; total: number; page: number; size: number; counts: { withPhoto: number; unreplied: number; low: number; avg: number | null } };
type MenuItem = { merchantId: string; branchName: string; itemId: string; kind: "item" | "modifier"; name: string; category: string | null;
  itemCode: string | null; price: number | null; imageUrl: string | null; status: "AVAILABLE" | "OUT_OF_STOCK" | "OFF";
  availableAt: string | null; since: string | null };
type Tab = "outlets" | "reviews" | "menu";

const LOGO = "/assets/grabfood.svg";
const PAGE_SIZE = 20;

/* ---------------------------------------------------------------- helpers */

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  return body as T;
}

const timeAgo = (iso?: string | null) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return tr("just now");
  if (m < 60) return tr("{0} min ago", m);
  const h = Math.round(m / 60);
  return h < 24 ? tr("{0} h ago", h) : tr("{0} d ago", Math.round(h / 24));
};
const wib = (iso: string | null, opts: Intl.DateTimeFormatOptions) => iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", ...opts }) : "";
const fmtDay = (iso: string | null) => wib(iso, { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string | null) => wib(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string | null) => wib(iso, { hour: "2-digit", minute: "2-digit" });
const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("id-ID");
const rp = (n: number | null) => n == null ? "" : `Rp${n.toLocaleString("id-ID")}`;
const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Stars({ value, size = 13 }: { value: number | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value == null ? tr("No rating") : tr("{0} of 5 stars", value)}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={cx(value != null && n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-200")} />)}
    </span>
  );
}

function StatusBadge({ s }: { s: Status }) {
  if (s.isOpen == null) return <Badge tone="slate">{tr("Not checked yet")}</Badge>;
  if (!s.isOpen) {
    const until = s.pauseUntil ? ` · ${tr("until {0}", fmtTime(s.pauseUntil))}` : "";
    return <Badge tone="red" icon={<AlertTriangle size={11} />} wrap>{s.label || tr("Closed")}{s.pauseCause ? ` · ${s.pauseCause}` : ""}{until}</Badge>;
  }
  if (s.isBusy) return <Badge tone="amber" icon={<Clock size={11} />}>{tr("Busy")}</Badge>;
  return <Badge tone="green" icon={<CheckCircle2 size={11} />}>{s.label || tr("Open")}</Badge>;
}

/** The merchant photo shown on GrabFood (or the store initial). */
function StorePhoto({ o, size = 44 }: { o: Pick<Outlet, "photoUrl" | "branchName">; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (!o.photoUrl || broken) {
    return <span style={style} className="flex flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">{(o.branchName.replace(/kopi calf( to go)?[\s-]*/i, "")[0] || "K").toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- Grab CDN image, shown as-is
  return <img src={o.photoUrl} alt="" style={style} loading="lazy" onError={() => setBroken(true)} className="flex-shrink-0 rounded-xl border border-slate-200 object-cover" />;
}

function StatTile({ label, value, hint, icon, active, onClick }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; active?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cx("min-w-0 rounded-2xl border bg-white p-3 text-left shadow-sm sm:p-4", active ? "border-blue-300 ring-2 ring-blue-500/20" : "border-slate-200/80",
        onClick && "transition-colors hover:border-blue-200")}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
    </Tag>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx("inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
        on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>{children}</button>
  );
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return <span className="text-xs text-slate-500">{tr("{0} in total", num(total))}</span>;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>{tr("Page {0} of {1} · {2} in total", page, pages, num(total))}</span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tr("Previous page")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={15} /></button>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={tr("Next page")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={15} /></button>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cx(inputCls, "pl-9")} />
    </label>
  );
}

/* ------------------------------------------------------------------- page */

export default function GrabFood() {
  const toast = useToast();
  const [outlets, setOutlets] = useState<Outlet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [tab, setTab] = useState<Tab>("outlets");
  const [reviewOutlet, setReviewOutlet] = useState("");
  const [menuOutlet, setMenuOutlet] = useState("");
  const [open, setOpen] = useState<Outlet | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body = await getJson<{ data: Outlet[]; canEdit: boolean; session: Session }>("/api/rating/grabfood");
      setOutlets(body.data || []);
      setCanEdit(!!body.canEdit);
      setSession(body.session ?? null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5 * 60_000); // the status is checked every 5 minutes
    return () => clearInterval(t);
  }, [load]);

  const all = useMemo(() => outlets ?? [], [outlets]);
  const sum = useMemo(() => {
    const rated = all.filter((o) => o.rating.score != null && o.rating.count);
    const weight = rated.reduce((a, o) => a + (o.rating.count || 0), 0);
    return {
      open: all.filter((o) => o.status.isOpen === true).length,
      closed: all.filter((o) => o.status.isOpen === false).length,
      rating: weight ? rated.reduce((a, o) => a + (o.rating.score || 0) * (o.rating.count || 0), 0) / weight : null,
      reviews: all.reduce((a, o) => a + o.reviewsAll.count, 0),
      unavailable: all.reduce((a, o) => a + o.menu.outOfStock + o.menu.off, 0),
      lastCheck: all.map((o) => o.status.checkedAt).filter(Boolean).sort().pop() ?? null,
    };
  }, [all]);

  const showReviews = (merchantId: string) => { setReviewOutlet(merchantId); setTab("reviews"); setOpen(null); };
  const showMenu = (merchantId: string) => { setMenuOutlet(merchantId); setTab("menu"); setOpen(null); };
  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "outlets", label: tr("Outlets"), icon: <Store size={15} /> },
    { key: "reviews", label: tr("Reviews"), icon: <MessageSquareText size={15} /> },
    { key: "menu", label: tr("Menu"), icon: <UtensilsCrossed size={15} /> },
  ];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
    <Page title={<img src={LOGO} alt="GrabFood" width={160} height={56} className="h-6 w-auto sm:h-7" />}
      subtitle={`${tr("Status, rating, reviews and menu of the outlets on GrabFood")}${sum.lastCheck ? ` · ${tr("status checked {0}", timeAgo(sum.lastCheck))}` : ""}`}
      actions={canEdit ? <Button variant="secondary" onClick={() => setSessionOpen(true)}><KeyRound size={15} /> {tr("Session")}</Button> : undefined}>
      <div className="space-y-4">
        {canEdit && session && <SessionBanner session={session} onRefresh={() => setSessionOpen(true)} />}

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatTile label={tr("Open now")} icon={<Store size={12} />} value={outlets ? `${num(sum.open)} / ${num(all.length)}` : "…"}
            hint={outlets ? tr("{0} closed or paused", num(sum.closed)) : undefined} />
          <StatTile label={tr("Average rating")} icon={<Star size={12} />} value={sum.rating == null ? "—" : sum.rating.toFixed(2)} hint={tr("weighted by the number of ratings")} />
          <StatTile label={tr("Reviews")} icon={<MessageSquareText size={12} />} value={num(sum.reviews)} hint={tr("all outlets")} onClick={() => { setReviewOutlet(""); setTab("reviews"); }} active={tab === "reviews"} />
          <StatTile label={tr("Menu unavailable")} icon={<PackageX size={12} />} value={num(sum.unavailable)} hint={tr("items & add-ons out of stock / off")} onClick={() => { setMenuOutlet(""); setTab("menu"); }} active={tab === "menu"} />
        </div>

        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cx("inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900")}>{t.icon}{t.label}</button>
          ))}
        </div>

        {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel>
          : tab === "outlets" ? <OutletsTab outlets={outlets} onOpen={setOpen} />
          : tab === "reviews" ? <ReviewsTab outlets={all} merchant={reviewOutlet} setMerchant={setReviewOutlet} />
          : <MenuTab outlets={all} merchant={menuOutlet} setMerchant={setMenuOutlet} />}
      </div>

      {open && <OutletDrawer o={open} onClose={() => setOpen(null)} onReviews={() => showReviews(open.merchantId)} onMenu={() => showMenu(open.merchantId)} />}
      {sessionOpen && <SessionDrawer onClose={() => setSessionOpen(false)} onSaved={() => { setSessionOpen(false); toast(tr("Session updated")); void load(); }} />}
    </Page>
  );
}

/* ---------------------------------------------------------------- outlets */

type OutletView = "" | "closed" | "busy" | "low" | "menu" | "unreplied";
const OUTLET_VIEWS: { key: OutletView; label: () => string; test: (o: Outlet) => boolean }[] = [
  { key: "", label: () => tr("All"), test: () => true },
  { key: "closed", label: () => tr("Closed / paused"), test: (o) => o.status.isOpen === false },
  { key: "busy", label: () => tr("Busy"), test: (o) => !!o.status.isBusy },
  { key: "menu", label: () => tr("Menu unavailable"), test: (o) => o.menu.outOfStock + o.menu.off > 0 },
  { key: "low", label: () => tr("≤2★ in 30 days"), test: (o) => o.reviews30d.low > 0 },
  { key: "unreplied", label: () => tr("Not replied"), test: (o) => o.reviews30d.unreplied > 0 },
];

function OutletsTab({ outlets, onOpen }: { outlets: Outlet[] | null; onOpen: (o: Outlet) => void }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<OutletView>("");
  const [page, setPage] = useState(1);
  const all = outlets ?? [];
  const rows = all.filter((o) => (OUTLET_VIEWS.find((v) => v.key === view)!.test(o))
    && (!q.trim() || `${o.branchName} ${o.merchantName} ${o.cityName ?? ""} ${o.branchCode ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / 24));
  useEffect(() => setPage(1), [q, view]);
  const shown = rows.slice((page - 1) * 24, page * 24);

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <SearchInput value={q} onChange={setQ} placeholder={tr("Search outlet, city or branch code")} />
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {OUTLET_VIEWS.map((v) => <Chip key={v.key} on={view === v.key} onClick={() => setView(v.key)}>{v.label()}{v.key && outlets ? ` (${all.filter(v.test).length})` : ""}</Chip>)}
        </div>
      </div>
      {outlets === null ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <Panel><Empty icon={<Store size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No GrabFood outlet yet")} /></Panel>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((o) => <li key={o.merchantId}><OutletCard o={o} onOpen={() => onOpen(o)} /></li>)}
          </ul>
          <div className="flex justify-end"><Pager page={page} pages={pages} total={rows.length} onPage={setPage} /></div>
        </>
      )}
    </div>
  );
}

function OutletCard({ o, onOpen }: { o: Outlet; onOpen: () => void }) {
  const unavailable = o.menu.outOfStock + o.menu.off;
  return (
    <button type="button" onClick={onOpen}
      className="flex h-full w-full flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex items-start gap-3">
        <StorePhoto o={o} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900" title={o.branchName}>{o.branchName}</p>
          <p className="truncate text-xs text-slate-500">{[o.cityName, o.branchCode ?? tr("not mapped to a branch")].filter(Boolean).join(" · ")}</p>
          <div className="mt-1.5"><StatusBadge s={o.status} /></div>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Star size={18} className="fill-amber-400 text-amber-400" />
          <span className="text-xl font-bold tabular-nums text-slate-900">{o.rating.score != null ? o.rating.score.toFixed(2) : "—"}</span>
          {o.rating.count != null && <span className="text-xs text-slate-500">({num(o.rating.count)})</span>}
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 text-xs">
          {unavailable > 0 && <Badge tone="amber" icon={<PackageX size={11} />}>{tr("{0} unavailable", unavailable)}</Badge>}
          {o.reviews30d.low > 0 && <Badge tone="red" dot>{tr("{0} ≤2★", o.reviews30d.low)}</Badge>}
          <span className="inline-flex items-center gap-1 text-slate-500"><MessageSquareText size={13} /> {num(o.reviewsAll.count)}</span>
        </div>
      </div>
    </button>
  );
}

function OutletDrawer({ o, onClose, onReviews, onMenu }: { o: Outlet; onClose: () => void; onReviews: () => void; onMenu: () => void }) {
  const dist = [...(o.rating.distribution ?? [])].sort((a, b) => b.score - a.score);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  useEffect(() => {
    getJson<{ data: MenuItem[] }>(`/api/rating/grabfood/menu?merchant=${encodeURIComponent(o.merchantId)}`).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [o.merchantId]);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Store size={18} />} title={o.branchName}
      description={o.merchantName !== o.branchName ? `GrabFood: ${o.merchantName}` : (o.branchCode ?? o.merchantId)} focusFirstField={false}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <StorePhoto o={o} size={64} />
          <div className="min-w-0 space-y-1">
            <StatusBadge s={o.status} />
            <p className="text-xs text-slate-500">
              {o.status.isOpen && o.status.openUntil ? `${tr("open until {0}", fmtTime(o.status.openUntil))} · ` : ""}
              {o.status.checkedAt ? tr("checked {0}", timeAgo(o.status.checkedAt)) : tr("Not checked yet")}
            </p>
          </div>
        </div>
        {o.address && <p className="flex items-start gap-1.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{o.address}</p>}

        <section className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{o.rating.score != null ? o.rating.score.toFixed(2) : "—"}</span>
            <div><Stars value={o.rating.score} size={15} /><p className="text-xs text-slate-500">{o.rating.count != null ? tr("{0} ratings", num(o.rating.count)) : tr("No rating yet")}</p></div>
          </div>
          {dist.length > 0 && (
            <ul className="mt-3 space-y-1">
              {dist.map((d) => (
                <li key={d.score} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-6 tabular-nums">{d.score}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, d.countPercentage)}%` }} /></span>
                  <span className="w-10 text-right tabular-nums">{Math.round(d.countPercentage)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onReviews} className="rounded-xl border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40">
            <p className="text-xs text-slate-500">{tr("Reviews")}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{num(o.reviewsAll.count)}</p>
            <p className="text-[11px] text-slate-500">{tr("{0} with photos", num(o.reviewsAll.withPhoto))} · {tr("{0} in 30 days", num(o.reviews30d.count))}</p>
          </button>
          <button type="button" onClick={onMenu} className="rounded-xl border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40">
            <p className="text-xs text-slate-500">{tr("Menu unavailable")}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{num(o.menu.outOfStock + o.menu.off)}</p>
            <p className="text-[11px] text-slate-500">{o.menu.syncedAt ? tr("menu read {0}", timeAgo(o.menu.syncedAt)) : tr("menu not read yet")}</p>
          </button>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Out of stock / switched off")}</h3>
          {items === null ? <div className="skeleton h-16 rounded-xl" /> : items.length === 0
            ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">{tr("Everything on the menu is available")}</p>
            : <MenuList items={items} showOutlet={false} />}
        </section>
        <Button className="w-full" onClick={onReviews}><MessageSquareText size={15} /> {tr("Read all reviews of this outlet")}</Button>
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- reviews */

function ReviewsTab({ outlets, merchant, setMerchant }: { outlets: Outlet[]; merchant: string; setMerchant: (v: string) => void }) {
  const [stars, setStars] = useState<number[]>([]);
  const [photo, setPhoto] = useState(false);
  const [unreplied, setUnreplied] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<ReviewPage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Review | null>(null);

  useEffect(() => { const t = setTimeout(() => setQDebounced(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [merchant, stars, photo, unreplied, qDebounced, from, to]);
  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (merchant) p.set("merchant", merchant);
    if (stars.length) p.set("rating", [...stars].sort().join(","));
    if (photo) p.set("photo", "true");
    if (unreplied) p.set("replied", "false");
    if (qDebounced.trim()) p.set("q", qDebounced.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    let live = true;
    setErr(null);
    getJson<ReviewPage>(`/api/rating/grabfood/reviews?${p}`).then((r) => live && setRes(r)).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [merchant, stars, photo, unreplied, qDebounced, from, to, page]);

  const toggleStar = (n: number) => setStars((s) => s.includes(n) ? s.filter((x) => x !== n) : [...s, n]);
  const pages = res ? Math.max(1, Math.ceil(res.total / res.size)) : 1;
  const filtered = !!(merchant || stars.length || photo || unreplied || q || from || to);

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={merchant} onChange={(e) => setMerchant(e.target.value)} aria-label={tr("Outlet")} className={cx(inputCls, "sm:max-w-xs")}>
            <option value="">{tr("All outlets")}</option>
            {outlets.map((o) => <option key={o.merchantId} value={o.merchantId}>{o.branchName}</option>)}
          </select>
          <SearchInput value={q} onChange={setQ} placeholder={tr("Search review text, item, customer or order")} />
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          {[5, 4, 3, 2, 1].map((n) => <Chip key={n} on={stars.includes(n)} onClick={() => toggleStar(n)}>{n}<Star size={11} className={stars.includes(n) ? "fill-white" : "fill-amber-400 text-amber-400"} /></Chip>)}
          <span className="mx-1 h-5 w-px flex-shrink-0 bg-slate-200" />
          <Chip on={photo} onClick={() => setPhoto((v) => !v)}><ImageIcon size={12} /> {tr("With photo")}</Chip>
          <Chip on={unreplied} onClick={() => setUnreplied((v) => !v)}>{tr("Not replied")}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <CalendarDays size={14} />
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label={tr("From")} className={cx(inputCls, "h-9 w-auto")} />
          <span>–</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label={tr("To")} className={cx(inputCls, "h-9 w-auto")} />
          {filtered && <button type="button" className="ml-auto font-medium text-blue-700 hover:underline"
            onClick={() => { setMerchant(""); setStars([]); setPhoto(false); setUnreplied(false); setQ(""); setFrom(""); setTo(""); }}>{tr("Clear filters")}</button>}
        </div>
      </div>

      {res && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
          <span><b className="text-slate-800">{num(res.total)}</b> {tr("reviews")}</span>
          {res.counts.avg != null && <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /> {res.counts.avg.toFixed(2)} {tr("average")}</span>}
          <span className="inline-flex items-center gap-1"><ImageIcon size={12} /> {num(res.counts.withPhoto)} {tr("with photos")}</span>
          <span>{num(res.counts.unreplied)} {tr("not replied")}</span>
          <span className="text-red-600">{num(res.counts.low)} ≤2★</span>
        </div>
      )}

      {err ? <Panel><ErrorState message={err} /></Panel>
        : res === null ? <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
        : res.data.length === 0 ? <Panel><Empty icon={<MessageSquareText size={28} />} title={filtered ? tr("No review matches the filters") : tr("No review yet")} /></Panel>
        : (
          <>
            <ul className="space-y-2">{res.data.map((r) => <li key={r.reviewId}><ReviewCard r={r} showOutlet={!merchant} onOpen={() => setPreview(r)} /></li>)}</ul>
            <div className="flex justify-end"><Pager page={res.page} pages={pages} total={res.total} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} /></div>
          </>
        )}
      {preview && <ReviewPreview r={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ReviewCard({ r, showOutlet, onOpen }: { r: Review; showOutlet: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}
      className={cx("flex w-full gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30 sm:p-4",
        (r.rating ?? 5) <= 2 ? "border-red-200" : "border-slate-200/80")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Stars value={r.rating} />
          <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span>
          {r.hasReply ? <Badge tone="green">{tr("replied")}</Badge> : <Badge tone="blue" dot>{tr("not replied")}</Badge>}
        </div>
        {showOutlet && <p className="mt-1 truncate text-xs font-medium text-slate-600">{r.branchName}</p>}
        <p className={cx("mt-1 line-clamp-3 text-sm", r.description ? "text-slate-800" : "italic text-slate-400")}>{r.description || tr("No written review (stars only)")}</p>
        {r.orderedItems.length > 0 && <p className="mt-1 truncate text-xs text-slate-400">{r.orderedItems.join(" · ")}</p>}
      </div>
      {r.imageUrls.length > 0 && (
        <span className="relative flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- Grab CDN photo of the customer */}
          <img src={r.imageUrls[0]} alt="" loading="lazy" className="h-16 w-16 rounded-xl border border-slate-200 object-cover sm:h-20 sm:w-20" />
          {r.imageUrls.length > 1 && <span className="absolute bottom-1 right-1 rounded-md bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">+{r.imageUrls.length - 1}</span>}
        </span>
      )}
    </button>
  );
}

function ReviewPreview({ r, onClose }: { r: Review; onClose: () => void }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const aspects = r.aspects.filter((a) => a.aspectName);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MessageSquareText size={18} />} title={r.branchName}
      description={fmtDateTime(r.createdAt)} focusFirstField={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={r.rating} size={18} />
          <span className="text-sm font-semibold text-slate-800">{r.rating ?? "—"}/5</span>
          {r.hasReply ? <Badge tone="green">{tr("replied")}</Badge> : <Badge tone="blue" dot>{tr("not replied")}</Badge>}
          {r.serviceType && <Badge>{r.serviceType}</Badge>}
        </div>
        <blockquote className={cx("whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-relaxed", r.description ? "text-slate-800" : "italic text-slate-400")}>
          {r.description || tr("No written review (stars only)")}
        </blockquote>

        {r.imageUrls.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Photos ({0})", r.imageUrls.length)}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {r.imageUrls.map((u, i) => (
                <button key={u} type="button" onClick={() => setZoom(i)} className="overflow-hidden rounded-xl border border-slate-200" aria-label={tr("Open photo {0}", i + 1)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Grab CDN photo of the customer */}
                  <img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                </button>
              ))}
            </div>
          </section>
        )}

        {aspects.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("What the customer mentions")}</h3>
            <ul className="space-y-1.5">
              {aspects.map((a, i) => (
                <li key={`${a.aspectName}-${i}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{a.aspectName}</span>
                  {a.rating > 0 && <span className={cx("ml-2 text-xs", a.rating <= 2 ? "text-red-600" : "text-slate-500")}>{a.rating}★</span>}
                  {a.reason && <p className="text-xs text-slate-500">“{a.reason}”</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {r.orderedItems.length > 0 && <Row k={tr("Ordered")} v={r.orderedItems.join(", ")} />}
          {r.eaterName && <Row k={tr("Customer")} v={r.eaterName} />}
          {r.orderId && <Row k={tr("Order")} v={<span className="font-mono text-xs">{r.orderId}</span>} />}
        </dl>
      </div>
      {zoom !== null && <Lightbox urls={r.imageUrls} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />}
    </Drawer>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex gap-3 px-3 py-2"><dt className="w-24 flex-shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 flex-1 break-words text-slate-800">{v}</dd></div>;
}

function Lightbox({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "ArrowRight" && index < urls.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [index, urls.length, onIndex, onClose]);
  const nav = "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-30";
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label={tr("Photo")} onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Grab CDN photo of the customer */}
      <img src={urls[index]} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" onClick={onClose} aria-label={tr("Close")} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><X size={20} /></button>
      {urls.length > 1 && <>
        <button type="button" disabled={index === 0} onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} aria-label={tr("Previous photo")} className={cx(nav, "left-3")}><ChevronLeft size={22} /></button>
        <button type="button" disabled={index === urls.length - 1} onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} aria-label={tr("Next photo")} className={cx(nav, "right-3")}><ChevronRight size={22} /></button>
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">{index + 1} / {urls.length}</span>
      </>}
      <a href={urls[index]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 rounded-full bg-white/15 px-3 py-1 text-xs text-white hover:bg-white/25">{tr("Open original")}</a>
    </div>
  );
}

/* ------------------------------------------------------------------- menu */

const MENU_LABEL: Record<MenuItem["status"], () => string> = {
  AVAILABLE: () => tr("Available"), OUT_OF_STOCK: () => tr("Out of stock"), OFF: () => tr("Switched off"),
};

function MenuTab({ outlets, merchant, setMerchant }: { outlets: Outlet[]; merchant: string; setMerchant: (v: string) => void }) {
  const [status, setStatus] = useState<"unavailable" | "OUT_OF_STOCK" | "OFF" | "all">("unavailable");
  const [kind, setKind] = useState<"" | "item" | "modifier">("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams({ status });
    if (merchant) p.set("merchant", merchant);
    if (kind) p.set("kind", kind);
    let live = true;
    setItems(null); setErr(null);
    getJson<{ data: MenuItem[] }>(`/api/rating/grabfood/menu?${p}`).then((r) => live && setItems(r.data)).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [merchant, status, kind]);
  const shown = (items ?? []).filter((i) => !q.trim() || `${i.name} ${i.category ?? ""} ${i.itemCode ?? ""} ${i.branchName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const lastRead = outlets.map((o) => o.menu.syncedAt).filter(Boolean).sort().pop() ?? null;
  // the outlets not read yet are not "all available": say so
  const neverRead = outlets.filter((o) => !o.menu.syncedAt).length;

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={merchant} onChange={(e) => setMerchant(e.target.value)} aria-label={tr("Outlet")} className={cx(inputCls, "sm:max-w-xs")}>
            <option value="">{tr("All outlets")}</option>
            {outlets.map((o) => <option key={o.merchantId} value={o.merchantId}>{o.branchName}</option>)}
          </select>
          <SearchInput value={q} onChange={setQ} placeholder={tr("Search menu item, category or code")} />
        </div>
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Chip on={status === "unavailable"} onClick={() => setStatus("unavailable")}>{tr("All unavailable")}</Chip>
          <Chip on={status === "OUT_OF_STOCK"} onClick={() => setStatus("OUT_OF_STOCK")}>{tr("Out of stock")}</Chip>
          <Chip on={status === "OFF"} onClick={() => setStatus("OFF")}>{tr("Switched off")}</Chip>
          {merchant && <Chip on={status === "all"} onClick={() => setStatus("all")}>{tr("Whole menu")}</Chip>}
          <span className="mx-1 h-5 w-px flex-shrink-0 bg-slate-200" />
          <Chip on={kind === "item"} onClick={() => setKind(kind === "item" ? "" : "item")}>{tr("Items")}</Chip>
          <Chip on={kind === "modifier"} onClick={() => setKind(kind === "modifier" ? "" : "modifier")}>{tr("Add-ons")}</Chip>
        </div>
        <p className="text-[11px] text-slate-400">
          {lastRead ? tr("Menus are read from Grab every 30 minutes · last read {0}", timeAgo(lastRead)) : tr("Menus are read from Grab every 30 minutes")}
          {neverRead > 0 ? ` · ${tr("{0} outlets not read yet", neverRead)}` : ""}
        </p>
      </div>
      {err ? <Panel><ErrorState message={err} /></Panel>
        : items === null ? <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        : shown.length === 0 ? <Panel><Empty icon={<PackageX size={28} />} title={status === "all" ? tr("No menu read yet") : tr("Nothing is out of stock or switched off")} /></Panel>
        : <MenuList items={shown} showOutlet={!merchant} />}
    </div>
  );
}

function MenuList({ items, showOutlet }: { items: MenuItem[]; showOutlet: boolean }) {
  const groups = useMemo(() => {
    const g = new Map<string, MenuItem[]>();
    for (const i of items) {
      const key = showOutlet ? i.branchName : (i.kind === "modifier" ? `${tr("Add-ons")} · ${i.category ?? ""}` : (i.category ?? tr("Other")));
      g.set(key, [...(g.get(key) ?? []), i]);
    }
    return [...g.entries()];
  }, [items, showOutlet]);
  return (
    <div className="space-y-3">
      {groups.map(([title, rows]) => (
        <section key={title} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <h4 className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700">
            <span className="truncate">{title}</span><span className="flex-shrink-0 font-normal text-slate-400">{rows.length}</span>
          </h4>
          <ul className="divide-y divide-slate-100">
            {rows.map((i) => (
              <li key={`${i.merchantId}-${i.itemId}`} className="flex items-center gap-3 px-3 py-2.5">
                {i.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element -- Grab CDN menu photo
                  ? <img src={i.imageUrl} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-lg border border-slate-200 object-cover" />
                  : <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><UtensilsCrossed size={16} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {[i.kind === "modifier" ? tr("Add-on") : null, showOutlet ? i.category : null, i.itemCode, rp(i.price)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <Badge tone={i.status === "AVAILABLE" ? "green" : i.status === "OUT_OF_STOCK" ? "amber" : "red"}>{MENU_LABEL[i.status]()}</Badge>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {i.status === "OUT_OF_STOCK" && i.availableAt ? tr("back {0}", fmtDateTime(i.availableAt)) : i.status !== "AVAILABLE" && i.since ? tr("since {0}", fmtDay(i.since)) : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- session */

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

function SessionDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await getJson("/api/rating/grabfood/session", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cookie: cookie.trim() }) });
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
      <p className="mt-2 text-[11px] text-slate-400">{tr("The cookie is stored on the server for the sync only. Logging out of merchant.grab.com ends the session; refresh it here when it expires.")}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={saving} disabled={cookie.trim().length < 20} onClick={() => void save()}>{tr("Save session")}</Button>
      </div>
    </Drawer>
  );
}
