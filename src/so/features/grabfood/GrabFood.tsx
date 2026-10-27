"use client";

// Rating & Review → GrabFood (page rating.grabfood), the same file in the portal and in Operations, laid out like the
// Google Maps page (summary band, one panel with search + filters, a table on desktop and a list on phones, a drawer
// per outlet). Data from the Grab Merchant portal (integrated_portal_be app/grab.py):
//   Outlets  open / paused / closed status (checked every 5 min), official rating, merchant photo, menu availability
//   Reviews  every review, filtered (outlet, stars, photo, reply, period) and paged; a preview with its photos
//   Menu     items and add-ons out of stock today or switched off, per outlet (read every 30 min)
// Only a super admin sees the Grab merchant session and maps an outlet to its ESB branch.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ChevronLeft, ChevronRight, ImageIcon, KeyRound, Link2, MapPin, MessageSquareText, PackageX, Star, Store,
  UtensilsCrossed, X,
} from "lucide-react";
import {
  Badge, Button, Empty, ErrorState, Input, Page, PageNav, Panel, SkeletonRows, type Tone, cx, fmtNumber, theadClass, usePaged, useToast,
} from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import { SearchChoice } from "@/so/ui/FilterControls";
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
  /** weekly opening hours on Grab (Sunday first), today's, and the minutes closed during them today */
  hours: { week: Range[][]; today: Range[]; shouldBeOpen: boolean | null; closedInHours: boolean; closedMinutesToday: number | null;
    closePeriodStart: string | null; closePeriodEnd: string | null };
};
type Range = { start: string; end: string };
type Session = { present: boolean; valid: boolean; updatedAt?: string | null; updatedBy?: string | null; note?: string | null } | null;
type Result = { canEdit: boolean; session: Session; data: Outlet[] };
type Aspect = { aspectName: string; rating: number; reason?: string };
type Review = {
  reviewId: string; merchantId: string; branchCode: string | null; branchName: string; createdAt: string | null; rating: number | null;
  description: string | null; orderedItems: string[]; aspects: Aspect[]; hasReply: boolean; serviceType: string | null;
  imageUrls: string[]; eaterName: string | null; orderId: string | null;
};
type ReviewPage = { data: Review[]; total: number; page: number; size: number; counts: { withPhoto: number; unreplied: number; low: number; avg: number | null } };
type MenuItem = { merchantId: string; branchName: string; itemId: string; kind: "item" | "modifier"; name: string; category: string | null;
  itemCode: string | null; price: number | null; imageUrl: string | null; status: "AVAILABLE" | "OUT_OF_STOCK" | "OFF"; availableAt: string | null;
  /** the price most outlets of the same city ask (at least 3 outlets) */ refPrice: number | null; refOutlets: number | null };
type View = "outlets" | "reviews" | "menu";

const LOGO = "/assets/grabfood.svg";
const REVIEW_PAGE = 20;
const LOW = 4.5;
const VALUE = "truncate text-xl sm:text-2xl";

/* ---------------------------------------------------------------- helpers */

async function getJson<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, { cache: "no-store", ...rest, ...(json !== undefined ? { body: JSON.stringify(json), headers: { "content-type": "application/json" } } : {}) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  return body as T;
}

const wib = (iso: string | null | undefined, o: Intl.DateTimeFormatOptions) => iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", ...o }) : "";
const fmtDay = (iso: string | null) => wib(iso, { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string | null) => wib(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string | null) => wib(iso, { hour: "2-digit", minute: "2-digit" });
const rp = (n: number | null) => n == null ? "—" : `Rp${n.toLocaleString("id-ID")}`;
const timeAgo = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return tr("just now");
  if (m < 60) return tr("{0} min ago", m);
  const h = Math.round(m / 60);
  return h < 24 ? tr("{0} h ago", h) : tr("{0} d ago", Math.round(h / 24));
};
/** No ratings yet: Grab reports 0, shown as "—". */
const scoreOf = (o: Outlet) => (o.rating.count && o.rating.score ? o.rating.score : null);
const unavailable = (o: Outlet) => o.menu.outOfStock + o.menu.off;
const rangesText = (r: Range[]) => (r.length ? r.map((x) => `${x.start}–${x.end}`).join(", ") : tr("Closed all day"));
const fmtDuration = (m: number) => (m >= 60 ? tr("{0} h {1} min", Math.floor(m / 60), m % 60) : tr("{0} min", m));
const dayName = (i: number) => new Date(2024, 0, 7 + i).toLocaleDateString("id-ID", { weekday: "long" }); // 2024-01-07 = Sunday
/** "Kopi Calf To Go Pasar Lama" and "Kopi Calf - Pasar Lama" sort under P (the location), not under the brand. */
const place = (name: string) => name.replace(/^kopi\s*calf(\s+to\s+go)?[\s-]*/i, "").trim();
const byName = (a: string, b: string) => place(a).localeCompare(place(b), "id");

function Stars({ value, size = 13 }: { value: number | null; size?: number }) {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={tr("{0} of 5 stars", value)}>
      <span className="font-semibold tabular-nums text-slate-900">{value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} className={value >= i - 0.25 ? "fill-amber-400 text-amber-400" : value >= i - 0.75 ? "fill-amber-200 text-amber-400" : "text-slate-300"} />
        ))}
      </span>
    </span>
  );
}

function StatusBadge({ s, inHours }: { s: Status; inHours?: boolean }) {
  if (s.isOpen === null) return <span className="text-xs text-slate-400">—</span>;
  if (!s.isOpen) {
    const paused = (s.label || "").toLowerCase().includes("pause");
    // closed or paused while its opening hours say open: red; outside its hours a closed outlet is normal
    return <Badge tone={inHours ? "red" : paused ? "amber" : "slate"} dot>{paused ? tr("Paused") : tr("Closed")}{s.pauseUntil ? ` · ${tr("until {0}", fmtTime(s.pauseUntil))}` : ""}</Badge>;
  }
  if (s.isBusy) return <Badge tone="amber" dot>{tr("Busy")}</Badge>;
  return <Badge tone="green" dot>{tr("Open")}</Badge>;
}

