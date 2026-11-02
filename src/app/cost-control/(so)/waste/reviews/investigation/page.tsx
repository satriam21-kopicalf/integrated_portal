"use client";

// The printable investigation (page cc.waste-review): the layout of the form FM-QAQC-03 "Investigasi Komplain & Waste"
// (docs/Form Investigasi Waste), filled from the investigation of waste entries (migration 055). Print → A4 or PDF.

import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { call } from "@/so/features/checkin/checkin";
import { CHECKS, fmtQty, type Investigation, SIGNERS, SOURCES, WASTE_KINDS } from "@/so/features/waste/waste";
import { tr } from "@/lib/i18n";

const longDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex gap-2"><span className="w-40 flex-shrink-0">{label}</span><span className="flex-1 border-b border-slate-400">: {value}</span></div>;
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[6rem] whitespace-pre-wrap border border-slate-700 p-3">{children}</div>;
}

function Sheet() {
  const id = useSearchParams().get("id") ?? "";
  const [inv, setInv] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) call<Investigation>(`/api/waste/investigations/${id}`).then(setInv).catch((e: Error) => setError(e.message)); }, [id]);
  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!inv) return <div className="skeleton m-8 h-[80vh] rounded-xl" />;
  const r = inv.report;
  const mark = (on: boolean) => <span className="inline-block w-6 text-center font-semibold">( {on ? "✓" : " "} )</span>;
  const pick = (list: string[], on: (x: string) => boolean) => list.map((x, i) => (
    <span key={x}>{i ? ", " : ""}<span className={on(x) ? "rounded-full border border-slate-900 px-1" : ""}>{x}</span></span>
  ));
  const entries = Array.isArray(inv.entries) ? inv.entries : [];
  return (
    <div className="print-sheet mx-auto my-6 w-[210mm] max-w-full bg-white p-[12mm] text-[11px] leading-snug text-slate-900 shadow print:my-0 print:shadow-none">
      <table className="w-full border-collapse border border-slate-700">
        <tbody>
          <tr>
            <td rowSpan={2} className="w-28 border border-slate-700 p-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/calf-logo.png" alt="Calf" className="mx-auto h-10 object-contain" />
            </td>
            <td className="border border-slate-700 p-1 text-center font-semibold">FORM</td>
            <td className="w-40 border border-slate-700 p-1 text-[10px]">No : FM - QAQC - 03<br />Date : 19 Oktober 2026</td>
          </tr>
          <tr>
            <td className="border border-slate-700 p-1 text-center font-semibold">INVESTIGASI KOMPLAIN &amp; WASTE</td>
            <td className="border border-slate-700 p-1 text-[10px]">Rev : 00</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex justify-between"><span>No. Laporan : {String(inv.reportNo).padStart(2, "0")}</span><span>Tanggal Investigasi : {longDate(r.date)}</span></div>

      <h2 className="mt-4 font-bold">A. KATEGORI KEJADIAN/INSIDEN</h2>
      <div className="mt-1 grid grid-cols-[10rem_3rem_1fr] gap-y-1">
        <span>KOMPLAIN PELANGGAN</span>{mark(r.incident !== "waste")}<span>Sumber (*) : {pick(SOURCES, (x) => r.source === x)}</span>
        <span>INSIDEN WASTE</span>{mark(r.incident !== "complaint")}<span>Kategori Waste (*) : {pick(WASTE_KINDS, (x) => r.wasteKinds.includes(x))}</span>
      </div>

      <h2 className="mt-4 font-bold">B. RINCIAN OBJEK &amp; KRONOLOGI KEJADIAN</h2>
      <div className="mt-1 grid grid-cols-2 gap-x-8 gap-y-1.5">
        <Line label="Nama Menu / Bahan Baku" value={r.object} />
        <Line label="No. Batch / Kode Produksi" value={r.batch || "-"} />
        <Line label="Quantity" value={r.qty} />
        <Line label="Tanggal & Waktu Kejadian" value={longDate(r.incidentAt)} />
        <Line label="Nama & Lokasi Outlet" value={r.outlet} />
        <Line label="PIC/Staff/Penanggung Jawab" value={r.pic} />
      </div>
      {entries.some((e) => e.ingredients?.length) && (
        <div className="mt-2">
          <p className="font-semibold">Rincian bahan premix / WIP:</p>
          {entries.filter((e) => e.ingredients?.length).map((e) => (
            <p key={e.id}>{e.itemName} {e.grams ? `(${fmtQty(e.grams)} g)` : ""}: {e.ingredients!.map((c) => `${c.name} ${fmtQty(c.grams)} g`).join(", ")}</p>
          ))}
        </div>
      )}
      <p className="mt-3 font-bold">DESKRIPSI KRONOLOGI/DETAIL TEMUAN :</p>
      <Box>{r.chronology}</Box>

      <h2 className="mt-4 font-bold">C. ANALISIS INVESTIGASI &amp; AKAR MASALAH (ROOT CAUSE ANALYSIS)</h2>
      <p className="font-semibold">Parameter Pengecekan QA (Centang yang relevan &amp; isi hasil temuan)</p>
      <div className="mt-1 space-y-1">
        {CHECKS.map((c) => {
          const v = r.checks[c] ?? { checked: false, finding: "" };
          return (
            <div key={c} className="grid grid-cols-[3rem_16rem_6rem_1fr] items-end">
              {mark(v.checked)}<span>{c}</span><span>Hasil Temuan</span><span className="border-b border-slate-400">: {v.finding}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-bold">KESIMPULAN AKAR MASALAH (PENYEBAB TEMUAN TERJADI) :</p>
      <Box>{r.rootCause}</Box>

      <h2 className="mt-4 font-bold">D. TINDAKAN PENANGANAN &amp; PERBAIKAN (CORRECTIVE ACTION)</h2>
      <p className="mt-1">CORRECTIVE ACTION - Tindakan Langsung (Retur atau kompensasi ke customer/ Penanganan Waste )</p>
      <Box>{r.corrective}</Box>
      <p className="mt-3">PREVENTIVE ACTION - Tindakan Pencegahan Jangka Panjang (Mencegah Terulang Kembali)</p>
      <Box>{r.preventive}</Box>

      <table className="mt-6 w-full border-collapse border border-slate-700 text-center" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr>{SIGNERS.map((s) => <td key={s.key} className="w-1/3 border border-slate-700 p-1">{s.title},</td>)}</tr>
          <tr>{SIGNERS.map((s) => (
            <td key={s.key} className="h-24 border border-slate-700 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {inv.signatures[s.key]?.image ? <img src={inv.signatures[s.key]!.image!} alt="" className="mx-auto max-h-20 object-contain" /> : null}
            </td>
          ))}</tr>
          <tr>{SIGNERS.map((s) => <td key={s.key} className="border border-slate-700 p-1 text-left">Nama : {inv.signatures[s.key]?.name ?? ""}</td>)}</tr>
          <tr>{SIGNERS.map((s) => <td key={s.key} className="border border-slate-700 p-1">{inv.signatures[s.key]?.role || s.role}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export default function InvestigationPrintPage() {
  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-slate-100 print:static print:bg-white">
      <style>{`@media print { @page { size: A4; margin: 0 } body * { visibility: hidden } .print-sheet, .print-sheet * { visibility: visible } .print-sheet { position: absolute; left: 0; top: 0; width: 210mm } }`}</style>
      <div className="sticky top-0 z-10 flex justify-end gap-2 bg-slate-100/90 px-4 py-2 backdrop-blur print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white"><Printer size={15} />{tr("Print / PDF")}</button>
      </div>
      <Suspense><Sheet /></Suspense>
    </div>
  );
}
