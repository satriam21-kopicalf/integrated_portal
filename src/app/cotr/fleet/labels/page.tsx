"use client";

// Monitoring COTR → Master Fleet → Print labels (page cotr.fleet): stickers stuck on the vehicles — the code of the
// armada in large type, its name, pool and type, a QR code of the armada (scanned by the team to find it) and the QRIS
// of the armada when its image is uploaded. Printed through the browser (or saved as PDF); ?codes= preselects armada.

import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import QRCode from "qrcode";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Page, Panel, Select, cx } from "@/so/ui";
import { Fleet, FleetType, Pool } from "@/cotr/types";
import { imageUrl, useMaster } from "@/cotr/ui";
import { assetUrl } from "@/lib/assets";
import { tr } from "@/lib/i18n";

const SIZES = { a6: { w: "105mm", h: "148mm", label: "A6 (105 × 148 mm)" }, card: { w: "90mm", h: "60mm", label: "90 × 60 mm" } } as const;
type Size = keyof typeof SIZES;

export default function LabelsPage() {
  return <Suspense><Labels /></Suspense>;
}

function Labels() {
  const params = useSearchParams();
  const fleet = useMaster<Fleet>("fleet");
  const types = useMaster<FleetType>("fleet-types");
  const pools = useMaster<Pool>("pools");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [size, setSize] = useState<Size>("a6");
  const rows = useMemo(() => fleet.rows ?? [], [fleet.rows]);
  useEffect(() => {
    if (picked || !rows.length) return;
    const pre = (params.get("codes") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    setPicked(new Set(pre.length ? pre : rows.map((f) => f.code)));
  }, [rows, params, picked]);
  const chosen = rows.filter((f) => picked?.has(f.code));
  const toggle = (code: string) => setPicked((p) => { const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  return (
    <Page title={tr("Armada labels")} subtitle={tr("Stickers with the code, the QR of the armada and its QRIS, to stick on the vehicle")}
      actions={<>
        <Select value={size} onChange={(e) => setSize(e.target.value as Size)} className="h-10 w-48">
          {(Object.keys(SIZES) as Size[]).map((k) => <option key={k} value={k}>{SIZES[k].label}</option>)}
        </Select>
        <Button disabled={!chosen.length} onClick={() => window.print()}><Printer size={16} /> {tr("Print {0}", chosen.length)}</Button>
      </>}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .cotr-labels, .cotr-labels * { visibility: visible !important; }
        .cotr-labels { position: absolute; left: 0; top: 0; display: flex !important; flex-wrap: wrap; gap: 4mm; padding: 0; }
        .cotr-label { break-inside: avoid; page-break-inside: avoid; }
        @page { margin: 8mm; }
      }`}</style>
      <Panel title={tr("Armada")} description={tr("{0} of {1} chosen", chosen.length, rows.length)}
        actions={<>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(rows.map((f) => f.code)))}>{tr("All")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>{tr("None")}</Button>
        </>}>
        <ul className="flex flex-wrap gap-1.5 p-4">
          {rows.map((f) => (
            <li key={f.code}>
              <button type="button" onClick={() => toggle(f.code)}
                className={cx("rounded-full border px-3 py-1 text-xs font-medium", picked?.has(f.code) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600")}>{f.code}</button>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="cotr-labels flex flex-wrap gap-4">
        {chosen.map((f) => (
          <Label key={f.code} f={f} size={size} pool={pools.rows?.find((p) => p.code === f.pool_code)?.name ?? f.pool_code}
            type={types.rows?.find((t) => t.code === f.type)?.name ?? f.type} />
        ))}
      </div>
    </Page>
  );
}

function Label({ f, size, pool, type }: { f: Fleet; size: Size; pool: string; type: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(`COTR|${f.code}|${f.name ?? ""}`, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr);
  }, [f.code, f.name]);
  const big = size === "a6";
  const s = SIZES[size];
  return (
    <section className="cotr-label flex flex-col overflow-hidden rounded-xl border-2 border-slate-900 bg-white text-slate-900" style={{ width: s.w, height: s.h }}>
      <header className="flex items-center gap-2 bg-blue-700 px-3 py-2 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl("assets/calf-logo.png")} alt="" className="h-7 w-7 rounded bg-white object-contain p-0.5" />
        <span className="text-[11px] font-extrabold tracking-[0.18em]">CALF ON THE ROAD</span>
      </header>
      <div className={cx("flex flex-1 flex-col items-center justify-center text-center", big ? "gap-2 p-4" : "gap-1 p-2")}>
        <p className={cx("font-black leading-none tracking-tight", big ? "text-5xl" : "text-3xl")}>{f.code}</p>
        {f.name && <p className={cx("font-semibold", big ? "text-base" : "text-xs")}>{f.name}</p>}
        <p className="text-[10px] text-slate-600">{type} · {pool}</p>
        <div className={cx("flex items-center justify-center", big ? "mt-2 gap-4" : "gap-2")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR" className={big ? "h-28 w-28" : "h-16 w-16"} />}
          {f.has_qris && (
            <span className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl("fleet", f.code, "qris", f.updated_at)} alt="QRIS" className={cx("object-contain", big ? "h-28 w-28" : "h-16 w-16")} />
              <span className="text-[8px] font-semibold">QRIS{f.qris_nmid ? ` · ${f.qris_nmid}` : ""}</span>
            </span>
          )}
        </div>
      </div>
      <footer className="border-t border-slate-200 px-3 py-1 text-center text-[8px] text-slate-500">{tr("Property of Kopi Calf · report if found")}</footer>
    </section>
  );
}
