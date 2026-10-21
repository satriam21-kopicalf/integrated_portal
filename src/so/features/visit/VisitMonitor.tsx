"use client";

// Monitoring → Monitoring Product / Monitoring Outlet (pages mon.product, mon.outlet): the visits the PICs sent for a
// period — figures, performance per section (UNDER / MEET / EXCEED), the most frequent findings, the list of visits and
// one visit in full (every item with its rating, note and photos, the position against the outlet).

import { AlertTriangle, CalendarDays, ClipboardList, ExternalLink, Images, MapPin, PenLine, RefreshCw, Star, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay } from "@/so/ui/Filters";
import { Segmented } from "@/so/ui/Simple";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { type Definition, type Platform, type Rating, type Visit, type VisitFormKey, PLATFORM_LABEL, RATINGS, RATING_STYLE, fmtStars, ratingLabel, scoreTone, visitPhotoUrl, visitSignatureUrl } from "./visit";

type SectionPerf = { key: string; title: string; group: string; under: number; meet: number; exceed: number };
type Finding = { key: string; label: string; section: string; count: number; branches: string[] };
type Result = {
  period: { from: string; to: string }; definition: Definition; data: Visit[]; sections: SectionPerf[]; findings: Finding[];
  summary: { visits: number; branches: number; pics: number; under: number; meet: number; exceed: number; score: number | null; outside: number };
  pics: { id: string; name: string; n: number }[]; truncated: boolean;
  /** Monitoring Outlet: average stars per platform of the visits that carry one */
  platforms?: { key: string; platform: Platform; label: string; stars: number | null; visits: number }[];
};
type BranchOpt = { branch_code: string; branch_name: string };
type F = { period: Period; group: string; branch: string; user: string; only: "" | "under" | "outside" };
type GroupOpt = { id: string; code: string; name: string };

const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, group: "", branch: "", user: "", only: "" });

function Bar({ c, className }: { c: { under: number; meet: number; exceed: number }; className?: string }) {
  const total = c.under + c.meet + c.exceed;
  return (
    <span className={cx("flex h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      {total > 0 && (["under", "meet", "exceed"] as const).map((k, i) => (
        <span key={k} className={RATING_STYLE[RATINGS[i]].bar} style={{ width: `${(c[k] / total) * 100}%` }} />
      ))}
    </span>
  );
}

