"use client";

// Monitoring COTR → Master Fleet → Print labels (page cotr.fleet): the information label of an armada, in several
// layouts (sticker, compact, mini QR tag, A6 card, strip for the cargo box), with the COTR logo, the code in large
// type, what the vehicle is and a small QR that opens /share/fleet/{label_token} (the armada and its driver in full).
// The QRIS is never printed: it is shown to the customer only for a payment. Printed on an A4 sheet with cut lines or
// one label per page for a label printer; ?codes= preselects armada. A lost label is voided by replacing its QR.
// 2026-11-13: the COTR palette, the sticker with its facts in a grid, no "Kopi Calf" under the COTR logo.

import { useSearchParams } from "next/navigation";
import { Printer, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Field, Select, cx, useToast } from "@/so/ui";
import { SearchInput } from "@/components/kc";
import { Page, Panel } from "@/components/kc/compat";
import { Fleet, FleetType, Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

// the COTR palette (scripts/gen-theme.mjs: COTR_BLUE / COTR_RED 600)
const BLUE = "#141ede";
const RED = "#e41c24";
const LOGO = "/assets/Logo-COTR.png";

type Layout = "sticker" | "compact" | "tag" | "card" | "strip";
const LAYOUTS: Record<Layout, { w: number; h: number; name: string; use: string }> = {
  sticker: { w: 90, h: 55, name: "Sticker", use: "Body of the fleet" },
  compact: { w: 60, h: 40, name: "Compact", use: "Handlebar or small panel" },
  tag: { w: 40, h: 25, name: "Mini QR tag", use: "Frame, battery or key" },
  card: { w: 105, h: 148, name: "Card A6", use: "Cargo box or the pool board" },
  strip: { w: 150, h: 45, name: "Strip", use: "Back of the cargo box" },
};
type Mode = "sheet" | "roll";

type Info = { f: Fleet; qr: string | null; type: string; pool: string };

export default function LabelsPage() {
  return <Suspense><Labels /></Suspense>;
}

function Labels() {
  const params = useSearchParams();
  const toast = useToast();
  const fleet = useMaster<Fleet>("fleet");
  const types = useMaster<FleetType>("fleet-types");
  const pools = useMaster<Pool>("pools");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [layout, setLayout] = useState<Layout>("sticker");
  const [mode, setMode] = useState<Mode>("sheet");
  const [copies, setCopies] = useState(1);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");
  const [renewing, setRenewing] = useState<string | null>(null);
  const rows = useMemo(() => fleet.rows ?? [], [fleet.rows]);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (picked || !rows.length) return;
    const pre = (params.get("codes") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    setPicked(new Set(pre.length ? pre : rows.filter((f) => f.is_active).map((f) => f.code)));
  }, [rows, params, picked]);
  useEffect(() => {
    if (!origin) return;
    let live = true;
    void Promise.all(rows.filter((f) => f.label_token).map(async (f) =>
      [f.code, await QRCode.toDataURL(`${origin}/share/fleet/${f.label_token}`, { margin: 0, width: 480, errorCorrectionLevel: "M", color: { dark: "#0f172a" } })] as const))
      .then((list) => live && setQrs(Object.fromEntries(list)));
    return () => { live = false; };
  }, [rows, origin]);

  const chosen = rows.filter((f) => picked?.has(f.code));
  const [q, setQ] = useState("");
  const [poolFilter, setPoolFilter] = useState("");
  const listed = rows.filter((f) => (!poolFilter || f.pool_code === poolFilter)
    && (!q.trim() || `${f.code} ${f.name ?? ""} ${f.plate ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const toggle = (code: string) => setPicked((p) => { const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const info = (f: Fleet): Info => ({ f, qr: qrs[f.code] ?? null,
    type: types.rows?.find((t) => t.code === f.type)?.name ?? f.type, pool: pools.rows?.find((p) => p.code === f.pool_code)?.name ?? f.pool_code });
  const L = LAYOUTS[layout];
  const renew = async (code: string) => {
    if (!window.confirm(tr("Replace the QR of {0}? The labels printed before stop opening; print the new one.", code))) return;
    setRenewing(code);
    try {
      await call(`/api/cotr/fleet/${encodeURIComponent(code)}/label-token`, { method: "POST" });
      await fleet.load();
      toast(tr("New QR for {0}: print its label again", code), "ok");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRenewing(null);
    }
  };

  return (
    <Page eyebrow="Calf On The Road" media={<Printer size={19} />} title={tr("Fleet Labels")} subtitle={tr("Information label of the fleet: code, vehicle and a QR that opens its details and driver (the QRIS is not printed)")}
      actions={<Button disabled={!chosen.length || !origin} onClick={() => window.print()}><Printer size={16} /> {tr("Print {0}", chosen.length * copies)}</Button>}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .cotr-labels, .cotr-labels * { visibility: visible !important; }
        .cotr-labels { position: absolute; left: 0; top: 0; padding: 0 !important; background: none !important; border: 0 !important; }
        .cotr-label { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        ${mode === "roll"
          ? `@page { size: ${L.w}mm ${L.h}mm; margin: 0; } .cotr-labels { display: block !important; } .cotr-cut { outline: 0 !important; margin: 0 !important; break-after: page; page-break-after: always; }`
          : `@page { size: A4; margin: 8mm; } .cotr-labels { display: flex !important; flex-wrap: wrap; gap: 2mm; }`}
      }`}</style>

      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* the settings: model, print, which armada (a short scrolling list, not every code open at once) */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <Panel title={tr("Label Model")} description={tr("Choose the model of the label and how it is printed")}>
            <ul className="divide-y divide-neutral-100" role="radiogroup" aria-label={tr("Label Model")}>
              {(Object.keys(LAYOUTS) as Layout[]).map((k) => {
                const l = LAYOUTS[k];
                const on = layout === k;
                return (
                  <li key={k}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setLayout(k)}
                      className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors", on ? "bg-brand-50" : "hover:bg-neutral-50")}>
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
                        <span className={cx("rounded-[3px] border-2", on ? "border-brand-600 bg-white" : "border-neutral-300 bg-neutral-50")}
                          style={{ width: `${Math.min(32, (32 * l.w) / Math.max(l.w, l.h))}px`, height: `${Math.min(32, (32 * l.h) / Math.max(l.w, l.h))}px` }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx("block text-[13px] font-semibold", on ? "text-brand-800" : "text-neutral-900")}>{tr(l.name)} <span className="font-normal text-neutral-400">· {l.w} × {l.h} mm</span></span>
                        <span className="block truncate text-[11px] text-neutral-500">{tr(l.use)}</span>
                      </span>
                      <span className={cx("flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border", on ? "border-brand-600" : "border-neutral-300")}>
                        {on && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 p-4">
              <div className="col-span-2">
                <p className="mb-1.5 text-[13px] font-medium text-neutral-700">{tr("Print on")}</p>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1" role="radiogroup" aria-label={tr("Print on")}>
                  {([["sheet", tr("A4 sheet"), tr("with cut lines")], ["roll", tr("Label printer"), tr("one label per page")]] as const).map(([m, name, hint]) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                      className={cx("rounded-lg px-2 py-1.5 text-left transition-colors", mode === m ? "bg-white shadow-sm" : "hover:bg-white/60")}>
                      <span className={cx("block text-[13px] font-semibold", mode === m ? "text-brand-800" : "text-neutral-700")}>{name}</span>
                      <span className="block text-[11px] text-neutral-500">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label={tr("Copies per Fleet")}>
                <Select value={copies} onChange={(e) => setCopies(Number(e.target.value))}>
                  {[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
              <p className="col-span-2 text-[11px] text-neutral-500">{mode === "roll"
                ? tr("Set the paper of the label printer to {0} × {1} mm, margins none, scale 100%.", L.w, L.h)
                : tr("Print at scale 100% (not “fit to page”) so the label keeps its size.")}</p>
            </div>
          </Panel>

          <Panel title={tr("Fleet")} description={tr("{0} of {1} chosen", chosen.length, rows.length)}
            actions={<>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(listed.map((f) => f.code)))}>{tr("All")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>{tr("None")}</Button>
            </>}
            toolbar={<div className="flex gap-2">
              <SearchInput value={q} onChange={setQ} placeholder={tr("Search fleet")} />
              <Select value={poolFilter} onChange={(e) => setPoolFilter(e.target.value)} className="w-36" aria-label={tr("Pool / HUB")}>
                <option value="">{tr("All pools")}</option>
                {(pools.rows ?? []).filter((x) => x.kind !== "storage").map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
              </Select>
            </div>}>
            <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto overscroll-contain">
              {listed.map((f) => {
                const on = !!picked?.has(f.code);
                return (
                  <li key={f.code}>
                    <label className={cx("flex cursor-pointer items-center gap-3 px-4 py-2", on ? "bg-brand-50/60" : "hover:bg-neutral-50", !f.is_active && "opacity-60")}>
                      <input type="checkbox" checked={on} onChange={() => toggle(f.code)} className="h-4 w-4 accent-brand-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-neutral-900">{f.code}{f.name ? <span className="font-normal text-neutral-500"> · {f.name}</span> : null}</span>
                        <span className="block truncate text-[11px] text-neutral-400">{info(f).type} · {info(f).pool}{f.is_active ? "" : ` · ${tr("Inactive")}`}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
              {!listed.length && <li className="px-4 py-6 text-center text-xs text-neutral-400">{tr("No match")}</li>}
            </ul>
            {chosen.length === 1 && (
              <div className="space-y-2 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
                <p>{tr("Label lost or damaged? Replace its QR so the old one stops opening.")}</p>
                <Button size="sm" variant="secondary" loading={renewing === chosen[0].code} onClick={() => void renew(chosen[0].code)}><RefreshCw size={14} /> {tr("Replace QR of {0}", chosen[0].code)}</Button>
              </div>
            )}
          </Panel>
        </aside>

        <Panel title={tr("Preview")} description={chosen.length ? tr("{0} labels · {1}", chosen.length * copies, `${tr(L.name)} ${L.w} × ${L.h} mm`) : undefined}>
          <div className="cotr-labels flex flex-wrap gap-3 bg-neutral-50 p-4">
            {chosen.flatMap((f) => Array.from({ length: copies }, (_, i) => (
              <div key={`${f.code}-${i}`} className="cotr-cut" style={{ outline: "0.2mm dashed #94a3b8", outlineOffset: "0.6mm" }}>
                <Label layout={layout} x={info(f)} />
              </div>
            )))}
            {!chosen.length && <p className="w-full py-16 text-center text-sm text-neutral-400">{tr("Choose the fleet to print.")}</p>}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function Label({ layout, x }: { layout: Layout; x: Info }) {
  const l = LAYOUTS[layout];
  const box: CSSProperties = { width: `${l.w}mm`, height: `${l.h}mm` };
  const shell = "cotr-label relative flex overflow-hidden bg-white text-neutral-900 shadow-sm";
  const { f } = x;
  const vehicle = [f.brand, f.model].filter(Boolean).join(" ");
  if (layout === "tag") {
    return (
      <section className={cx(shell, "items-center gap-[2mm] rounded-[2mm] p-[2mm]")} style={{ ...box, border: `0.5mm solid ${BLUE}` }}>
        <Qr src={x.qr} mm={20} />
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" style={{ width: "8mm", height: "8mm" }} className="object-contain" />
          <p className="font-black leading-none tracking-tight" style={{ fontSize: "4.2mm" }}>{f.code}</p>
          <p className="truncate font-semibold uppercase" style={{ fontSize: "1.8mm", color: BLUE }}>{tr("Scan for info")}</p>
        </div>
      </section>
    );
  }
  if (layout === "compact") {
    return (
      <section className={cx(shell, "flex-col rounded-[2.5mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
        <header className="flex items-center gap-[1.5mm] px-[2.5mm] py-[1.5mm] text-white" style={{ background: BLUE }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" className="rounded-[1mm] bg-white object-contain p-[0.4mm]" style={{ width: "6mm", height: "6mm" }} />
          <span className="font-extrabold tracking-[0.12em]" style={{ fontSize: "2.2mm" }}>CALF ON THE ROAD</span>
        </header>
        <div className="flex flex-1 items-center gap-[2mm] px-[2.5mm]">
          <div className="min-w-0 flex-1">
            <p className="font-black leading-none tracking-tight" style={{ fontSize: "7mm" }}>{f.code}</p>
            <p className="mt-[1mm] truncate font-semibold" style={{ fontSize: "2.4mm" }}>{x.type}{f.plate ? ` · ${f.plate}` : ""}</p>
            <p className="truncate text-neutral-500" style={{ fontSize: "2.1mm" }}>{x.pool}</p>
          </div>
          <Qr src={x.qr} mm={19} />
        </div>
        <Footer size={1.8} />
      </section>
    );
  }
  if (layout === "strip") {
    return (
      <section className={cx(shell, "items-stretch rounded-[3mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
        <div className="flex flex-col items-center justify-center px-[3mm] text-white" style={{ background: BLUE, width: "38mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Calf On The Road" className="rounded-[2mm] bg-white object-contain p-[1mm]" style={{ width: "26mm", height: "26mm" }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-[4mm]">
          <p className="font-semibold uppercase tracking-[0.2em]" style={{ fontSize: "2.3mm", color: RED }}>{tr("Fleet")}</p>
          <p className="font-black leading-none tracking-tight" style={{ fontSize: "14mm" }}>{f.code}</p>
          <p className="mt-[1mm] truncate font-semibold" style={{ fontSize: "3mm" }}>{[f.name, x.type].filter(Boolean).join(" · ")}</p>
          <p className="truncate text-neutral-500" style={{ fontSize: "2.5mm" }}>{[f.plate, x.pool].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-[1mm] pr-[4mm]">
          <Qr src={x.qr} mm={26} />
          <span className="font-semibold uppercase" style={{ fontSize: "1.9mm", color: BLUE }}>{tr("Scan for info")}</span>
        </div>
        <span className="absolute bottom-0 left-[38mm] right-0" style={{ height: "1.2mm", background: RED }} />
      </section>
    );
  }
  if (layout === "card") {
    const facts: [string, string | number | null | undefined][] = [
      [tr("Type"), x.type], [tr("Make / model"), vehicle || null], [tr("Plate Number"), f.plate], [tr("Colour"), f.color],
      [tr("Pool / HUB"), x.pool], [tr("Asset Number"), f.asset_no], [tr("Capacity"), f.capacity ? tr("{0} cups", f.capacity) : null], [tr("Year Made"), f.year_made],
    ];
    return (
      <section className={cx(shell, "flex-col rounded-[4mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
        <header className="flex flex-col items-center px-[5mm] pb-[4mm] pt-[5mm] text-white" style={{ background: BLUE }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Calf On The Road" className="rounded-[3mm] bg-white object-contain p-[1.2mm]" style={{ width: "26mm", height: "26mm" }} />
          <p className="mt-[2.5mm] font-semibold uppercase tracking-[0.24em] text-white/80" style={{ fontSize: "2.4mm" }}>{tr("Fleet information")}</p>
        </header>
        <div className="h-[1.2mm]" style={{ background: RED }} />
        <div className="flex flex-1 flex-col items-center px-[6mm] pt-[4mm] text-center">
          <p className="font-black leading-none tracking-tight" style={{ fontSize: "15mm" }}>{f.code}</p>
          {f.name && <p className="mt-[1.5mm] font-semibold" style={{ fontSize: "3.6mm" }}>{f.name}</p>}
          <dl className="mt-[4mm] grid w-full grid-cols-2 gap-x-[4mm] gap-y-[2mm] text-left">
            {facts.filter(([, v]) => v !== null && v !== undefined && v !== "").slice(0, 6).map(([k, v]) => (
              <div key={k} className="min-w-0 border-b border-neutral-200 pb-[1mm]">
                <dt className="uppercase tracking-wide text-neutral-400" style={{ fontSize: "1.9mm" }}>{k}</dt>
                <dd className="truncate font-semibold" style={{ fontSize: "3mm" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex items-center gap-[4mm] pb-[3mm] pt-[3mm]">
            <Qr src={x.qr} mm={28} />
            <p className="max-w-[40mm] text-left leading-snug text-neutral-600" style={{ fontSize: "2.5mm" }}>
              <span className="block font-bold uppercase" style={{ color: BLUE, fontSize: "2.8mm" }}>{tr("Scan for info")}</span>
              {tr("The fleet in detail and the driver on duty")}
            </p>
          </div>
        </div>
        <Footer size={2.2} />
      </section>
    );
  }
  // sticker: the brand, the code, the name, then four facts in a grid; the QR on the right
  const facts = ([[tr("Type"), x.type], [tr("Pool / HUB"), x.pool], f.plate ? [tr("Plate Number"), f.plate] : [tr("Make / model"), vehicle || null],
    [tr("Capacity"), f.capacity ? tr("{0} cups", f.capacity) : null], [tr("Asset Number"), f.asset_no]] as [string, string | null][])
    .filter(([, v]) => v).slice(0, 4);
  return (
    <section className={cx(shell, "rounded-[3mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
      <span className="absolute inset-y-0 left-0" style={{ width: "2.2mm", background: BLUE }} />
      <div className="flex min-w-0 flex-1 flex-col py-[3mm] pl-[5mm] pr-[2.5mm]">
        <div className="flex items-center gap-[2mm]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Calf On The Road" className="object-contain" style={{ width: "10mm", height: "10mm" }} />
          <div className="leading-tight">
            <p className="font-extrabold tracking-[0.12em]" style={{ fontSize: "2.5mm", color: BLUE }}>CALF ON THE ROAD</p>
            <p className="font-semibold uppercase tracking-[0.18em]" style={{ fontSize: "1.9mm", color: RED }}>{tr("Fleet")}</p>
          </div>
        </div>
        <p className="mt-[2mm] font-black leading-none tracking-tight" style={{ fontSize: "10mm" }}>{f.code}</p>
        {f.name && <p className="mt-[1mm] truncate font-semibold" style={{ fontSize: "2.7mm" }}>{f.name}</p>}
        <dl className="mt-auto grid grid-cols-2 gap-x-[2.5mm] gap-y-[1.2mm] border-t border-neutral-200 pt-[1.5mm]">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="uppercase tracking-wide text-neutral-500" style={{ fontSize: "1.8mm" }}>{k}</dt>
              <dd className="truncate font-semibold" style={{ fontSize: "2.5mm" }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col items-center justify-center gap-[1.2mm] border-l border-dashed border-neutral-200 px-[3mm]">
        <Qr src={x.qr} mm={23} />
        <span className="font-bold uppercase" style={{ fontSize: "1.9mm", color: BLUE }}>{tr("Scan for info")}</span>
      </div>
      <span className="absolute bottom-0 left-[2.2mm] right-0" style={{ height: "0.8mm", background: RED }} />
    </section>
  );
}

function Qr({ src, mm }: { src: string | null; mm: number }) {
  const size = { width: `${mm}mm`, height: `${mm}mm` };
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR" style={size} className="flex-shrink-0" /> : <span style={size} className="flex-shrink-0 skeleton rounded" />;
}

function Footer({ size }: { size: number }) {
  return (
    <footer className="border-t border-neutral-200 px-[2mm] py-[0.8mm] text-center text-neutral-500" style={{ fontSize: `${size}mm` }}>
      {tr("Property of Kopi Calf · report if found")}
    </footer>
  );
}
