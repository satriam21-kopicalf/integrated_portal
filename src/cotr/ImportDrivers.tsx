'use client';

// Monitoring COTR → Master Driver → Import Excel: a file with the columns Armada, Nama, HP, or the "Report Armada"
// sheet of COTR ("BNI 01 BIYAN" …), read by the backend (POST /api/cotr/drivers/import): first a preview of the
// drivers new / changed / the same, then saved. One driver per armada; an unknown armada is created in the pool.

import { FileSpreadsheet, Save, Upload } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Field, Select, theadClass, useToast } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { call } from '@/so/features/checkin/checkin';
import { Pool } from '@/cotr/types';
import { tr } from '@/lib/i18n';

type Row = { armada: string; name: string; phone: string; code: string; action: 'new' | 'update' | 'same'; newArmada: boolean; current: string | null };
type Result = { rows: Row[]; new: number; update: number; same: number; newArmada: number; applied: boolean };

const ACTION: Record<Row['action'], { label: () => string; tone: 'green' | 'amber' | 'slate' }> = {
  new: { label: () => tr('New'), tone: 'green' }, update: { label: () => tr('Changed'), tone: 'amber' }, same: { label: () => tr('Same'), tone: 'slate' },
};

const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error(tr('The file cannot be read')));
  r.readAsDataURL(f);
});

export default function ImportDrivers({ pools, onClose, onDone }: { pools: Pool[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const usable = pools.filter((p) => p.kind !== 'storage');
  const [pool, setPool] = useState(usable[0]?.code ?? '');
  const [file, setFile] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async (apply: boolean, data = file) => {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const r = await call<Result>('/api/cotr/drivers/import', { method: 'POST', json: { file: data, pool, apply } });
      setResult(r);
      if (apply) { toast(tr('{0} new, {1} changed', r.new, r.update)); onDone(); onClose(); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setName(f.name);
    const data = await toBase64(f);
    setFile(data);
    await send(false, data);
  };
  const changes = result ? result.new + result.update : 0;
  return (
    <Drawer open onClose={onClose} size="lg" icon={<FileSpreadsheet size={18} />} title={tr('Import drivers from Excel')}
      description={tr('Columns Armada, Nama, HP — or the Report Armada sheet of COTR')}
      footer={<>
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
        <Button loading={busy} disabled={!result || !changes} onClick={() => void send(true)}><Save size={16} /> {tr('Save {0} drivers', changes)}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr('Pool / HUB')} required>
            <Select value={pool} onChange={(e) => { setPool(e.target.value); if (file) void send(false); }}>
              {usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label={tr('Excel file (.xlsx)')} required>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 lg:h-10">
              <Upload size={16} /> <span className="truncate">{name || tr('Choose a file')}</span>
              <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
          </Field>
        </div>
        {result && (
          <>
            <p className="flex flex-wrap gap-2 text-xs">
              <Badge tone="green">{tr('{0} new', result.new)}</Badge><Badge tone="amber">{tr('{0} changed', result.update)}</Badge>
              <Badge tone="slate">{tr('{0} the same', result.same)}</Badge>
              {result.newArmada > 0 && <Badge tone="violet">{tr('{0} new armada', result.newArmada)}</Badge>}
            </p>
            <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className={theadClass}><tr><th className="px-3 py-2">{tr('Armada')}</th><th className="px-3 py-2">{tr('Name')}</th><th className="px-3 py-2">{tr('Phone')}</th><th className="px-3 py-2" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((r) => (
                    <tr key={r.armada}>
                      <td className="px-3 py-2 font-mono text-xs">{r.armada}</td>
                      <td className="px-3 py-2">{r.name}{r.action === 'update' && r.current && <span className="block text-[11px] text-slate-400">{tr('now')}: {r.current}</span>}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{r.phone || '—'}</td>
                      <td className="px-3 py-2 text-right"><Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
