"use client";

// Monitoring COTR → Master Fleet → Print labels (page cotr.fleet): the information label of an armada, in several
// layouts (sticker, compact, mini QR tag, A6 card, strip for the cargo box), with the COTR logo, the code in large
// type, what the vehicle is and a small QR that opens /share/fleet/{label_token} (the armada and its driver in full).
// The QRIS is never printed: it is shown to the customer only for a payment. Printed on an A4 sheet with cut lines or
// one label per page for a label printer; ?codes= preselects armada. A lost label is voided by replacing its QR.

import { useSearchParams } from "next/navigation";
import { Printer, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Page, Panel, Select, cx, useToast } from "@/so/ui";
import { Fleet, FleetType, Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

const BLUE = "#1e2bd6";
const RED = "#e11d2a";
const LOGO = "/assets/Logo-COTR.png";

type Layout = "sticker" | "compact" | "tag" | "card" | "strip";
const LAYOUTS: Record<Layout, { w: number; h: number; name: string; use: string }> = {
  sticker: { w: 90, h: 55, name: "Sticker", use: "Body of the armada" },
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
    <Page title={tr("Armada labels")} subtitle={tr("Information label of the armada: code, vehicle and a QR that opens its details and driver (the QRIS is not printed)")}
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

      <Panel title={tr("Layout")} description={tr("Choose the model of the label and how it is printed")}>
        <div className="grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(LAYOUTS) as Layout[]).map((k) => {
            const l = LAYOUTS[k];
            return (
              <button key={k} type="button" onClick={() => setLayout(k)} aria-pressed={layout === k}
                className={cx("flex items-center gap-3 rounded-xl border p-3 text-left transition", layout === k ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:border-slate-300")}>
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
                  <span className={cx("rounded-sm border-2", layout === k ? "border-blue-600 bg-white" : "border-slate-300 bg-slate-50")}
                    style={{ width: `${Math.min(44, (44 * l.w) / Math.max(l.w, l.h))}px`, height: `${Math.min(44, (44 * l.h) / Math.max(l.w, l.h))}px` }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{tr(l.name)}</span>
                  <span className="block text-[11px] text-slate-500">{l.w} × {l.h} mm</span>
                  <span className="block text-[11px] text-slate-400">{tr(l.use)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4">
          <label className="text-xs font-medium text-slate-600">{tr("Print on")}
            <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="mt-1 h-10 w-64">
              <option value="sheet">{tr("A4 sheet with cut lines")}</option>
              <option value="roll">{tr("Label printer (one label per page)")}</option>
            </Select>
          </label>
          <label className="text-xs font-medium text-slate-600">{tr("Copies per armada")}
            <Select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="mt-1 h-10 w-32">
              {[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </label>
          <p className="pb-2 text-[11px] text-slate-500">{mode === "roll"
            ? tr("Set the paper of the label printer to {0} × {1} mm, margins none, scale 100%.", L.w, L.h)
            : tr("Print at scale 100% (not “fit to page”) so the label keeps its size.")}</p>
        </div>
      </Panel>

      <Panel title={tr("Armada")} description={tr("{0} of {1} chosen", chosen.length, rows.length)}
        actions={<>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(rows.map((f) => f.code)))}>{tr("All")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>{tr("None")}</Button>
        </>}>
        <ul className="flex flex-wrap gap-1.5 p-4">
          {rows.map((f) => (
            <li key={f.code}>
              <button type="button" onClick={() => toggle(f.code)}
                className={cx("rounded-full border px-3 py-1 text-xs font-medium", picked?.has(f.code) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600", !f.is_active && "opacity-60")}>{f.code}</button>
            </li>
          ))}
        </ul>
        {chosen.length === 1 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            {tr("Label lost or damaged? Replace its QR so the old one stops opening.")}
            <Button size="sm" variant="secondary" loading={renewing === chosen[0].code} onClick={() => void renew(chosen[0].code)}><RefreshCw size={14} /> {tr("Replace QR of {0}", chosen[0].code)}</Button>
          </div>
        )}
      </Panel>

      <div className="cotr-labels flex flex-wrap gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        {chosen.flatMap((f) => Array.from({ length: copies }, (_, i) => (
          <div key={`${f.code}-${i}`} className="cotr-cut" style={{ outline: "0.2mm dashed #94a3b8", outlineOffset: "0.6mm" }}>
            <Label layout={layout} x={info(f)} />
          </div>
        )))}
        {!chosen.length && <p className="w-full py-10 text-center text-sm text-slate-400">{tr("Choose the armada to print.")}</p>}
      </div>
    </Page>
  );
}

function Label({ layout, x }: { layout: Layout; x: Info }) {
  const l = LAYOUTS[layout];
  const box: CSSProperties = { width: `${l.w}mm`, height: `${l.h}mm` };
  const shell = "cotr-label relative flex overflow-hidden bg-white text-slate-900 shadow-sm";
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
            <p className="truncate text-slate-500" style={{ fontSize: "2.1mm" }}>{x.pool}</p>
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
          <img src={LOGO} alt="Calf On The Road" className="rounded-[2mm] bg-white object-contain p-[1mm]" style={{ width: "24mm", height: "24mm" }} />
          <span className="mt-[1.5mm] font-extrabold tracking-[0.14em]" style={{ fontSize: "2.2mm" }}>KOPI CALF</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-[4mm]">
          <p className="font-semibold uppercase tracking-[0.2em]" style={{ fontSize: "2.3mm", color: RED }}>{tr("Armada")}</p>
          <p className="font-black leading-none tracking-tight" style={{ fontSize: "14mm" }}>{f.code}</p>
          <p className="mt-[1mm] truncate font-semibold" style={{ fontSize: "3mm" }}>{[f.name, x.type].filter(Boolean).join(" · ")}</p>
          <p className="truncate text-slate-500" style={{ fontSize: "2.5mm" }}>{[f.plate, x.pool].filter(Boolean).join(" · ")}</p>
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
      [tr("Type"), x.type], [tr("Make / model"), vehicle || null], [tr("Plate number"), f.plate], [tr("Colour"), f.color],
      [tr("Pool / HUB"), x.pool], [tr("Asset number"), f.asset_no], [tr("Capacity"), f.capacity ? tr("{0} cups", f.capacity) : null], [tr("Year made"), f.year_made],
    ];
    return (
      <section className={cx(shell, "flex-col rounded-[4mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
        <header className="flex flex-col items-center px-[5mm] pb-[4mm] pt-[5mm] text-white" style={{ background: BLUE }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Calf On The Road" className="rounded-[3mm] bg-white object-contain p-[1.2mm]" style={{ width: "26mm", height: "26mm" }} />
          <p className="mt-[2.5mm] font-semibold uppercase tracking-[0.24em] text-white/80" style={{ fontSize: "2.4mm" }}>{tr("Armada information")}</p>
        </header>
        <div className="h-[1.2mm]" style={{ background: RED }} />
        <div className="flex flex-1 flex-col items-center px-[6mm] pt-[4mm] text-center">
          <p className="font-black leading-none tracking-tight" style={{ fontSize: "15mm" }}>{f.code}</p>
          {f.name && <p className="mt-[1.5mm] font-semibold" style={{ fontSize: "3.6mm" }}>{f.name}</p>}
          <dl className="mt-[4mm] grid w-full grid-cols-2 gap-x-[4mm] gap-y-[2mm] text-left">
            {facts.filter(([, v]) => v !== null && v !== undefined && v !== "").slice(0, 6).map(([k, v]) => (
              <div key={k} className="min-w-0 border-b border-slate-200 pb-[1mm]">
                <dt className="uppercase tracking-wide text-slate-400" style={{ fontSize: "1.9mm" }}>{k}</dt>
                <dd className="truncate font-semibold" style={{ fontSize: "3mm" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex items-center gap-[4mm] pb-[3mm] pt-[3mm]">
            <Qr src={x.qr} mm={28} />
            <p className="max-w-[40mm] text-left leading-snug text-slate-600" style={{ fontSize: "2.5mm" }}>
              <span className="block font-bold uppercase" style={{ color: BLUE, fontSize: "2.8mm" }}>{tr("Scan for info")}</span>
              {tr("The armada in detail and the driver on duty")}
            </p>
          </div>
        </div>
        <Footer size={2.2} />
      </section>
    );
  }
  // sticker
  return (
    <section className={cx(shell, "rounded-[3mm]")} style={{ ...box, border: `0.4mm solid #cbd5e1` }}>
      <span className="absolute inset-y-0 left-0" style={{ width: "2.2mm", background: BLUE }} />
      <div className="flex min-w-0 flex-1 flex-col py-[3mm] pl-[5mm] pr-[2mm]">
        <div className="flex items-center gap-[2mm]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Calf On The Road" className="object-contain" style={{ width: "11mm", height: "11mm" }} />
          <div className="leading-tight">
            <p className="font-extrabold tracking-[0.12em]" style={{ fontSize: "2.5mm", color: BLUE }}>CALF ON THE ROAD</p>
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-400" style={{ fontSize: "1.9mm" }}>{tr("Armada")}</p>
          </div>
        </div>
        <p className="mt-[2.5mm] font-black leading-none tracking-tight" style={{ fontSize: "10mm" }}>{f.code}</p>
        <p className="mt-[1.2mm] truncate font-semibold" style={{ fontSize: "2.8mm" }}>{f.name ?? x.type}</p>
        <p className="truncate text-slate-500" style={{ fontSize: "2.3mm" }}>{[f.name ? x.type : null, vehicle || null, f.plate].filter(Boolean).join(" · ")}</p>
        <p className="mt-auto truncate font-semibold" style={{ fontSize: "2.3mm", color: RED }}>{x.pool}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-[1.2mm] border-l border-dashed border-slate-200 px-[3mm]">
        <Qr src={x.qr} mm={22} />
        <span className="font-bold uppercase" style={{ fontSize: "1.9mm", color: BLUE }}>{tr("Scan for info")}</span>
        {f.asset_no && <span className="text-slate-400" style={{ fontSize: "1.7mm" }}>{f.asset_no}</span>}
      </div>
    </section>
  );
}

function Qr({ src, mm }: { src: string | null; mm: number }) {
  const size = { width: `${mm}mm`, height: `${mm}mm` };
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR" style={size} className="flex-shrink-0" /> : <span style={size} className="flex-shrink-0 animate-pulse rounded bg-slate-100" />;
}

function Footer({ size }: { size: number }) {
  return (
    <footer className="border-t border-slate-200 px-[2mm] py-[0.8mm] text-center text-slate-500" style={{ fontSize: `${size}mm` }}>
      {tr("Property of Kopi Calf · report if found")}
    </footer>
  );
}