export default function VisitMonitor({ form }: { form: VisitFormKey }) {
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const q = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.group ? { group: f.group } : {}), ...(f.branch ? { branch: f.branch } : {}), ...(f.user ? { userId: f.user } : {}) });
    try {
      setRes(await call<Result>(`/api/monitoring/${form}?${q}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period, f.group, f.branch, f.user, form]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => { void call<{ groups: GroupOpt[] }>("/api/monitoring/branch-groups").then((r) => setGroups(r.groups)).catch(() => setGroups([])); }, []);

  const title = res?.definition.title ?? (form === "product" ? "Monitoring Product" : "Monitoring Outlet");
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (res?.data ?? []).filter((v) => (!s || v.branchName.toLowerCase().includes(s) || v.name.toLowerCase().includes(s))
      && (f.only !== "under" || v.counts.under > 0) && (f.only !== "outside" || v.outsideRadius));
  }, [res, search, f.only]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f));
  const s = res?.summary;
  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.group ? [{ key: "g", label: `${tr("Group")} ${groups.find((g) => g.id === f.group)?.code ?? ""}`, onRemove: () => setF({ ...f, group: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.user ? [{ key: "u", label: res?.pics.find((p) => p.id === f.user)?.name ?? tr("PIC"), onRemove: () => setF({ ...f, user: "" }) }] : []),
    ...(f.only ? [{ key: "o", label: f.only === "under" ? tr("With UNDER findings") : tr("Outside radius"), onRemove: () => setF({ ...f, only: "" }) }] : []),
  ];
  const toggle = (only: F["only"]) => setF({ ...f, only: f.only === only ? "" : only });

  return (
    <Page title={title} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("visits of the PICs to the outlets")}`}
      actions={<button type="button" onClick={() => void load()} disabled={!res && !error} title={tr("Refresh")} aria-label={tr("Refresh")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait">
        <RefreshCw size={18} className={!res && !error ? "animate-spin" : ""} />
      </button>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Visits")} emphasis icon={<ClipboardList size={13} />} value={s ? fmtNumber(s.visits) : <StatSkeleton />}>
            {s && <p>{tr("{0} outlets · {1} PICs", fmtNumber(s.branches), fmtNumber(s.pics))}</p>}
          </Stat>
          <Stat label={tr("Average score")} icon={<UsersRound size={13} />} value={s ? <span className={scoreTone(s.score)}>{s.score === null ? "—" : `${s.score}%`}</span> : <StatSkeleton />}>
            {s && <p>{tr("items rated MEET or EXCEED")}</p>}
          </Stat>
          <Stat label={tr("UNDER findings")} icon={<AlertTriangle size={13} />} onClick={s ? () => toggle("under") : undefined} active={f.only === "under"}
            value={s ? <span className={s.under ? "text-red-600" : undefined}>{fmtNumber(s.under)}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} MEET · {1} EXCEED", fmtNumber(s.meet), fmtNumber(s.exceed))}</p>}
          </Stat>
          <Stat label={tr("Outside radius")} icon={<MapPin size={13} />} onClick={s ? () => toggle("outside") : undefined} active={f.only === "outside"}
            value={s ? fmtNumber(s.outside) : <StatSkeleton />}>
            {s && <p>{tr("sent away from the outlet")}</p>}
          </Stat>
        </StatStrip>
      }>

      {res && res.data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={tr("Performance per section")} description={tr("Ratings of every visit of the period")}>
            <ul className="divide-y divide-slate-100">
              {res.sections.map((sec) => {
                const total = sec.under + sec.meet + sec.exceed;
                const pct = total ? Math.round(((sec.meet + sec.exceed) / total) * 1000) / 10 : null;
                return (
                  <li key={sec.key} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-800">{sec.title}</span>
                      <span className={cx("font-semibold tabular-nums", scoreTone(pct))}>{pct === null ? "—" : `${pct}%`}</span>
                    </div>
                    <Bar c={sec} className="mt-1.5" />
                    <p className="mt-1 text-[11px] text-slate-500">{sec.under} UNDER · {sec.meet} MEET · {sec.exceed} EXCEED</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title={tr("Most frequent findings")} description={tr("Items rated UNDER most often")}>
            {res.findings.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{tr("No UNDER in this period")}</p> : (
              <ul className="divide-y divide-slate-100">
                {res.findings.map((x) => (
                  <li key={x.key} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-red-50 px-2 text-xs font-bold tabular-nums text-red-700">{x.count}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{x.label}</span>
                      <span className="block truncate text-[11px] text-slate-500" title={x.branches.join(", ")}>{x.section} · {x.branches.join(", ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {res && res.data.length > 0 && !!res.platforms?.length && (
        <Panel title={tr("Outlet rating per platform")} description={tr("Average stars of the visits of the period: Google Maps automatic, delivery apps typed by the PIC")}>
          <ul className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
            {res.platforms.map((p) => (
              <li key={p.key} className="bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{PLATFORM_LABEL[p.platform]}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums text-slate-900">
                  <Star size={17} className={p.stars === null ? "text-slate-300" : "fill-amber-400 text-amber-400"} /> {p.stars === null ? "—" : fmtStars(p.stars)}
                </p>
                <p className="text-[11px] text-slate-500">{tr("{0} visits", fmtNumber(p.visits))}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or PIC")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""} · {tr("Times in WIB (server time)")}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : res && rows.length === 0 ? (
          <Empty icon={<ClipboardList size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No visit in this period")}>
            {!res.data.length && tr("Visits appear here as soon as the PICs send them from the Form menu.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => setOpen(v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{v.branchName}</span>
                      <span className="block truncate text-xs text-slate-500">{v.name} · {wibDateTime(v.submittedAt)}</span>
                      <Bar c={v.counts} className="mt-1.5 w-40" />
                    </span>
                    <span className="text-right">
                      <span className={cx("block text-base font-semibold tabular-nums", scoreTone(v.score))}>{v.score ?? "—"}%</span>
                      {v.counts.under > 0 && <span className="text-[11px] font-medium text-red-600">{v.counts.under} UNDER</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Sent")}</th>
                    <th className="px-4 py-2.5">{tr("Outlet")}</th>
                    <th className="px-4 py-2.5">{tr("PIC")}</th>
                    <th className="px-4 py-2.5">{tr("Result")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Score")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Photos")}</th>
                    <th className="px-4 py-2.5">{tr("Location")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!res ? <SkeletonRows cols={7} /> : paged.rows.map((v) => (
                    <tr key={v.id} onClick={() => setOpen(v.id)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">{wibDateTime(v.submittedAt)}</td>
                      <td className="max-w-[16rem] px-4 py-2.5"><span className="block truncate font-medium text-slate-900">{v.branchName}</span><span className="text-xs text-slate-400">{v.branchCode}</span></td>
                      <td className="px-4 py-2.5"><span className="block text-slate-800">{v.name}</span><span className="text-xs text-slate-400">@{v.username}</span></td>
                      <td className="w-56 px-4 py-2.5">
                        <Bar c={v.counts} />
                        <span className="mt-1 block text-[11px] text-slate-500"><span className={v.counts.under ? "font-semibold text-red-600" : ""}>{v.counts.under} UNDER</span> · {v.counts.meet} MEET · {v.counts.exceed} EXCEED</span>
                      </td>
                      <td className={cx("px-4 py-2.5 text-right text-base font-semibold tabular-nums", scoreTone(v.score))}>{v.score ?? "—"}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{v.photoCount ?? 0}</td>
                      <td className="px-4 py-2.5">
                        {v.distanceM === null ? <Badge>{tr("No position")}</Badge> : v.outsideRadius ? <Badge tone="red" icon={<MapPin size={11} />}>{v.distanceM} m</Badge> : <Badge tone="green">{v.distanceM} m</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <VisitFilters value={f} groups={groups} branches={branches} pics={res?.pics ?? []} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <VisitDrawer form={form} id={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function VisitFilters({ value, groups, branches, pics, onApply, onClose }: {
  value: F; groups: GroupOpt[]; branches: BranchOpt[]; pics: { id: string; name: string }[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F())} applyDisabled={days > 366}>
      <FilterSection title={tr("Visit day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={366} /></FilterSection>
      {groups.length > 0 && (
        <FilterSection title={tr("Branch group")}>
          <ChoiceGroup label="" value={d.group} onChange={(v) => setD({ ...d, group: v })}
            choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a group") }]} />
        </FilterSection>
      )}
      <FilterSection title={tr("Outlet")}>
        <SearchChoice label="" anyLabel={tr("All outlets")} value={d.branch} onChange={(v) => setD({ ...d, branch: v })} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name }))} />
      </FilterSection>
      <FilterSection title={tr("PIC")}>
        <SearchChoice label="" anyLabel={tr("All PICs")} value={d.user} onChange={(v) => setD({ ...d, user: v })} placeholder={tr("Search PIC")}
          options={pics.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterSection>
    </FilterSheet>
  );
}

/** One visit in full. */
function VisitDrawer({ form, id, onClose }: { form: VisitFormKey; id: string; onClose: () => void }) {
  const [v, setV] = useState<(Visit & { definition: Definition }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "under" | "notes">("all");
  useEffect(() => {
    call<Visit & { definition: Definition }>(`/api/monitoring/${form}/visits/${id}`).then(setV).catch((e) => setError((e as Error).message));
  }, [form, id]);
  const photosOf = (key: string) => (v?.photos ?? []).filter((p) => p.item === key);

  return (
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardList size={18} />} title={v ? v.branchName : tr("Visit")}
      description={v ? `${v.name} · ${wibDateTime(v.submittedAt)}` : undefined} focusFirstField={false}>
      {error ? <ErrorState message={error} /> : !v ? <div className="skeleton h-64 rounded-xl" /> : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-center sm:grid-cols-5">
            <div className="bg-white px-2 py-3"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Score")}</dt><dd className={cx("text-xl font-semibold tabular-nums", scoreTone(v.score))}>{v.score ?? "—"}%</dd></div>
            {RATINGS.map((r) => (
              <div key={r} className="bg-white px-2 py-3"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r}</dt>
                <dd className={cx("text-xl font-semibold tabular-nums", RATING_STYLE[r].text)}>{v.counts[r.toLowerCase() as "under" | "meet" | "exceed"]}</dd></div>
            ))}
            <div className="col-span-2 bg-white px-2 py-3 sm:col-span-1"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Photos")}</dt><dd className="text-xl font-semibold tabular-nums text-slate-900">{v.photos?.length ?? 0}</dd></div>
          </dl>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info icon={<UsersRound size={14} />} k={tr("PIC")} v={`${v.name} · @${v.username}`} />
            <Info icon={<CalendarDays size={14} />} k={tr("Started → sent")} v={`${wibDateTime(v.startedAt)} → ${wibDateTime(v.submittedAt)}`} />
            <Info icon={<MapPin size={14} />} k={tr("Location when sent")} v={v.latitude !== null && v.longitude !== null ? (
              <a href={mapsUrl(v.latitude, v.longitude)} target="_blank" rel="noreferrer" className={cx("hover:underline", v.outsideRadius ? "text-red-700" : "text-blue-700")}>
                {v.distanceM !== null ? tr("{0} m from the outlet", v.distanceM) : `${v.latitude.toFixed(5)}, ${v.longitude.toFixed(5)}`}{v.outsideRadius ? ` · ${tr("Outside radius")}` : ""} <ExternalLink size={11} className="inline" />
              </a>) : tr("No position")} />
          </div>

          <Segmented label={tr("Show")} value={show} onChange={setShow}
            options={[{ value: "all", label: tr("All items") }, { value: "under", label: tr("UNDER ({0})", v.counts.under) }, { value: "notes", label: tr("With notes or photos") }]} />

          {v.definition.groups.map((g) => {
            const sections = g.sections.map((sec) => ({ ...sec, items: sec.items.filter((it) => {
              const a = v.answers?.[it.key] ?? {};
              return show === "all" || (show === "under" ? a.rating === "UNDER" : !!a.note || photosOf(it.key).length > 0);
            }) })).filter((sec) => sec.items.length);
            if (!sections.length) return null;
            return (
              <section key={g.key} className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">{g.title} <span className="font-normal text-slate-400">· {g.subtitle}</span></p>
                {sections.map((sec) => (
                  <div key={sec.key} className="overflow-hidden rounded-xl border border-slate-200">
                    <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{sec.title}</p>
                    <ul className="divide-y divide-slate-100">
                      {sec.items.map((it) => {
                        const a = v.answers?.[it.key] ?? {};
                        const ph = photosOf(it.key);
                        return (
                          <li key={it.key} className={cx("px-3 py-2.5", a.rating === "UNDER" && "bg-red-50/40")}>
                            <div className="flex items-start gap-2">
                              <span className="w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{it.no}</span>
                              <span className="min-w-0 flex-1 text-sm text-slate-800">{it.label}
                                {a.stars != null && (
                                  <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold tabular-nums text-amber-800"
                                    title={a.source === "google" ? tr("Google Maps, automatic") : tr("Typed by the PIC")}>
                                    <Star size={11} className="fill-amber-400 text-amber-400" /> {fmtStars(a.stars)}
                                    {a.reviews != null && <span className="font-normal text-amber-700">· {tr("{0} reviews", fmtNumber(a.reviews))}</span>}
                                    <span className="font-normal text-amber-700">· {a.source === "google" ? "Google" : tr("manual")}</span>
                                  </span>
                                )}
                              </span>
                              {a.rating ? <span className={cx("rounded-md px-2 py-0.5 text-[11px] font-bold", RATING_STYLE[a.rating as Rating].on)}>{ratingLabel(a.rating as Rating)}</span>
                                : it.kind === "text" ? null : <span className="text-xs text-slate-400">—</span>}
                            </div>
                            {a.note && <p className="ml-7 mt-1 whitespace-pre-line text-sm text-slate-600">{a.note}</p>}
                            {ph.length > 0 && (
                              <div className="ml-7 mt-2 flex flex-wrap gap-2">
                                {ph.map((p) => (
                                  <a key={p.id} href={visitPhotoUrl(p.id)} target="_blank" rel="noreferrer" className="group block w-28">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                                    <img src={visitPhotoUrl(p.id)} alt={it.label} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200 group-hover:ring-blue-400" />
                                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{p.takenAt ? wibDateTime(p.takenAt) : wibDateTime(p.uploadedAt)}</span>
                                    {p.distanceM !== null && <span className={cx("block text-[10px]", p.outsideRadius ? "font-semibold text-red-600" : "text-slate-400")}>{tr("{0} m from the outlet", p.distanceM)}</span>}
                                  </a>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
          {show !== "all" && v.counts.under === 0 && show === "under" && <p className="py-6 text-center text-sm text-slate-400">{tr("No UNDER in this visit")}</p>}
          {v.signature ? (
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-end">
              {/* eslint-disable-next-line @next/next/no-img-element -- private signature image through the API */}
              <img src={visitSignatureUrl(v.id)} alt={tr("Signature")} className="h-24 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
              <div className="text-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><PenLine size={13} /> {tr("Signature")}</p>
                <p className="font-semibold text-slate-900">{v.signature.name ?? v.name}</p>
                {v.signature.signedAt && <p className="text-xs text-slate-500">{wibDateTime(v.signature.signedAt)}</p>}
              </div>
            </section>
          ) : <p className="text-xs text-slate-400">{tr("Sent without a signature.")}</p>}
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Images size={12} /> {tr("Photos are taken with the camera in the form, stamped with the time, the outlet and the position.")}</p>
        </div>
      )}
    </Drawer>
  );
}

function Info({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{icon}{k}</p>
      <div className="mt-0.5 text-sm text-slate-800">{v}</div>
    </div>
  );
}

