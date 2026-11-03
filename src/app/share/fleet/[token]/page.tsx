"use client";

// The page the QR of an armada label opens (no sign-in): the armada (photo, code, type, make, colour, plate, capacity,
// condition, service, asset number), its pool and the driver(s) on it with today's shift. Without sign-in the papers,
// the tracker, the QRIS and the phone numbers stay hidden; a signed-in COTR user gets them all (/api/cotr/fleet/{code}/card).

import { Bike, Building2, CalendarClock, CheckCircle2, Clock, Loader2, Lock, MapPin, Phone, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FleetCard } from "@/cotr/types";
import { LANG_KEY, tr, useLang } from "@/lib/i18n";
import { wibDate, wibDateTime } from "@/so/lib/wib";
import { thumb } from "@/lib/assets";

const BLUE = "#1e2bd6";

export default function FleetSharePage() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang } = useLang();
  const [card, setCard] = useState<FleetCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(LANG_KEY)) setLang("id");
    } catch {
      /* English */
    }
  }, [setLang]);
  useEffect(() => {
    let live = true;
    (async () => {
      const res = await fetch(`/api/public/fleet/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? body.detail ?? tr("This label is not known or has been replaced"));
      if (live) setCard(body);
      // a signed-in COTR user sees the full record; anyone else keeps the public one
      const full = await fetch(`/api/cotr/fleet/${encodeURIComponent(body.fleet.code)}/card`).catch(() => null);
      if (full?.ok && live) setCard(await full.json());
    })().catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [token]);

  const f = card?.fleet;
  const base = `/api/public/fleet/${encodeURIComponent(token)}`;
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <header className="text-white" style={{ background: BLUE }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Logo-COTR.png" alt="Calf On The Road" className="h-11 w-11 flex-shrink-0 rounded-xl bg-white object-contain p-1" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{tr("Armada information")}</p>
            <h1 className="truncate text-base font-bold">Calf On The Road</h1>
          </div>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/30" role="group" aria-label={tr("Language")}>
            {(["id", "en"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={lang === l ? "bg-white px-2 py-1 text-[11px] font-semibold" : "px-2 py-1 text-[11px] font-semibold text-white/80"}
                style={lang === l ? { color: BLUE } : undefined}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="h-1 bg-red-600" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {error ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600 shadow-sm">{error}</div>
        ) : !card || !f ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> {tr("Loading…")}</div>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="relative flex aspect-[16/9] items-center justify-center bg-neutral-100 text-neutral-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.has_photo ? <img src={thumb(`${base}/photo?v=${encodeURIComponent(f.updated_at ?? "")}`, 640)} decoding="async" loading="lazy" alt="" className="h-full w-full object-cover" /> : <Bike size={56} />}
                <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${f.is_active === false ? "bg-neutral-800 text-white" : f.condition === "service" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}`}>
                  {f.is_active === false ? tr("Not in use") : f.condition === "service" ? <><Wrench size={12} /> {tr("In service")}</> : <><CheckCircle2 size={12} /> {tr("Ready to sell")}</>}
                </span>
              </div>
              <div className="p-4">
                <p className="text-3xl font-black tracking-tight text-neutral-900">{f.code}</p>
                {f.name && <p className="text-sm font-semibold text-neutral-700">{f.name}</p>}
                <p className="mt-0.5 text-xs text-neutral-500">{[f.type_name ?? f.type, [f.brand, f.model].filter(Boolean).join(" "), f.color].filter(Boolean).join(" · ")}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Fact label={tr("Plate number")} value={f.plate} />
                  <Fact label={tr("Year made")} value={f.year_made} />
                  <Fact label={tr("Capacity")} value={f.capacity ? tr("{0} cups", f.capacity) : null} />
                  <Fact label={tr("Asset number")} value={f.asset_no} />
                  <Fact label={tr("Acquired on")} value={day(f.acquired_on)} />
                  <Fact label={tr("Last service")} value={day(f.last_service)} />
                  <Fact label={tr("Next service")} value={day(f.next_service)} />
                  {card.full && <>
                    <Fact label={tr("Frame number")} value={f.frame_no} />
                    <Fact label={tr("Battery number")} value={f.battery_no} />
                    <Fact label={tr("Odometer (km)")} value={f.odometer_km?.toLocaleString("id-ID")} />
                    <Fact label={tr("GPS tracker ID")} value={f.gps_id} />
                  </>}
                </dl>
              </div>
            </section>

            {card.full && (
              <Section icon={<ShieldCheck size={16} />} title={tr("Papers")}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Fact label={tr("STNK number")} value={f.stnk_no} />
                  <Fact label={tr("STNK valid until")} value={day(f.stnk_expires)} warn={soon(f.stnk_expires)} />
                  <Fact label={tr("Insurance policy")} value={f.insurance_no} />
                  <Fact label={tr("Insurance valid until")} value={day(f.insurance_expires)} warn={soon(f.insurance_expires)} />
                  <Fact label={tr("QRIS")} value={[f.qris_bank, f.qris_nmid].filter(Boolean).join(" · ") || null} />
                  <Fact label={tr("Merchant name")} value={f.qris_merchant} />
                </dl>
                {f.note && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">{f.note}</p>}
              </Section>
            )}

            <Section icon={<UserRound size={16} />} title={tr("Driver")}>
              {card.today && (
                <p className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${card.today.status === "open" ? "bg-emerald-50 text-emerald-800" : "bg-neutral-50 text-neutral-600"}`}>
                  <Clock size={14} /> {card.today.status === "open"
                    ? tr("On the road today with {0} since {1}", card.today.name, wibDateTime(card.today.startedAt).slice(-5))
                    : tr("Shift of {0} closed at {1}", card.today.name, wibDateTime(card.today.endedAt).slice(-5))}
                </p>
              )}
              {card.drivers.length === 0 ? <p className="text-sm text-neutral-500">{tr("No driver on this armada yet.")}</p> : (
                <ul className="space-y-3">
                  {card.drivers.map((d) => (
                    <li key={d.code} className="flex gap-3">
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 text-neutral-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {d.has_photo ? <img src={thumb(`${base}/driver/${encodeURIComponent(d.code)}/photo?v=${encodeURIComponent(d.updated_at ?? "")}`, 96)} decoding="async" loading="lazy" alt="" className="h-full w-full object-cover" /> : <UserRound size={24} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900">{d.name}{d.nickname ? <span className="font-normal text-neutral-500"> ({d.nickname})</span> : null}</p>
                        <p className="text-xs text-neutral-500">{[d.employee_id, d.position ?? d.department, d.pool_name].filter(Boolean).join(" · ")}</p>
                        <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${d.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{d.status === "active" ? tr("Active") : tr("On leave")}</span>
                          {d.joined_on && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">{tr("Joined {0}", day(d.joined_on) ?? "")}</span>}
                        </p>
                        {card.full && d.phone && <a href={`tel:${d.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700"><Phone size={12} /> {d.phone}</a>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {card.pool && (
              <Section icon={<Building2 size={16} />} title={tr("Pool / HUB")}>
                <p className="font-semibold text-neutral-900">{card.pool.name}</p>
                {(card.pool.address || card.pool.city) && <p className="mt-0.5 flex items-start gap-1 text-xs text-neutral-500"><MapPin size={12} className="mt-0.5 flex-shrink-0" /> {[card.pool.address, card.pool.city].filter(Boolean).join(", ")}</p>}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                  {card.pool.pic_name && <span>PIC: {card.pool.pic_name}</span>}
                  {card.pool.open_time && <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {card.pool.open_time}–{card.pool.close_time ?? ""}</span>}
                  {card.pool.phone && <a href={`tel:${card.pool.phone}`} className="inline-flex items-center gap-1 font-medium text-brand-700"><Phone size={12} /> {card.pool.phone}</a>}
                </p>
              </Section>
            )}

            {!card.full && (
              <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-neutral-400">
                <Lock size={12} className="mt-px flex-shrink-0" /> {tr("Papers, tracker and contacts are shown to the COTR team after signing in to the portal.")}
              </p>
            )}
          </>
        )}
      </main>
      <footer className="border-t border-neutral-200 bg-white">
        <p className="mx-auto max-w-2xl px-4 py-3 text-center text-[11px] text-neutral-400">{tr("Property of Kopi Calf · Calf On The Road")}</p>
      </footer>
    </div>
  );
}

function day(v: string | null | undefined): string | null {
  if (!v) return null;
  return new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function soon(v: string | null | undefined): boolean {
  return !!v && v.slice(0, 10) <= wibDate(new Date(Date.now() + 30 * 86_400_000));
}

function Fact({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className={`truncate font-medium ${warn ? "text-red-600" : "text-neutral-800"}`}>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"><span style={{ color: BLUE }}>{icon}</span> {title}</h2>
      {children}
    </section>
  );
}
