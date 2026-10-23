"use client";

// Rating & Review → Google Maps (page rating.google-maps): every Kopi Calf outlet on Google Maps through the official
// Places API (integrated_portal_be app/gmaps.py, synced daily 06:10 WIB): rating, number of reviews, open / closed now,
// today's hours, the latest reviews Google gives (at most 5 per outlet). Super admins and Cost Control link an outlet to
// its place when the automatic match needs checking.

import { AlertTriangle, CloudDownload, ExternalLink, MapPin, MessageSquareText, Search, Star, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Input, Page, PageNav, Panel, SkeletonRows, type Tone, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import { wibDateTime, wibDay } from "@/so/lib/wib";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Review = { rating: number | null; text: string; when: string | null; publishedAt: string | null; author: string | null; authorUri: string | null; authorPhoto: string | null; uri: string | null };
type Outlet = {
  code: string; branchName: string; located: boolean; placeId: string | null;
  match: "pending" | "auto" | "review" | "missing" | "manual" | "none"; matchDistanceM: number | null; setBy: string | null;
  name: string | null; address: string | null; rating: number | null; reviewCount: number | null; businessStatus: string | null;
  openNow: boolean | null; todayHours: string | null; weekHours: string[]; mapsUri: string | null; reviews: Review[];
  fetchedAt: string | null; error: string | null;
};
type Result = { ready: boolean; syncing: boolean; canEdit: boolean; data: Outlet[] };
type Candidate = { placeId: string; name: string; address: string; distanceM: number | null };
type F = { view: string; sort: string };

const LOW = 4.5;
const NO_F: F = { view: "", sort: "name" };
const LOGO = "/assets/googlemaps.png";
const VIEWS: Record<string, { label: () => string; test: (o: Outlet) => boolean }> = {
  low: { label: () => tr("Rating below {0}", LOW.toLocaleString()), test: (o) => o.rating !== null && o.rating < LOW },
  closed: { label: () => tr("Closed now"), test: (o) => o.openNow === false },
  check: { label: () => tr("Needs checking"), test: (o) => needsCheck(o) },
};
const SORTS: Record<string, { label: () => string; cmp: (a: Outlet, b: Outlet) => number }> = {
  name: { label: () => tr("Outlet name"), cmp: (a, b) => a.branchName.localeCompare(b.branchName) },
  low: { label: () => tr("Lowest rating"), cmp: (a, b) => (a.rating ?? 9) - (b.rating ?? 9) || a.branchName.localeCompare(b.branchName) },
  high: { label: () => tr("Highest rating"), cmp: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.branchName.localeCompare(b.branchName) },
  reviews: { label: () => tr("Most reviews"), cmp: (a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1) },
};

const needsCheck = (o: Outlet) => ["pending", "review", "missing"].includes(o.match) || !!o.error;

function MatchBadge({ o }: { o: Outlet }) {
  const map: Record<Outlet["match"], [Tone, string] | null> = {
    auto: null, manual: null,
    review: ["amber", tr("Check the place")], missing: ["red", tr("Not found on Google")],
    pending: ["slate", tr("Not synced yet")], none: ["slate", tr("Not on Google Maps")],
  };
  const m = map[o.match];
  if (o.error && !m) return <Badge tone="red" icon={<AlertTriangle size={11} />} title={o.error}>{tr("Sync failed")}</Badge>;
  return m ? <Badge tone={m[0]} wrap>{m[1]}</Badge> : null;
}

function OpenBadge({ o }: { o: Outlet }) {
  if (o.businessStatus === "CLOSED_PERMANENTLY") return <Badge tone="red">{tr("Permanently closed")}</Badge>;
  if (o.businessStatus === "CLOSED_TEMPORARILY") return <Badge tone="amber">{tr("Temporarily closed")}</Badge>;
  if (o.openNow === null) return <span className="text-xs text-slate-400">—</span>;
  return o.openNow ? <Badge tone="green" dot>{tr("Open")}</Badge> : <Badge tone="slate" dot>{tr("Closed")}</Badge>;
}

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

type Note = { text: string; tone: "ok" | "error" } | null;

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${note.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{note.text}</p>;
}

export default function GoogleMapsRatingPage() {
  const [note, setNote] = useState<Note>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<F>(NO_F);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    setError(null);
    if (!quiet) setRes(null);
    try {
      setRes(await call<Result>("/api/rating/google-maps"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // while a sync runs: reload every 10 s until it is done
  useEffect(() => {
    if (!res?.syncing) return;
    const t = setTimeout(() => void load(true), 10_000);
    return () => clearTimeout(t);
  }, [res, load]);

  const sync = async () => {
    setStarting(true);
    try {
      await call("/api/rating/google-maps/sync", { method: "POST" });
      setNote({ text: tr("Sync started: the list updates in a few minutes"), tone: "ok" });
      await load(true);
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "error" });
    } finally {
      setStarting(false);
    }
  };

  const all = useMemo(() => res?.data ?? [], [res]);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const v = f.view ? VIEWS[f.view] : null;
    return all.filter((o) => (!v || v.test(o)) && (!s || o.branchName.toLowerCase().includes(s) || o.code.toLowerCase().includes(s)
      || (o.address ?? "").toLowerCase().includes(s))).sort(SORTS[f.sort].cmp);
  }, [all, f, search]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f));

  const sum = useMemo(() => {
    const rated = all.filter((o) => o.rating !== null);
    const reviews = rated.reduce((n, o) => n + (o.reviewCount ?? 0), 0);
    const weighted = reviews ? rated.reduce((n, o) => n + (o.rating ?? 0) * (o.reviewCount ?? 0), 0) / reviews : null;
    const last = all.reduce<string | null>((m, o) => (o.fetchedAt && (!m || o.fetchedAt > m) ? o.fetchedAt : m), null);
    return { outlets: all.length, onMaps: rated.length, reviews, rating: weighted, low: all.filter(VIEWS.low.test).length,
      open: all.filter((o) => o.openNow === true).length, closed: all.filter(VIEWS.closed.test).length, check: all.filter(needsCheck).length, last };
  }, [all]);
  const toggle = (view: string) => setF({ ...f, view: f.view === view ? "" : view });
  const chips: ActiveFilter[] = [
    ...(f.view ? [{ key: "v", label: VIEWS[f.view].label(), onRemove: () => setF({ ...f, view: "" }) }] : []),
    ...(f.sort !== "name" ? [{ key: "s", label: tr("Sort: {0}", SORTS[f.sort].label()), onRemove: () => setF({ ...f, sort: "name" }) }] : []),
  ];
  const current = all.find((o) => o.code === open) ?? null;
  const iconBtn = "inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets
    <Page title={<img src={LOGO} alt="Google Maps" width={262} height={48} className="h-6 w-auto sm:h-7" />}
      subtitle={`${tr("Rating, reviews and opening hours of the outlets on Google Maps")}${sum.last ? ` · ${tr("last sync {0}", wibDateTime(sum.last))}` : ""}`}
      actions={<>
        {res?.canEdit && res.ready && (
          <button type="button" onClick={() => void sync()} disabled={starting || res.syncing} className={iconBtn}
            title={res.syncing ? tr("Sync running…") : tr("Sync with Google now")} aria-label={tr("Sync with Google now")}>
            <CloudDownload size={19} className={res.syncing ? "animate-pulse text-blue-600" : ""} />
          </button>
        )}
      </>}
      stats={
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Outlets on Google Maps")} emphasis icon={<Store size={13} />} value={res ? `${fmtNumber(sum.onMaps)} / ${fmtNumber(sum.outlets)}` : <StatSkeleton />}>
            {res && <p>{tr("{0} open now", fmtNumber(sum.open))}</p>}
          </Stat>
          <Stat label={tr("Average rating")} icon={<Star size={13} />} value={res ? (sum.rating === null ? "—" : sum.rating.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })) : <StatSkeleton />}>
            {res && <p>{tr("weighted by the number of reviews")}</p>}
          </Stat>
          <Stat label={tr("Reviews")} icon={<MessageSquareText size={13} />} value={res ? fmtNumber(sum.reviews) : <StatSkeleton />}>
            {res && <p>{tr("on Google Maps, all outlets")}</p>}
          </Stat>
          <Stat label={tr("Rating below {0}", LOW.toLocaleString())} icon={<AlertTriangle size={13} />} onClick={res ? () => toggle("low") : undefined} active={f.view === "low"}
            value={res ? fmtNumber(sum.low) : <StatSkeleton />}>
            {res && <p>{tr("outlets · click to show them")}</p>}
          </Stat>
          <Stat label={tr("Needs checking")} icon={<MapPin size={13} />} onClick={res ? () => toggle("check") : undefined} active={f.view === "check"}
            value={res ? fmtNumber(sum.check) : <StatSkeleton />}>
            {res && <p>{tr("place to confirm or not found")}</p>}
          </Stat>
        </StatStrip>
      }>

      <NoteLine note={note} />
      {res && !res.ready && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{tr("The Google Places API key is not set on the server yet (GOOGLE_PLACES_API_KEY): the data appears after it is set and the first sync.")}</span>
        </div>
      )}

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or address")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F)} />}
        footer={res ? <>
          <span className="inline-flex flex-wrap items-center gap-2">
            {tr("{0} of {1} outlets", fmtNumber(rows.length), fmtNumber(all.length))} ·
            {/* eslint-disable-next-line @next/next/no-img-element -- Google Maps attribution */}
            <img src={LOGO} alt="Google Maps" className="h-3.5 w-auto" /> {tr("data from Google Maps, refreshed daily")}
          </span>
          <PageNav paged={paged} />
        </> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : res && rows.length === 0 ? (
          <Empty icon={<MapPin size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No outlet yet")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((o) => (
                <li key={o.code}>
                  <button type="button" onClick={() => setOpen(o.code)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-900">{o.branchName}</span>
                      <OpenBadge o={o} />
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <Stars value={o.rating} size={12} />
                      {o.reviewCount !== null && <span>{tr("{0} reviews", fmtNumber(o.reviewCount))}</span>}
                      {o.todayHours && <span>{o.todayHours}</span>}
                      <MatchBadge o={o} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Outlet")}</th>
                    <th className="px-4 py-2.5">{tr("Rating")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Reviews")}</th>
                    <th className="px-4 py-2.5">{tr("Now")}</th>
                    <th className="px-4 py-2.5">{tr("Today")}</th>
                    <th className="px-4 py-2.5">{tr("Google Maps")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!res ? <SkeletonRows cols={6} /> : paged.rows.map((o) => (
                    <tr key={o.code} onClick={() => setOpen(o.code)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="max-w-[20rem] px-4 py-2.5">
                        <span className="block truncate font-medium text-slate-900">{o.branchName}</span>
                        <span className="block truncate text-xs text-slate-400">{o.address ?? o.code}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5"><Stars value={o.rating} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{o.reviewCount === null ? "—" : fmtNumber(o.reviewCount)}</td>
                      <td className="px-4 py-2.5"><OpenBadge o={o} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{o.todayHours ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <MatchBadge o={o} />
                          {o.mapsUri && <a href={o.mapsUri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={tr("Open in Google Maps")}
                            aria-label={tr("Open in Google Maps")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-700">
                            <ExternalLink size={15} />
                          </a>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <RatingFilters value={f} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {current && <OutletDrawer o={current} canEdit={!!res?.canEdit && !!res?.ready} onClose={() => setOpen(null)} onChanged={() => void load(true)} />}
    </Page>
  );
}

function RatingFilters({ value, onApply, onClose }: { value: F; onApply: (v: F) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F)}>
      <FilterSection title={tr("Show")}>
        <ChoiceGroup label="" value={d.view} onChange={(v) => setD({ ...d, view: v })}
          choices={[{ value: "", label: tr("All outlets") }, ...Object.keys(VIEWS).map((k) => ({ value: k, label: VIEWS[k].label() }))]} />
      </FilterSection>
      <FilterSection title={tr("Sort")}>
        <ChoiceGroup label="" value={d.sort} onChange={(v) => setD({ ...d, sort: v })}
          choices={Object.keys(SORTS).map((k) => ({ value: k, label: SORTS[k].label() }))} />
      </FilterSection>
    </FilterSheet>
  );
}

function OutletDrawer({ o, canEdit, onClose, onChanged }: { o: Outlet; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MapPin size={18} />} title={o.branchName}
      description={o.name && o.name !== o.branchName ? tr("On Google Maps: {0}", o.name) : o.code} focusFirstField={false}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Stars value={o.rating} size={16} />
          {o.reviewCount !== null && <span className="text-sm text-slate-500">{tr("{0} reviews", fmtNumber(o.reviewCount))}</span>}
          <OpenBadge o={o} />
          <MatchBadge o={o} />
        </div>
        {(o.address || o.mapsUri) && (
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            {o.address && <p className="text-slate-700">{o.address}</p>}
            {o.mapsUri && <a href={o.mapsUri} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-700 hover:underline">
              {tr("Open in Google Maps")} <ExternalLink size={12} /></a>}
          </div>
        )}
        {o.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{tr("Last sync failed")}: {o.error}</p>}

        {o.weekHours.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Opening hours")}</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {o.weekHours.map((line) => {
                const [day, hours] = line.includes(": ") ? line.split(": ", 2) : [line, ""];
                return (
                  <div key={line} className="flex justify-between gap-3 px-3 py-1.5">
                    <dt className="text-slate-500">{day}</dt><dd className="tabular-nums text-slate-800">{hours}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Latest reviews")}</h3>
          <p className="mb-2 text-xs text-slate-400">{tr("Newest first. Google picks at most 5 reviews per outlet in the Places API (not always the newest ones); the rating and the number of reviews cover all of them.")}</p>
          {o.reviews.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">{tr("No review yet")}</p> : (
            <ul className="space-y-2">
              {o.reviews.map((r, i) => (
                <li key={r.uri ?? i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    {r.authorPhoto
                      // eslint-disable-next-line @next/next/no-img-element -- reviewer photo from Google
                      ? <img src={r.authorPhoto} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full bg-slate-100 object-cover" />
                      : <span className="h-7 w-7 rounded-full bg-slate-100" />}
                    <span className="min-w-0 flex-1">
                      {r.authorUri ? <a href={r.authorUri} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-slate-900 hover:underline">{r.author}</a>
                        : <span className="block truncate text-sm font-medium text-slate-900">{r.author ?? tr("Google user")}</span>}
                      <span className="text-xs text-slate-400">{[r.publishedAt ? wibDay(r.publishedAt) : null, r.when].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Stars value={r.rating} size={11} />
                  </div>
                  {r.text && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            {/* eslint-disable-next-line @next/next/no-img-element -- Google Maps attribution */}
            <img src={LOGO} alt="Google Maps" className="h-3 w-auto" /> {o.fetchedAt ? tr("fetched {0}", wibDateTime(o.fetchedAt)) : ""}
          </p>
        </section>

        {canEdit && <PlacePicker o={o} onChanged={onChanged} />}
      </div>
    </Drawer>
  );
}

/** Super admin / Cost Control: link the outlet to its place on Google Maps (search near the outlet, choose). */
function PlacePicker({ o, onChanged }: { o: Outlet; onChanged: () => void }) {
  const [note, setNote] = useState<Note>(null);
  const [q, setQ] = useState(o.branchName);
  const [found, setFound] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const find = async () => {
    setBusy("search");
    setNote(null);
    try {
      setFound((await call<{ data: Candidate[] }>(`/api/rating/google-maps/search?${new URLSearchParams({ q, branch: o.code })}`)).data);
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };
  const choose = async (placeId: string | null) => {
    setBusy(placeId ?? "none");
    try {
      await call(`/api/rating/google-maps/places/${encodeURIComponent(o.code)}`, { method: "PUT", json: { placeId } });
      setNote({ text: placeId ? tr("Place saved and fetched") : tr("Marked as not on Google Maps"), tone: "ok" });
      setFound(null);
      onChanged();
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Place on Google Maps")}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {o.match === "auto" ? tr("Matched automatically ({0} m from the outlet's coordinates).", o.matchDistanceM ?? "?")
          : o.match === "manual" ? tr("Chosen by {0}.", o.setBy ?? "—")
          : o.match === "review" ? (o.matchDistanceM !== null
            ? tr("Found, but {0} from the outlet's coordinates: check that it is the right place.", `${fmtNumber(o.matchDistanceM)} m`)
            : tr("Found by name; the outlet has no coordinates to compare: check that it is the right place."))
          : o.match === "missing" ? tr("No Kopi Calf place found near the outlet with a matching name: search with another name or mark it as not on Google Maps.")
          : tr("Search for the outlet and choose its place.")}
      </p>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Search on Google Maps")} className="h-9" />
        <Button type="submit" size="sm" variant="secondary" loading={busy === "search"} disabled={q.trim().length < 2} className="h-9">
          <Search size={14} /> {tr("Search")}
        </Button>
      </form>
      {note && <div className="mt-2"><NoteLine note={note} /></div>}
      {found && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {found.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">{tr("Nothing found")}</li>}
          {found.map((c) => (
            <li key={c.placeId} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                <span className="block truncate text-xs text-slate-500">{c.address}</span>
              </span>
              {c.distanceM !== null && <span className={`text-xs tabular-nums ${c.distanceM > 300 ? "text-amber-700" : "text-slate-500"}`}>{fmtNumber(c.distanceM)} m</span>}
              <Button size="sm" variant={c.placeId === o.placeId ? "secondary" : "primary"} loading={busy === c.placeId} disabled={!!busy}
                onClick={() => void choose(c.placeId)}>{c.placeId === o.placeId ? tr("Current") : tr("Choose")}</Button>
            </li>
          ))}
        </ul>
      )}
      {o.match !== "none" && (
        <button type="button" disabled={!!busy} onClick={() => void choose(null)} className="mt-2 text-xs text-slate-500 hover:text-red-700 hover:underline">
          {tr("This outlet is not on Google Maps")}
        </button>
      )}
    </section>
  );
}
