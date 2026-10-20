"use client";

// Preview before submitting a count (06.9 §12.16, D-62): everything the crew entered — the count, every quantity per
// area, the WIP, the evidence photos — and an optional signature with the signer's name. Nothing is sent until
// "Submit"; "Back" returns to the count to change it.

import { CheckCircle2, ClipboardCheck, Images, PenLine, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, cx, fmtDate, fmtDay, inputClass } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { type Count, type CountLine, countTypeLabel, fmtQty } from "@/so/lib/counts";
import { photoUrl } from "@/so/lib/photos";
import { useMe } from "@/so/lib/me";
import { tr } from "@/lib/i18n";
import SignaturePad from "./SignaturePad";

const unitOf = (l: CountLine) => l.esb_uom || l.base_uom;
const factorOf = (l: CountLine) => Number(l.esb_factor || 1) || 1;

function Qty({ l }: { l: CountLine }) {
  const wip = Number(l.qty_wip ?? 0);
  if (l.source === "WIP_EXPLODED") return <span className="text-violet-700">{fmtQty(l.qty_wip ?? "0")} {l.base_uom} <span className="text-[11px]">WIP</span></span>;
  const n = l.qty_base === null ? null : Number(l.qty_base) / factorOf(l);
  return (
    <span className={cx(n === 0 ? "text-slate-400" : "text-slate-900")}>
      {n === null ? "—" : `${fmtQty(n)} ${unitOf(l)}`}
      {wip > 0 && <span className="block text-[11px] text-violet-700">+ {fmtQty(wip)} {l.base_uom} WIP</span>}
    </span>
  );
}

export default function SubmitPreview({ count, open, busy, onClose, onSubmit }: {
  count: Count; open: boolean; busy: boolean; onClose: () => void;
  onSubmit: (signature: string | null, signedName: string) => void;
}) {
  const { me } = useMe();
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState(me?.full_name ?? "");
  const areas = useMemo(() => {
    const m = new Map<string, CountLine[]>();
    for (const l of count.lines) m.set(l.area, [...(m.get(l.area) ?? []), l]);
    return [...m.entries()];
  }, [count.lines]);
  const zero = count.lines.filter((l) => l.source !== "WIP_EXPLODED" && Number(l.qty_base ?? 0) === 0 && !Number(l.qty_wip ?? 0)).length;
  const wip = count.wip?.lines ?? [];
  const nameMissing = !!signature && !name.trim();

  return (
    <Drawer open={open} onClose={onClose} size="xl" icon={<ClipboardCheck size={18} />} title={tr("Check before submitting")}
      description={`${count.facility_name} · ${count.number}`} locked={busy} focusFirstField={false}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className={cx("text-xs sm:mr-auto", nameMissing ? "text-red-600" : "text-slate-500")}>
            {nameMissing ? tr("Write the signer's name under the signature.") : signature ? tr("Signed · the quantities are locked after submitting.") : tr("Signature is optional · the quantities are locked after submitting.")}
          </p>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{tr("Back to the count")}</Button>
          <Button loading={busy} disabled={nameMissing} onClick={() => onSubmit(signature, name.trim())}>
            <Send size={15} /> {signature ? tr("Sign & submit") : tr("Submit")}
          </Button>
        </div>
      }>
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <Info k={tr("Branch")} v={`${count.facility_name} (${count.facility_code})`} />
          <Info k={tr("Count type")} v={countTypeLabel(count.count_type, count.count_type_name)} />
          <Info k={tr("Count day")} v={fmtDay(count.business_date)} />
          <Info k={tr("Number")} v={count.number} />
          <Info k={tr("Started")} v={`${fmtDate(count.started_at)}${count.started_by_name ? ` · ${count.started_by_name}` : ""}`} />
          <Info k={tr("Counted")} v={tr("{0} of {1} lines", count.progress.counted, count.progress.lines)} />
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle2 size={16} className="text-emerald-600" /> {tr("Quantities")}
            <span className="text-xs font-normal text-slate-500">{tr("{0} items · {1} at 0", count.lines.length, zero)}</span>
          </h3>
          <div className="space-y-3">
            {areas.map(([area, lines]) => (
              <div key={area} className="overflow-hidden rounded-xl border border-slate-200">
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{area} · {lines.length}</p>
                <ul className="divide-y divide-slate-100 text-sm">
                  {lines.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-slate-800">{l.item_name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{l.item_code}</span>
                      </span>
                      <span className="flex-shrink-0 text-right tabular-nums"><Qty l={l} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {wip.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{tr("WIP / premix")}</h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {wip.map((w) => (
                <li key={w.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-slate-800">{w.name}</span>
                  <span className="tabular-nums text-slate-700">{fmtQty(w.qty)} {w.uom} · {fmtQty(w.qty_base)} g</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Images size={16} className="text-slate-500" /> {tr("Evidence photos")} <span className="font-normal text-slate-500">({count.photos.length})</span></h3>
          {count.photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">{tr("No evidence photos. They are optional; go back to the count to take some.")}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {count.photos.map((p) => (
                <li key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                  <img src={photoUrl(p.id)} alt={tr("Photo")} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><PenLine size={16} className="text-slate-500" /> {tr("Signature")} <span className="font-normal text-slate-500">({tr("optional")})</span></h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{tr("By signing, I confirm the quantities above are what was physically counted.")}</p>
          <SignaturePad onChange={setSignature} />
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{tr("Signer's name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={cx(inputClass, nameMissing && "border-red-400")} />
          </label>
        </section>
      </div>
    </Drawer>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</p>
      <p className="truncate font-medium text-slate-800" title={v}>{v}</p>
    </div>
  );
}