/** The merchant photo shown on GrabFood (or the outlet initial). */
function StorePhoto({ o, size = 36 }: { o: Pick<Outlet, "photoUrl" | "branchName">; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (!o.photoUrl || broken) {
    return <span style={style} className="flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">
      {(o.branchName.replace(/kopi calf( to go)?[\s-]*/i, "")[0] || "K").toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- merchant photo from the Grab CDN
  return <img src={o.photoUrl} alt="" style={style} loading="lazy" onError={() => setBroken(true)} className="flex-shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover" />;
}

const MENU_TONE: Record<MenuItem["status"], Tone> = { AVAILABLE: "green", OUT_OF_STOCK: "amber", OFF: "red" };
const menuLabel = (s: MenuItem["status"]) => (s === "AVAILABLE" ? tr("Available") : s === "OUT_OF_STOCK" ? tr("Out of stock today") : tr("Switched off"));

/* ------------------------------------------------------------------- page */

export default function GrabFood() {
  const toast = useToast();
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("outlets");
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Review | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [reviewOutlet, setReviewOutlet] = useState("");
  const [menuOutlet, setMenuOutlet] = useState("");
  const [outletView, setOutletView] = useState("");

  const load = useCallback(async (quiet = false) => {
    setError(null);
    if (!quiet) setRes(null);
    try { setRes(await getJson<Result>("/api/rating/grabfood")); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // the status is checked every 5 minutes on the server: refresh the page data quietly as often
  useEffect(() => { const t = setInterval(() => void load(true), 5 * 60_000); return () => clearInterval(t); }, [load]);

  const all = useMemo(() => res?.data ?? [], [res]);
  const sum = useMemo(() => {
    const rated = all.filter((o) => scoreOf(o) !== null);
    const weight = rated.reduce((a, o) => a + (o.rating.count ?? 0), 0);
    return {
      outlets: all.length, open: all.filter((o) => o.status.isOpen === true).length, notOpen: all.filter((o) => o.status.isOpen === false).length,
      inHours: all.filter((o) => o.hours.closedInHours).length,
      closedMinutes: all.reduce((a, o) => a + (o.hours.closedMinutesToday ?? 0), 0),
      rating: weight ? rated.reduce((a, o) => a + (scoreOf(o) ?? 0) * (o.rating.count ?? 0), 0) / weight : null,
      ratings: weight, reviews: all.reduce((a, o) => a + o.reviewsAll.count, 0), photos: all.reduce((a, o) => a + o.reviewsAll.withPhoto, 0),
      outOfStock: all.reduce((a, o) => a + o.menu.outOfStock, 0), off: all.reduce((a, o) => a + o.menu.off, 0),
      menuOutlets: all.filter((o) => unavailable(o) > 0).length,
      last: all.map((o) => o.status.checkedAt).filter(Boolean).sort().pop() ?? null,
    };
  }, [all]);
  const current = all.find((o) => o.merchantId === open) ?? null;
  const go = (v: View, outletView_ = "") => { setView(v); if (v === "outlets") setOutletView(outletView_); };
  const iconBtn = "inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
    <Page title={<img src={LOGO} alt="GrabFood" width={160} height={56} className="h-6 w-auto sm:h-7" />}
      subtitle={`${tr("Status, rating, reviews and menu of the outlets on GrabFood")}${sum.last ? ` · ${tr("status checked {0}", timeAgo(sum.last))}` : ""}`}
      actions={res?.canEdit ? (
        <button type="button" onClick={() => setSessionOpen(true)} className={cx(iconBtn, res.session && !res.session.valid && "text-amber-600")}
          title={tr("Grab session")} aria-label={tr("Grab session")}><KeyRound size={19} /></button>
      ) : undefined}
      stats={
        <StatStrip label={tr("Summary")} columns={5} gridClassName="grid-cols-2 xl:grid-cols-5">
          <Stat label={tr("Open now")} emphasis className="col-span-2 xl:col-span-1" valueClassName={VALUE} icon={<Store size={13} />} value={res ? `${fmtNumber(sum.open)} / ${fmtNumber(sum.outlets)}` : <StatSkeleton />}
            onClick={res ? () => go("outlets") : undefined} active={view === "outlets" && !outletView}>
            {res && <p>{tr("outlets on GrabFood")}</p>}
          </Stat>
          <Stat label={tr("Closed in opening hours")} icon={<AlertTriangle size={13} />} valueClassName={VALUE} value={res ? fmtNumber(sum.inHours) : <StatSkeleton />}
            onClick={res ? () => go("outlets", "inHours") : undefined} active={view === "outlets" && outletView === "inHours"}>
            {res && <p>{tr("{0} paused / closed now · {1} today", fmtNumber(sum.notOpen), fmtDuration(sum.closedMinutes))}</p>}
          </Stat>
          <Stat label={tr("Average rating")} valueClassName={VALUE} icon={<Star size={13} />} value={res ? (sum.rating === null ? "—" : sum.rating.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : <StatSkeleton />}>
            {res && <p>{tr("{0} ratings, weighted", fmtNumber(sum.ratings))}</p>}
          </Stat>
          <Stat label={tr("Reviews")} valueClassName={VALUE} icon={<MessageSquareText size={13} />} value={res ? fmtNumber(sum.reviews) : <StatSkeleton />}
            onClick={res ? () => { setReviewOutlet(""); go("reviews"); } : undefined} active={view === "reviews"}>
            {res && <p>{tr("{0} with photos", fmtNumber(sum.photos))}</p>}
          </Stat>
          <Stat label={tr("Menu unavailable")} valueClassName={VALUE} icon={<PackageX size={13} />} value={res ? fmtNumber(sum.outOfStock + sum.off) : <StatSkeleton />}
            onClick={res ? () => { setMenuOutlet(""); go("menu"); } : undefined} active={view === "menu"}>
            {res && <p>{tr("{0} out of stock · {1} off", fmtNumber(sum.outOfStock), fmtNumber(sum.off))}</p>}
          </Stat>
        </StatStrip>
      }>

      {res?.canEdit && res.session && !res.session.valid && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span className="min-w-0 flex-1">{res.session.present ? tr("The Grab session has ended: the data stops updating until it is refreshed.") : tr("No Grab session yet: add one to start the updates.")}</span>
          <Button size="sm" onClick={() => setSessionOpen(true)}>{tr("Refresh")}</Button>
        </div>
      )}

      <ViewSwitch view={view} onView={(v) => go(v)} counts={{ outlets: sum.outlets, reviews: sum.reviews, menu: sum.outOfStock + sum.off }} />

      {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel>
        : view === "outlets" ? <OutletsPanel res={res} view={outletView} setView={setOutletView} onOpen={setOpen} />
        : view === "reviews" ? <ReviewsPanel outlets={all} merchant={reviewOutlet} setMerchant={setReviewOutlet} onPreview={setPreview} />
        : <MenuPanel outlets={all} merchant={menuOutlet} setMerchant={setMenuOutlet} />}

      {current && <OutletDrawer o={current} canEdit={!!res?.canEdit} onClose={() => setOpen(null)} onPreview={setPreview}
        onReviews={() => { setReviewOutlet(current.merchantId); setOpen(null); go("reviews"); }}
        onMenu={() => { setMenuOutlet(current.merchantId); setOpen(null); go("menu"); }}
        onChanged={() => void load(true)} />}
      {preview && <ReviewPreview r={preview} onClose={() => setPreview(null)} />}
      {sessionOpen && res?.canEdit && <SessionDrawer session={res.session} onClose={() => setSessionOpen(false)}
        onSaved={() => { setSessionOpen(false); toast(tr("Session updated")); void load(true); }} />}
    </Page>
  );
}

function ViewSwitch({ view, onView, counts }: { view: View; onView: (v: View) => void; counts: Record<View, number> }) {
  const items: { key: View; label: string; icon: ReactNode }[] = [
    { key: "outlets", label: tr("Outlets"), icon: <Store size={15} /> },
    { key: "reviews", label: tr("Reviews"), icon: <MessageSquareText size={15} /> },
    { key: "menu", label: tr("Menu"), icon: <UtensilsCrossed size={15} /> },
  ];
  return (
    <div role="tablist" aria-label={tr("View")} className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm sm:inline-grid sm:w-auto">
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={view === t.key} onClick={() => onView(t.key)}
          className={cx("inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors sm:px-4",
            view === t.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
          {t.icon}<span>{t.label}</span>
          <span className={cx("hidden rounded-full px-1.5 text-[11px] tabular-nums sm:inline", view === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{fmtNumber(counts[t.key])}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- outlets */

const OUTLET_VIEWS: Record<string, { label: () => string; test: (o: Outlet) => boolean }> = {
  inHours: { label: () => tr("Closed in opening hours"), test: (o) => o.hours.closedInHours },
  downtime: { label: () => tr("Closed in opening hours today"), test: (o) => (o.hours.closedMinutesToday ?? 0) > 0 },
  closed: { label: () => tr("Paused / closed"), test: (o) => o.status.isOpen === false },
  busy: { label: () => tr("Busy"), test: (o) => !!o.status.isBusy },
  low: { label: () => tr("Rating below {0}", LOW.toLocaleString()), test: (o) => scoreOf(o) !== null && scoreOf(o)! < LOW },
  menu: { label: () => tr("Menu unavailable"), test: (o) => unavailable(o) > 0 },
  bad: { label: () => tr("≤2★ reviews in 30 days"), test: (o) => o.reviews30d.low > 0 },
  unmapped: { label: () => tr("Not mapped to a branch"), test: (o) => !o.branchCode },
};
const OUTLET_SORTS: Record<string, { label: () => string; cmp: (a: Outlet, b: Outlet) => number }> = {
  name: { label: () => tr("Outlet name"), cmp: (a, b) => byName(a.branchName, b.branchName) },
  low: { label: () => tr("Lowest rating"), cmp: (a, b) => (scoreOf(a) ?? 9) - (scoreOf(b) ?? 9) || byName(a.branchName, b.branchName) },
  high: { label: () => tr("Highest rating"), cmp: (a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1) || byName(a.branchName, b.branchName) },
  downtime: { label: () => tr("Longest closed in opening hours"), cmp: (a, b) => (b.hours.closedMinutesToday ?? 0) - (a.hours.closedMinutesToday ?? 0) || byName(a.branchName, b.branchName) },
  menu: { label: () => tr("Most menu unavailable"), cmp: (a, b) => unavailable(b) - unavailable(a) || byName(a.branchName, b.branchName) },
  reviews: { label: () => tr("Most reviews"), cmp: (a, b) => b.reviewsAll.count - a.reviewsAll.count },
};

function OutletsPanel({ res, view, setView, onOpen }: { res: Result | null; view: string; setView: (v: string) => void; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [sheet, setSheet] = useState(false);
  const all = useMemo(() => res?.data ?? [], [res]);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const v = view ? OUTLET_VIEWS[view] : null;
    return all.filter((o) => (!v || v.test(o)) && (!s || `${o.branchName} ${o.merchantName} ${o.branchCode ?? ""} ${o.cityName ?? ""} ${o.address ?? ""}`.toLowerCase().includes(s)))
      .sort(OUTLET_SORTS[sort].cmp);
  }, [all, view, search, sort]);
  const paged = usePaged(rows, rows.length + search + view + sort);
  const chips: ActiveFilter[] = [
    ...(view ? [{ key: "v", label: OUTLET_VIEWS[view].label(), onRemove: () => setView("") }] : []),
    ...(sort !== "name" ? [{ key: "s", label: tr("Sort: {0}", OUTLET_SORTS[sort].label()), onRemove: () => setSort("name") }] : []),
  ];

  return (
    <>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet, branch code or address")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => { setView(""); setSort("name"); }} />}
        footer={res ? <>
          <span className="inline-flex flex-wrap items-center gap-2">
            {tr("{0} of {1} outlets", fmtNumber(rows.length), fmtNumber(all.length))} ·
            {/* eslint-disable-next-line @next/next/no-img-element -- GrabFood attribution */}
            <img src={LOGO} alt="GrabFood" className="h-3.5 w-auto" /> {tr("status every 5 minutes, menu every 30 minutes")}
          </span>
          <PageNav paged={paged} />
        </> : undefined}>
        {res && rows.length === 0 ? (
          <Empty icon={<Store size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No GrabFood outlet yet")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {!res ? Array.from({ length: 6 }, (_, i) => <li key={i} className="px-4 py-3"><div className="skeleton h-12 rounded" /></li>) : paged.rows.map((o) => (
                <li key={o.merchantId}>
                  <button type="button" onClick={() => onOpen(o.merchantId)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <StorePhoto o={o} size={40} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{o.branchName}</span>
                        <StatusBadge s={o.status} inHours={o.hours.closedInHours} />
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <Stars value={scoreOf(o)} size={12} />
                        {o.hours.week.length > 0 && <span className="tabular-nums">{rangesText(o.hours.today)}</span>}
                        {(o.hours.closedMinutesToday ?? 0) > 0 && <span className="text-red-600">{tr("closed {0} in hours", fmtDuration(o.hours.closedMinutesToday!))}</span>}
                        <span>{tr("{0} reviews", fmtNumber(o.reviewsAll.count))}</span>
                        {unavailable(o) > 0 && <span className="text-amber-700">{tr("{0} menu unavailable", fmtNumber(unavailable(o)))}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Outlet")}</th>
                    <th className="px-4 py-2.5">{tr("Now")}</th>
                    <th className="px-4 py-2.5">{tr("Hours today")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Closed in hours")}</th>
                    <th className="px-4 py-2.5">{tr("Rating")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Ratings")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Reviews")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("≤2★ (30 d)")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Menu unavailable")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!res ? <SkeletonRows cols={9} /> : paged.rows.map((o) => (
                    <tr key={o.merchantId} onClick={() => onOpen(o.merchantId)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="max-w-[22rem] px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          <StorePhoto o={o} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{o.branchName}</span>
                            <span className="block truncate text-xs text-slate-400">{o.branchCode ?? <span className="text-amber-700">{tr("not mapped to a branch")}</span>}{o.cityName ? ` · ${o.cityName}` : ""}</span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5"><StatusBadge s={o.status} inHours={o.hours.closedInHours} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{o.hours.week.length ? rangesText(o.hours.today) : "—"}</td>
                      <td className={cx("whitespace-nowrap px-4 py-2.5 text-right tabular-nums", o.hours.closedMinutesToday ? "font-semibold text-red-600" : "text-slate-400")}>
                        {o.hours.closedMinutesToday ? fmtDuration(o.hours.closedMinutesToday) : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5"><Stars value={scoreOf(o)} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{o.rating.count ? fmtNumber(o.rating.count) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmtNumber(o.reviewsAll.count)}</td>
                      <td className={cx("px-4 py-2.5 text-right tabular-nums", o.reviews30d.low ? "font-semibold text-red-600" : "text-slate-400")}>{o.reviews30d.low || "—"}</td>
                      <td className={cx("px-4 py-2.5 text-right tabular-nums", unavailable(o) ? "font-semibold text-amber-700" : "text-slate-400")}>{unavailable(o) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      {sheet && (
        <OutletFilters value={{ view, sort }} onClose={() => setSheet(false)}
          onApply={(v) => { setView(v.view); setSort(v.sort); setSheet(false); }} />
      )}
    </>
  );
}

function OutletFilters({ value, onApply, onClose }: { value: { view: string; sort: string }; onApply: (v: { view: string; sort: string }) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD({ view: "", sort: "name" })}>
      <FilterSection title={tr("Show")}>
        <ChoiceGroup label="" value={d.view} onChange={(v) => setD({ ...d, view: v })}
          choices={[{ value: "", label: tr("All outlets") }, ...Object.keys(OUTLET_VIEWS).map((k) => ({ value: k, label: OUTLET_VIEWS[k].label() }))]} />
      </FilterSection>
      <FilterSection title={tr("Sort")}>
        <ChoiceGroup label="" value={d.sort} onChange={(v) => setD({ ...d, sort: v })}
          choices={Object.keys(OUTLET_SORTS).map((k) => ({ value: k, label: OUTLET_SORTS[k].label() }))} />
      </FilterSection>
    </FilterSheet>
  );
}

function OutletDrawer({ o, canEdit, onClose, onReviews, onMenu, onPreview, onChanged }: {
  o: Outlet; canEdit: boolean; onClose: () => void; onReviews: () => void; onMenu: () => void; onPreview: (r: Review) => void; onChanged: () => void;
}) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [latest, setLatest] = useState<Review[] | null>(null);
  useEffect(() => {
    const m = encodeURIComponent(o.merchantId);
    getJson<{ data: MenuItem[] }>(`/api/rating/grabfood/menu?merchant=${m}`).then((r) => setItems(r.data)).catch(() => setItems([]));
    getJson<ReviewPage>(`/api/rating/grabfood/reviews?merchant=${m}&size=5`).then((r) => setLatest(r.data)).catch(() => setLatest([]));
  }, [o.merchantId]);
  const dist = [...(o.rating.distribution ?? [])].sort((a, b) => b.score - a.score);
  const score = scoreOf(o);
  const [now] = useState(() => Date.now()); // the moment the drawer opened: today's row and a closure still running

  return (
    <Drawer open onClose={onClose} size="lg" icon={<Store size={18} />} title={o.branchName}
      description={o.merchantName !== o.branchName ? tr("On GrabFood: {0}", o.merchantName) : (o.branchCode ?? o.merchantId)} focusFirstField={false}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <StorePhoto o={o} size={56} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2"><Stars value={score} size={16} />
              {o.rating.count ? <span className="text-sm text-slate-500">{tr("{0} ratings", fmtNumber(o.rating.count))}</span> : null}</div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge s={o.status} inHours={o.hours.closedInHours} />
              <span className="text-xs text-slate-400">{o.status.isOpen && o.status.openUntil ? `${tr("open until {0}", fmtTime(o.status.openUntil))} · ` : ""}{tr("checked {0}", timeAgo(o.status.checkedAt))}</span></div>
          </div>
        </div>
        {o.address && <p className="flex items-start gap-1.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{o.address}</p>}

        {(o.hours.closedInHours || (o.hours.closedMinutesToday ?? 0) > 0) && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{o.hours.closedInHours ? tr("Not open now although its opening hours say open.") : ""} {(o.hours.closedMinutesToday ?? 0) > 0 ? tr("Closed {0} during its opening hours today.", fmtDuration(o.hours.closedMinutesToday!)) : ""}</span>
          </p>
        )}

        {o.hours.week.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Opening hours on GrabFood")}</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {o.hours.week.map((r, i) => {
                const today = i === new Date(now + 7 * 3600e3).getUTCDay();
                return (
                  <div key={i} className={cx("flex justify-between gap-3 px-3 py-1.5", today && "bg-blue-50/60 font-medium")}>
                    <dt className={today ? "text-slate-900" : "text-slate-500"}>{dayName(i)}</dt>
                    <dd className="tabular-nums text-slate-800">{rangesText(r)}</dd>
                  </div>
                );
              })}
            </dl>
            {o.hours.closePeriodEnd && new Date(o.hours.closePeriodEnd).getTime() > now && (
              <p className="mt-1.5 text-xs text-amber-700">{tr("Temporarily closed until {0}", fmtDateTime(o.hours.closePeriodEnd))}</p>
            )}
          </section>
        )}

        {dist.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Rating distribution")}</h3>
            <ul className="space-y-1 rounded-xl border border-slate-200 p-3">
              {dist.map((d) => (
                <li key={d.score} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-6 tabular-nums">{d.score}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, d.countPercentage)}%` }} /></span>
                  <span className="w-10 text-right tabular-nums">{Math.round(d.countPercentage)}%</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Menu unavailable")} ({fmtNumber(unavailable(o))})</h3>
            {unavailable(o) > 0 && <button type="button" onClick={onMenu} className="text-xs font-medium text-blue-700 hover:underline">{tr("Show all")}</button>}
          </div>
          {items === null ? <div className="skeleton h-16 rounded-xl" /> : items.length === 0
            ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">{o.menu.syncedAt ? tr("Everything on the menu is available") : tr("The menu has not been read yet")}</p>
            : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {items.slice(0, 8).map((i) => (
                  <li key={i.itemId} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{i.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{[i.kind === "modifier" ? tr("Add-on") : null, i.category].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Badge tone={MENU_TONE[i.status]}>{menuLabel(i.status)}</Badge>
                  </li>
                ))}
                {items.length > 8 && <li className="px-3 py-2 text-center text-xs text-slate-500">{tr("and {0} more", items.length - 8)}</li>}
              </ul>
            )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Latest reviews")} ({fmtNumber(o.reviewsAll.count)})</h3>
            {o.reviewsAll.count > 0 && <button type="button" onClick={onReviews} className="text-xs font-medium text-blue-700 hover:underline">{tr("Show all")}</button>}
          </div>
          {latest === null ? <div className="skeleton h-24 rounded-xl" /> : latest.length === 0
            ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">{tr("No review yet")}</p>
            : <ul className="space-y-2">{latest.map((r) => <li key={r.reviewId}><ReviewItem r={r} onOpen={() => onPreview(r)} /></li>)}</ul>}
        </section>

        {canEdit && <BranchPicker o={o} onChanged={onChanged} />}
      </div>
    </Drawer>
  );
}

/** Super admin: the ESB branch of this Grab outlet (its reviews and status follow that branch's users). */
function BranchPicker({ o, onChanged }: { o: Outlet; onChanged: () => void }) {
  const toast = useToast();
  const [options, setOptions] = useState<{ code: string; name: string; usedBy: string | null }[] | null>(null);
  const [value, setValue] = useState(o.branchCode ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getJson<{ data: { code: string; name: string; usedBy: string | null }[] }>("/api/rating/grabfood/branches").then((r) => setOptions(r.data)).catch(() => setOptions([])); }, []);
  const save = async () => {
    setBusy(true);
    try {
      await getJson(`/api/rating/grabfood/stores/${encodeURIComponent(o.merchantId)}/branch`, { method: "PUT", json: { branchCode: value || null } });
      toast(tr("Branch saved"));
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setBusy(false); }
  };
  const choices = (options ?? []).filter((b) => !b.usedBy || b.usedBy === o.merchantId)
    .map((b) => ({ value: b.code, label: `${b.name} (${b.code})` }));
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Link2 size={13} /> {tr("ESB branch")}</h3>
      <p className="mt-1 text-xs text-slate-500">{o.branchCode ? tr("The users of this branch see this outlet.") : tr("Not mapped: only super admins see this outlet. Choose its ESB branch.")}</p>
      <div className="mt-2">
        <SearchChoice label={tr("ESB branch")} anyLabel={tr("Not mapped")} options={choices} value={value} onChange={setValue}
          placeholder={tr("Search branch")} loading={options === null} />
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" loading={busy} disabled={value === (o.branchCode ?? "")} onClick={() => void save()}>{tr("Save branch")}</Button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- reviews */

type RF = { merchant: string; stars: string; photo: string; reply: string; from: string; to: string };
const NO_RF: RF = { merchant: "", stars: "", photo: "", reply: "", from: "", to: "" };

function ReviewsPanel({ outlets, merchant, setMerchant, onPreview }: { outlets: Outlet[]; merchant: string; setMerchant: (v: string) => void; onPreview: (r: Review) => void }) {
  const [f, setF] = useState<RF>({ ...NO_RF, merchant });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<ReviewPage | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setF((x) => ({ ...x, merchant })); }, [merchant]);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [f, q]);
  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), size: String(REVIEW_PAGE) });
    if (f.merchant) p.set("merchant", f.merchant);
    if (f.stars) p.set("rating", f.stars);
    if (f.photo) p.set("photo", "true");
    if (f.reply) p.set("replied", f.reply);
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (q) p.set("q", q);
    let live = true;
    setErr(null);
    getJson<ReviewPage>(`/api/rating/grabfood/reviews?${p}`).then((r) => live && setRes(r)).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [f, q, page]);

  const outletName = (id: string) => outlets.find((o) => o.merchantId === id)?.branchName ?? id;
  const apply = (v: RF) => { setF(v); setMerchant(v.merchant); };
  const chips: ActiveFilter[] = [
    ...(f.merchant ? [{ key: "m", label: outletName(f.merchant), onRemove: () => apply({ ...f, merchant: "" }) }] : []),
    ...(f.stars ? [{ key: "s", label: STAR_CHOICES.find((c) => c.value === f.stars)?.label ?? f.stars, onRemove: () => setF({ ...f, stars: "" }) }] : []),
    ...(f.photo ? [{ key: "p", label: tr("With photo"), onRemove: () => setF({ ...f, photo: "" }) }] : []),
    ...(f.reply ? [{ key: "r", label: f.reply === "false" ? tr("Not replied") : tr("Replied"), onRemove: () => setF({ ...f, reply: "" }) }] : []),
    ...(f.from || f.to ? [{ key: "d", label: `${f.from ? fmtDay(f.from) : "…"} – ${f.to ? fmtDay(f.to) : "…"}`, onRemove: () => setF({ ...f, from: "", to: "" }) }] : []),
  ];
  const pages = res ? Math.max(1, Math.ceil(res.total / res.size)) : 1;
  const first = res ? (res.page - 1) * res.size + 1 : 0;

  return (
    <>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search review text, item, customer or order")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => apply(NO_RF)} />}
        footer={res ? <>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{tr("{0} reviews", fmtNumber(res.total))}</span>
            {res.counts.avg !== null && <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" />{res.counts.avg.toFixed(2)}</span>}
            <span className="inline-flex items-center gap-1"><ImageIcon size={12} />{fmtNumber(res.counts.withPhoto)}</span>
            <span>{tr("{0} not replied", fmtNumber(res.counts.unreplied))}</span>
            <span className="text-red-600">{fmtNumber(res.counts.low)} ≤2★</span>
          </span>
          {pages > 1 && (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{tr("{0}–{1} of {2}", fmtNumber(first), fmtNumber(Math.min(res.page * res.size, res.total)), fmtNumber(res.total))}</span>
              <Button variant="secondary" size="sm" className="px-2" disabled={res.page <= 1} onClick={() => setPage(res.page - 1)} aria-label={tr("Previous page")}><ChevronLeft size={16} /></Button>
              <span className="tabular-nums">{res.page} / {pages}</span>
              <Button variant="secondary" size="sm" className="px-2" disabled={res.page >= pages} onClick={() => setPage(res.page + 1)} aria-label={tr("Next page")}><ChevronRight size={16} /></Button>
            </span>
          )}
        </> : undefined}>
        {err ? <ErrorState message={err} /> : res === null ? (
          <div className="divide-y divide-slate-100">{Array.from({ length: 5 }, (_, i) => <div key={i} className="px-4 py-3"><div className="skeleton h-14 rounded" /></div>)}</div>
        ) : res.data.length === 0 ? (
          <Empty icon={<MessageSquareText size={28} />} title={chips.length || q ? tr("No review matches the search or filters") : tr("No review yet")} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {res.data.map((r) => (
              <li key={r.reviewId}><ReviewRow r={r} showOutlet={!f.merchant} onOpen={() => onPreview(r)} /></li>
            ))}
          </ul>
        )}
      </Panel>
      {sheet && <ReviewFilters outlets={outlets} value={f} onClose={() => setSheet(false)} onApply={(v) => { apply(v); setSheet(false); }} />}
    </>
  );
}

const STAR_CHOICES = [
  { value: "", label: "" }, { value: "1,2", label: "1–2 ★" }, { value: "3", label: "3 ★" }, { value: "4,5", label: "4–5 ★" },
  { value: "5", label: "5 ★" }, { value: "1", label: "1 ★" },
];

function ReviewFilters({ outlets, value, onApply, onClose }: { outlets: Outlet[]; value: RF; onApply: (v: RF) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_RF)}>
      <FilterSection title={tr("Outlet")}>
        <SearchChoice label={tr("Outlet")} anyLabel={tr("All outlets")} value={d.merchant} onChange={(v) => setD({ ...d, merchant: v })}
          options={outlets.map((o) => ({ value: o.merchantId, label: o.branchName, meta: o.reviewsAll.count ? fmtNumber(o.reviewsAll.count) : undefined }))}
          placeholder={tr("Search outlet")} />
      </FilterSection>
      <FilterSection title={tr("Stars")}>
        <ChoiceGroup label="" value={d.stars} onChange={(v) => setD({ ...d, stars: v })}
          choices={STAR_CHOICES.map((c) => (c.value ? c : { value: "", label: tr("All") }))} />
      </FilterSection>
      <FilterSection title={tr("Show")}>
        <ChoiceGroup label="" value={d.photo} onChange={(v) => setD({ ...d, photo: v })}
          choices={[{ value: "", label: tr("All reviews") }, { value: "true", label: tr("With photo") }]} />
        <div className="mt-3">
          <ChoiceGroup label="" value={d.reply} onChange={(v) => setD({ ...d, reply: v })}
            choices={[{ value: "", label: tr("Replied or not") }, { value: "false", label: tr("Not replied") }, { value: "true", label: tr("Replied") }]} />
        </div>
      </FilterSection>
      <FilterSection title={tr("Period")} hint={tr("Date of the review (WIB)")}>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={d.from} max={d.to || undefined} onChange={(e) => setD({ ...d, from: e.target.value })} aria-label={tr("From")} />
          <Input type="date" value={d.to} min={d.from || undefined} onChange={(e) => setD({ ...d, to: e.target.value })} aria-label={tr("To")} />
        </div>
      </FilterSection>
    </FilterSheet>
  );
}

/** A review in the list: stars, date, outlet, text (3 lines) and the first photo. */
function ReviewRow({ r, showOutlet, onOpen }: { r: Review; showOutlet: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Stars value={r.rating} size={12} />
          {(r.rating ?? 5) <= 2 && <Badge tone="red">{tr("Low")}</Badge>}
          {!r.hasReply && <Badge tone="blue" dot>{tr("not replied")}</Badge>}
          <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span>
        </span>
        {showOutlet && <span className="mt-1 block truncate text-xs font-medium text-slate-600">{r.branchName}</span>}
        <span className={cx("mt-1 line-clamp-2 block text-sm", r.description ? "text-slate-700" : "italic text-slate-400")}>{r.description || tr("No written review (stars only)")}</span>
        {r.orderedItems.length > 0 && <span className="mt-0.5 block truncate text-xs text-slate-400">{r.orderedItems.join(" · ")}</span>}
      </span>
      {r.imageUrls.length > 0 && (
        <span className="relative flex-shrink-0 self-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- customer photo from the Grab CDN */}
          <img src={r.imageUrls[0]} alt="" loading="lazy" className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-100 object-cover" />
          {r.imageUrls.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-slate-900/70 px-1 text-[10px] font-semibold text-white">+{r.imageUrls.length - 1}</span>}
        </span>
      )}
    </button>
  );
}

/** The review card of the outlet drawer (Google Maps style). */
function ReviewItem({ r, onOpen }: { r: Review; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-blue-200 hover:bg-blue-50/30">
      <span className="flex items-center gap-2">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{(r.eaterName || "?")[0].toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{r.eaterName || tr("GrabFood customer")}</span>
          <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</span>
        </span>
        <Stars value={r.rating} size={11} />
      </span>
      {r.description && <span className="mt-2 line-clamp-3 block whitespace-pre-line text-sm text-slate-700">{r.description}</span>}
      {r.imageUrls.length > 0 && (
        <span className="mt-2 flex gap-1.5">
          {r.imageUrls.slice(0, 4).map((u) => (
            // eslint-disable-next-line @next/next/no-img-element -- customer photo from the Grab CDN
            <img key={u} src={u} alt="" loading="lazy" className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100 object-cover" />
          ))}
        </span>
      )}
    </button>
  );
}

function ReviewPreview({ r, onClose }: { r: Review; onClose: () => void }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const aspects = r.aspects.filter((a) => a.aspectName);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MessageSquareText size={18} />} title={r.branchName} description={fmtDateTime(r.createdAt)} focusFirstField={false}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">{(r.eaterName || "?")[0].toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{r.eaterName || tr("GrabFood customer")}</p>
            <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={14} />
              {r.hasReply ? <Badge tone="green">{tr("Replied")}</Badge> : <Badge tone="blue" dot>{tr("not replied")}</Badge>}</div>
          </div>
        </div>
        <p className={cx("whitespace-pre-line rounded-xl border border-slate-200 p-3 text-sm leading-relaxed", r.description ? "text-slate-800" : "italic text-slate-400")}>
          {r.description || tr("No written review (stars only)")}
        </p>

        {r.imageUrls.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Photos ({0})", r.imageUrls.length)}</h3>
            <div className="grid grid-cols-3 gap-2">
              {r.imageUrls.map((u, i) => (
                <button key={u} type="button" onClick={() => setZoom(i)} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100" aria-label={tr("Open photo {0}", i + 1)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- customer photo from the Grab CDN */}
                  <img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                </button>
              ))}
            </div>
          </section>
        )}

        {aspects.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("What the customer mentions")}</h3>
            <p className="mb-2 text-[11px] text-slate-400">{tr("Detected by Grab from the review: + positive, − negative")}</p>
            <div className="flex flex-wrap gap-1.5">
              {aspects.map((a, i) => <Badge key={`${a.aspectName}-${i}`} tone={a.rating < 0 ? "red" : a.rating > 0 ? "green" : "slate"}>{a.rating < 0 ? "− " : a.rating > 0 ? "+ " : ""}{a.aspectName}</Badge>)}
            </div>
          </section>
        )}

        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {r.orderedItems.length > 0 && <Row k={tr("Ordered")} v={r.orderedItems.join(", ")} />}
          {r.orderId && <Row k={tr("Order")} v={<span className="font-mono text-xs">{r.orderId}</span>} />}
          {r.serviceType && <Row k={tr("Service")} v={r.serviceType} />}
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
      {/* eslint-disable-next-line @next/next/no-img-element -- customer photo from the Grab CDN */}
      <img src={urls[index]} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" onClick={onClose} aria-label={tr("Close")} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><X size={20} /></button>
      {urls.length > 1 && <>
        <button type="button" disabled={index === 0} onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} aria-label={tr("Previous photo")} className={cx(nav, "left-3")}><ChevronLeft size={22} /></button>
        <button type="button" disabled={index === urls.length - 1} onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} aria-label={tr("Next photo")} className={cx(nav, "right-3")}><ChevronRight size={22} /></button>
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">{index + 1} / {urls.length}</span>
      </>}
    </div>
  );
}

/* ------------------------------------------------------------------- menu */

type MF = { merchant: string; status: string; kind: string };
const NO_MF: MF = { merchant: "", status: "unavailable", kind: "" };

function MenuPanel({ outlets, merchant, setMerchant }: { outlets: Outlet[]; merchant: string; setMerchant: (v: string) => void }) {
  const [f, setF] = useState<MF>({ ...NO_MF, merchant });
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setF((x) => ({ ...x, merchant })); }, [merchant]);
  useEffect(() => {
    const p = new URLSearchParams({ status: f.status });
    if (f.merchant) p.set("merchant", f.merchant);
    if (f.kind) p.set("kind", f.kind);
    let live = true;
    setItems(null); setErr(null);
    getJson<{ data: MenuItem[] }>(`/api/rating/grabfood/menu?${p}`).then((r) => live && setItems(r.data)).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [f]);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rank = { OUT_OF_STOCK: 0, OFF: 1, AVAILABLE: 2 };
    return (items ?? []).filter((i) => !s || `${i.name} ${i.category ?? ""} ${i.itemCode ?? ""} ${i.branchName}`.toLowerCase().includes(s))
      .sort((a, b) => rank[a.status] - rank[b.status] || byName(a.branchName, b.branchName) || a.name.localeCompare(b.name));
  }, [items, search]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f));
  const outletName = (id: string) => outlets.find((o) => o.merchantId === id)?.branchName ?? id;
  const apply = (v: MF) => { setF(v); setMerchant(v.merchant); };
  const statusLabel = (s: string) => (s === "unavailable" ? tr("Unavailable") : s === "all" ? tr("Whole menu") : s === "price" ? tr("Different price") : menuLabel(s as MenuItem["status"]));
  const chips: ActiveFilter[] = [
    ...(f.merchant ? [{ key: "m", label: outletName(f.merchant), onRemove: () => apply({ ...f, merchant: "", status: f.status === "all" ? "unavailable" : f.status }) }] : []),
    ...(f.status !== "unavailable" ? [{ key: "s", label: statusLabel(f.status), onRemove: () => setF({ ...f, status: "unavailable" }) }] : []),
    ...(f.kind ? [{ key: "k", label: f.kind === "item" ? tr("Menu items") : tr("Add-ons"), onRemove: () => setF({ ...f, kind: "" }) }] : []),
  ];
  const lastRead = outlets.map((o) => o.menu.syncedAt).filter(Boolean).sort().pop() ?? null;

  return (
    <>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search menu, category, code or outlet")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => apply(NO_MF)} />}
        footer={items ? <>
          <span>{tr("{0} items", fmtNumber(rows.length))} · {tr("menus read every 30 minutes, last {0}", timeAgo(lastRead))}</span>
          <PageNav paged={paged} />
        </> : undefined}>
        {err ? <ErrorState message={err} /> : items && rows.length === 0 ? (
          <Empty icon={<PackageX size={28} />} title={f.status === "price" && !search ? tr("Every outlet asks the usual price of its city") : search || chips.length ? tr("Nothing matches the search or filters") : tr("Nothing is out of stock or switched off")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {!items ? Array.from({ length: 6 }, (_, i) => <li key={i} className="px-4 py-3"><div className="skeleton h-10 rounded" /></li>) : paged.rows.map((i) => (
                <li key={`${i.merchantId}-${i.itemId}`} className="flex items-center gap-3 px-4 py-3">
                  <MenuPhoto i={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{i.name}</span>
                    <span className="block truncate text-xs text-slate-500">{[!f.merchant ? i.branchName : null, i.kind === "modifier" ? tr("Add-on") : i.category].filter(Boolean).join(" · ")}</span>
                    {f.status === "price" && <span className="block text-xs text-amber-700">{rp(i.price)} · {tr("most: {0}", rp(i.refPrice))}</span>}
                  </span>
                  <span className="flex-shrink-0 text-right">
                    <Badge tone={MENU_TONE[i.status]}>{i.status === "OUT_OF_STOCK" ? tr("Out of stock") : i.status === "OFF" ? tr("Off") : tr("Available")}</Badge>
                    {i.status === "OUT_OF_STOCK" && i.availableAt && <span className="mt-0.5 block text-[10px] text-slate-400">{tr("back {0}", fmtDateTime(i.availableAt))}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Menu")}</th>
                    {!f.merchant && <th className="px-4 py-2.5">{tr("Outlet")}</th>}
                    <th className="px-4 py-2.5">{tr("Category")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Price")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th>
                    <th className="px-4 py-2.5">{tr("Back on sale")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!items ? <SkeletonRows cols={f.merchant ? 5 : 6} /> : paged.rows.map((i) => (
                    <tr key={`${i.merchantId}-${i.itemId}`} className="hover:bg-slate-50/70">
                      <td className="max-w-[20rem] px-4 py-2.5">
                        <span className="flex items-center gap-3">
                          <MenuPhoto i={i} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{i.name}</span>
                            <span className="block truncate text-xs text-slate-400">{[i.kind === "modifier" ? tr("Add-on") : tr("Menu item"), i.itemCode].filter(Boolean).join(" · ")}</span>
                          </span>
                        </span>
                      </td>
                      {!f.merchant && <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-700">{i.branchName}</td>}
                      <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-600">{i.category ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700">
                        <PriceCell i={i} />
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={MENU_TONE[i.status]}>{menuLabel(i.status)}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{i.status === "OUT_OF_STOCK" && i.availableAt ? fmtDateTime(i.availableAt) : i.status === "OFF" ? tr("when switched on") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      {sheet && <MenuFilters outlets={outlets} value={f} onClose={() => setSheet(false)} onApply={(v) => { apply(v); setSheet(false); }} />}
    </>
  );
}

/** The price; when it differs from the price most outlets of the city ask, that price too (amber). */
function PriceCell({ i }: { i: MenuItem }) {
  const differs = i.kind === "item" && i.refPrice !== null && i.price !== i.refPrice;
  if (!differs) return <>{rp(i.price)}</>;
  return (
    <span className="inline-flex flex-col items-end" title={tr("Most of the {0} outlets in the city ask {1}", fmtNumber(i.refOutlets ?? 0), rp(i.refPrice))}>
      <span className="font-semibold text-amber-700">{rp(i.price)}</span>
      <span className="text-[11px] text-slate-400">{tr("most: {0}", rp(i.refPrice))}</span>
    </span>
  );
}

function MenuPhoto({ i }: { i: MenuItem }) {
  return i.imageUrl
    // eslint-disable-next-line @next/next/no-img-element -- menu photo from the Grab CDN
    ? <img src={i.imageUrl} alt="" loading="lazy" className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover" />
    : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><UtensilsCrossed size={15} /></span>;
}

function MenuFilters({ outlets, value, onApply, onClose }: { outlets: Outlet[]; value: MF; onApply: (v: MF) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_MF)}>
      <FilterSection title={tr("Outlet")}>
        <SearchChoice label={tr("Outlet")} anyLabel={tr("All outlets")} value={d.merchant}
          onChange={(v) => setD({ ...d, merchant: v, status: !v && d.status === "all" ? "unavailable" : d.status })}
          options={outlets.map((o) => ({ value: o.merchantId, label: o.branchName, meta: unavailable(o) ? fmtNumber(unavailable(o)) : undefined }))}
          placeholder={tr("Search outlet")} />
      </FilterSection>
      <FilterSection title={tr("Status")} hint={tr("Out of stock today comes back by itself; switched off stays off until the outlet turns it on. Different price: not the price most outlets of the same city use.")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={[{ value: "unavailable", label: tr("Unavailable") }, { value: "OUT_OF_STOCK", label: tr("Out of stock today") }, { value: "OFF", label: tr("Switched off") },
            { value: "price", label: tr("Different price") },
            ...(d.merchant ? [{ value: "all", label: tr("Whole menu") }] : [])]} />
      </FilterSection>
      <FilterSection title={tr("Type")}>
        <ChoiceGroup label="" value={d.kind} onChange={(v) => setD({ ...d, kind: v })}
          choices={[{ value: "", label: tr("All") }, { value: "item", label: tr("Menu items") }, { value: "modifier", label: tr("Add-ons") }]} />
      </FilterSection>
    </FilterSheet>
  );
}

/* ---------------------------------------------------------------- session */

function SessionDrawer({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await getJson("/api/rating/grabfood/session", { method: "PUT", json: { cookie: cookie.trim() } });
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); }
    finally { setSaving(false); }
  };
  const ok = !!session?.present && !!session.valid;
  return (
    <Drawer open onClose={onClose} size="md" icon={<KeyRound size={18} />} title={tr("Grab session")}
      description={tr("Super admin only: the merchant session the sync uses")} focusFirstField={false}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={saving} disabled={cookie.trim().length < 20} onClick={() => void save()}>{tr("Save session")}</Button>
      </>}>
      <div className="space-y-4">
        <div className={cx("rounded-xl border px-3 py-2.5 text-sm", ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
          <p className="font-medium">{ok ? tr("Grab session active") : session?.present ? tr("Grab session ended") : tr("No Grab session yet")}</p>
          {session?.updatedAt && <p className="text-xs opacity-80">{tr("updated {0}", fmtDateTime(session.updatedAt))}{session.updatedBy ? ` · ${tr("by {0}", session.updatedBy)}` : ""}</p>}
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>{tr("Log in to merchant.grab.com in Chrome.")}</li>
          <li>{tr("Press F12 → Network, click any request, open Headers.")}</li>
          <li>{tr("Copy the whole value of the \"cookie:\" line and paste it below.")}</li>
        </ol>
        <textarea value={cookie} onChange={(e) => setCookie(e.target.value)} rows={6} spellCheck={false} placeholder="_gcl_au=...; mexusers_authn_token=...; ..."
          aria-label={tr("Cookie")}
          className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <p className="text-[11px] text-slate-400">{tr("The cookie is stored on the server for the sync only. Logging out of merchant.grab.com ends the session; refresh it here when it expires.")}</p>
      </div>
    </Drawer>
  );
}
