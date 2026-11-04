"use client";

// The result of a WW-WR audit opened from its share link (no sign-in; /share/wwwr/{token}, integrated_portal_be
// app/wwwr.py shared): the outlet, the team, the general evaluation, the action plans with who handles them and the
// revisit, the findings (UNDER) with their notes and photos, then every item. No score. Print / save as PDF from the
// browser (?print=1 opens the print dialog).

import { CheckCircle2, Loader2, Printer, ShieldCheck } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { cx } from "@/so/ui";
import { wibDateTime } from "@/so/lib/wib";
import { LANG_KEY, locale, tr, useLang } from "@/lib/i18n";
import { type ActionPlan, type Answer, type Audit, type Definition, type Rating, type VisitPhoto, RATING_STYLE, allItems, ratingLabel, tl } from "./visit";
import { thumb } from "@/lib/assets";

type Shared = { audit: Omit<Audit, "counts"> & { counts: Record<"product" | "outlet", { under: number; meet: number; exceed: number }> };
  definition: Definition; answers: Record<string, Answer>; photos: VisitPhoto[]; submittedAt: string | null; signedName: string | null };
const dayLong = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" }) : "—");

export default function WwwrShare() {
  return <Suspense><View /></Suspense>;
}

function View() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const { lang, setLang } = useLang();
  const [d, setD] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try { if (!window.localStorage.getItem(LANG_KEY)) setLang("id"); } catch { /* English */ }
  }, [setLang]);
  useEffect(() => {
    fetch(`/api/public/wwwr/${encodeURIComponent(token)}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? b.detail ?? tr("The link is not found or has expired")); setD(b); })
      .catch((e) => setError((e as Error).message));
  }, [token]);
  const printing = params.get("print") === "1";
  useEffect(() => { if (d && printing) setTimeout(() => window.print(), 600); }, [d, printing]);
  const items = useMemo(() => (d ? allItems(d.definition) : []), [d]);
  const photo = (id: string) => `/api/public/wwwr/${encodeURIComponent(token)}/photos/${id}`;
  if (error) return <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-sm text-neutral-600">{error}</div>;
  if (!d) return <div className="flex min-h-screen items-center justify-center gap-2 bg-neutral-100 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> {tr("Loading…")}</div>;
  const a = d.audit;
  const under = items.filter((it) => d.answers[it.key]?.rating === "UNDER");
  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <style>{`@media print { .no-print { display: none !important; } @page { size: A4; margin: 12mm; } .avoid { break-inside: avoid; } }`}</style>
      <header className="bg-[#0b1f4d] text-white print:bg-white print:text-neutral-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/calf-logo.png" alt="Kopi Calf" className="h-11 w-11 flex-shrink-0 rounded-xl bg-white object-contain p-1 print:ring-1 print:ring-neutral-200" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200 print:text-neutral-500">{tr("WW-WR audit result")}</p>
            <h1 className="truncate text-lg font-semibold">{a.branchName}</h1>
            <p className="text-xs text-brand-100/80 print:text-neutral-500">{dayLong(a.day)} · {tr("SWAT team")}: {a.members.map((m) => m.name).join(", ")}</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-[#0b1f4d]"><Printer size={14} /> {tr("Print / PDF")}</button>
            <div className="flex overflow-hidden rounded-lg ring-1 ring-white/25">
              {(["id", "en"] as const).map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={lang === l ? "bg-white px-2 py-1 text-[11px] font-semibold text-[#0b1f4d]" : "px-2 py-1 text-[11px] font-semibold text-white/80"}>{l.toUpperCase()}</button>)}
            </div>
          </div>
        </div>
        <div className="h-1 bg-brand-600 print:hidden" />
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact k={tr("Status")} v={a.status === "completed" ? <span className="text-emerald-700">{tr("Completed {0}", wibDateTime(a.completedAt))}</span> : <span className="text-amber-700">{tr("Follow-up in progress")}</span>} />
          <Fact k={tr("Sent")} v={`${wibDateTime(d.submittedAt)}${d.signedName ? ` · ${d.signedName}` : ""}`} />
          <Fact k={tr("Revisit")} v={dayLong(a.revisitOn)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["product", "outlet"] as const).map((p) => (
            <div key={p} className="avoid rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{p === "product" ? "Product" : "Outlet"}</p>
              <p className="mt-1 flex gap-4 text-sm">{(["UNDER", "MEET", "EXCEED"] as Rating[]).map((r) => <span key={r} className={RATING_STYLE[r].text}><b className="tabular-nums">{a.counts[p][r.toLowerCase() as "under"]}</b> {ratingLabel(r)}</span>)}</p>
            </div>
          ))}
        </div>

        <Block title={tr("General Evaluation")}><p className="whitespace-pre-line text-sm text-neutral-700">{a.summary || "—"}</p></Block>
        <Block title={tr("Action Plans")}>
          <table className="m-cards w-full text-sm">
            <thead><tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-500"><th className="py-2 pr-2">#</th><th className="py-2 pr-2">{tr("Action")}</th><th className="py-2 pr-2">{tr("Handled by")}</th><th className="py-2 pr-2">{tr("Due")}</th><th className="py-2">{tr("Status")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {a.actions.map((x: ActionPlan, i: number) => (
                <tr key={x.id} className="avoid align-top">
                  <td className="py-2 pr-2 text-neutral-400">{i + 1}</td>
                  <td className="py-2 pr-2"><span className="font-medium text-neutral-900">{x.title}</span>{x.detail && <span className="block text-xs text-neutral-500">{x.detail}</span>}{x.doneNote && <span className="block text-xs text-emerald-700">“{x.doneNote}”</span>}</td>
                  <td className="py-2 pr-2 text-neutral-700">{x.assignee ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-neutral-700">{dayLong(x.dueOn)}</td>
                  <td className="py-2">{x.status === "done" ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> {tr("Done")}</span> : <span className="text-amber-700">{tr("Open")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.revisitNote && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{tr("Revisit")}: {a.revisitNote}</p>}
        </Block>

        <Block title={tr("Findings (UNDER)")} subtitle={tr("{0} items", under.length)}>
          {under.length === 0 ? <p className="text-sm text-emerald-700">{tr("No UNDER in this audit")}</p> : (
            <ul className="space-y-3">
              {under.map((it) => {
                const ph = d.photos.filter((p) => p.item === it.key);
                return (
                  <li key={it.key} className="avoid rounded-xl border border-red-100 bg-red-50/40 p-3">
                    <p className="text-sm font-medium text-neutral-900">{tl(it)}</p>
                    <p className="text-[11px] text-neutral-500">{tl(it, "section")}</p>
                    {d.answers[it.key]?.note && <p className="mt-1 text-sm text-neutral-700">{d.answers[it.key]?.note}</p>}
                    {ph.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{ph.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={p.id} href={photo(p.id)} target="_blank" rel="noreferrer"><img src={thumb(photo(p.id), 240)} decoding="async" alt="" className="h-24 w-24 rounded-lg object-cover ring-1 ring-neutral-200" loading="lazy" /></a>
                    ))}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Block>

        <Block title={tr("Every Item")}>
          {d.definition.groups.map((g) => g.sections.filter((s) => !s.retired).map((s) => (
            <div key={s.key} className="avoid mb-4 last:mb-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{tl(g, "title")} · {tl(s, "title")}</p>
              <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {s.items.map((it) => {
                  const ans = d.answers[it.key];
                  return (
                    <li key={it.key} className="flex items-start gap-3 px-3 py-1.5 text-xs">
                      <span className="min-w-0 flex-1"><span className="text-neutral-800">{it.no}. {tl(it)}</span>{ans?.note && <span className="block text-neutral-500">{ans.note}</span>}</span>
                      {ans?.rating ? <span className={cx("flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold", RATING_STYLE[ans.rating].on)}>{ratingLabel(ans.rating)}</span> : <span className="text-neutral-300">—</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )))}
        </Block>
        <p className="flex items-center justify-center gap-1.5 pb-4 text-center text-[11px] text-neutral-400"><ShieldCheck size={12} /> {tr("Read-only copy of the SWAT audit for the PIC of the outlet; it always shows the latest follow-up.")}</p>
      </main>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{k}</p><p className="mt-0.5 text-sm font-medium text-neutral-900">{v}</p></div>;
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm print:shadow-none">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold text-neutral-900">{title}{subtitle && <span className="text-xs font-normal text-neutral-500">{subtitle}</span>}</h2>
      {children}
    </section>
  );
}
