'use client';

// Monitoring COTR → Master Driver → Import Excel (POST /api/cotr/drivers/import), two formats read by the backend:
// - the workbook "DATA COTR" (migration 060): every employee of COTR from the sheet DATA COTR (placement → pool,
//   department, employee id, nickname), the bike of DATA SEPEDA ARMADA and the QRIS armada of the Report sheets;
// - an armada file: the columns Armada, Nama, HP or the "Report Armada" sheet ("BNI 01 BIYAN" …), into one pool.
// First a preview (new / changed / the same, the rows left out), then saved.

import { FileSpreadsheet, Save, Upload, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Field, Select, cx, theadClass, useToast } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { call } from '@/so/features/checkin/checkin';
import { Pool } from '@/cotr/types';
import { tr } from '@/lib/i18n';

type Action = 'new' | 'update' | 'same';
type ArmadaRow = { armada: string; name: string; phone: string; code: string; action: Action; newArmada: boolean; current: string | null };
type TeamRow = { employeeId: string; name: string; nickname: string; placement: string; pool: string | null; department: string; bike: string;
  armada: string | null; code: string; action: Action; newArmada: boolean; reason?: string };
type Result = { rows: (ArmadaRow | TeamRow)[]; new: number; update: number; same: number; newArmada: number; applied: boolean;
  format?: 'team'; skipped?: TeamRow[]; departments?: Record<string, number> };

const ACTION: Record<Action, { label: () => string; tone: 'green' | 'amber' | 'slate' }> = {
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
  const [dept, setDept] = useState('');
  const team = result?.format === 'team';
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
  const poolName = (code: string | null) => pools.find((p) => p.code === code)?.name ?? code ?? '—';
  const teamRows = useMemo(() => (team ? (result!.rows as TeamRow[]).filter((r) => !dept || r.department === dept) : []), [team, result, dept]);
  return (
    <Drawer open onClose={onClose} size="xl" icon={<FileSpreadsheet size={18} />} title={tr('Import the COTR team from Excel')}
      description={tr('The workbook DATA COTR (every employee, pool by placement) or an armada file (Armada, Nama, HP / Report Armada)')}
      footer={<>
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
        <Button loading={busy} disabled={!result || !changes} onClick={() => void send(true)}><Save size={16} /> {tr('Save {0} people', changes)}</Button>
      </>}>
      <div className="space-y-4">
        <div className={cx('grid gap-3', !team && 'sm:grid-cols-2')}>
          {!team && (
            <Field label={tr('Pool / HUB')} hint={tr('For an armada file; the DATA COTR workbook takes the pool of each placement')}>
              <Select value={pool} onChange={(e) => { setPool(e.target.value); if (file) void send(false); }}>
                {usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label={tr('Excel File (.xlsx)')} required>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 text-sm text-neutral-600 hover:bg-neutral-50 lg:h-10">
              <Upload size={16} /> <span className="truncate">{name || tr('Choose a file')}</span>
              <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
          </Field>
        </div>
        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {team && <Badge tone="blue" icon={<UsersRound size={11} />}>{tr('DATA COTR workbook')}</Badge>}
              <Badge tone="green">{tr('{0} new', result.new)}</Badge><Badge tone="amber">{tr('{0} changed', result.update)}</Badge>
              <Badge tone="slate">{tr('{0} the same', result.same)}</Badge>
              {result.newArmada > 0 && <Badge tone="violet">{tr('{0} new armada', result.newArmada)}</Badge>}
              {!!result.skipped?.length && <Badge tone="red">{tr('{0} left out', result.skipped.length)}</Badge>}
            </div>
            {team && result.departments && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setDept('')} className={cx('rounded-full border px-2.5 py-1 text-xs', !dept ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 text-neutral-600')}>{tr('All')} · {result.rows.length}</button>
                {Object.entries(result.departments).map(([d, n]) => (
                  <button key={d} type="button" onClick={() => setDept(d)} className={cx('rounded-full border px-2.5 py-1 text-xs', dept === d ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-neutral-200 text-neutral-600')}>{d || '—'} · {n}</button>
                ))}
              </div>
            )}
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-neutral-200">
              {team ? (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className={theadClass}><tr><th className="px-3 py-2">{tr('Employee')}</th><th className="px-3 py-2">{tr('Department')}</th><th className="px-3 py-2">{tr('Pool / HUB')}</th>
                    <th className="px-3 py-2">{tr('Bike')}</th><th className="px-3 py-2">{tr('Armada (QRIS)')}</th><th className="px-3 py-2" /></tr></thead>
                  <tbody className="divide-y divide-neutral-100">
                    {teamRows.map((r) => (
                      <tr key={r.employeeId}>
                        <td className="px-3 py-2"><span className="block font-medium text-neutral-900">{r.name}</span><span className="text-[11px] text-neutral-400">{r.employeeId} · {r.nickname}</span></td>
                        <td className="px-3 py-2 text-xs">{r.department}</td>
                        <td className="px-3 py-2 text-xs">{poolName(r.pool)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.bike || '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.armada ?? '—'}{r.newArmada && <Badge tone="violet">{tr('new')}</Badge>}</td>
                        <td className="px-3 py-2 text-right"><Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label()}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className={theadClass}><tr><th className="px-3 py-2">{tr('Armada')}</th><th className="px-3 py-2">{tr('Name')}</th><th className="px-3 py-2">{tr('Phone')}</th><th className="px-3 py-2" /></tr></thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(result.rows as ArmadaRow[]).map((r) => (
                      <tr key={r.armada}>
                        <td className="px-3 py-2 font-mono text-xs">{r.armada}</td>
                        <td className="px-3 py-2">{r.name}{r.action === 'update' && r.current && <span className="block text-[11px] text-neutral-400">{tr('now')}: {r.current}</span>}</td>
                        <td className="px-3 py-2 text-xs text-neutral-500">{r.phone || '—'}</td>
                        <td className="px-3 py-2 text-right"><Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label()}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!!result.skipped?.length && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <p className="font-semibold">{tr('Left out')}</p>
                <ul className="mt-1 space-y-0.5">{result.skipped.slice(0, 20).map((r) => <li key={r.employeeId}>{r.employeeId} · {r.name}: {r.reason}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
