'use client';

// Shared pieces of Monitoring COTR (integrated_portal_be app/routes/cotr.py): a master list read and written through
// /api/cotr/masters/{entity} and one table + drawer form driven by field specs.

import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Badge, Button, ErrorState, Field, Input, Panel, Select, SkeletonRows, cx, inputClass, theadClass, useToast } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { ConfirmDialog } from '@/so/ui/Dialog';
import { call } from '@/so/features/checkin/checkin';
import { tr } from '@/lib/i18n';

export type Entity = 'pools' | 'fleet' | 'menus' | 'boms' | 'drivers';
type Row = Record<string, unknown> & { code: string };

/** One master: rows, reload, save (create when `key` is null) and delete; the messages of a refusal are thrown. */
export function useMaster<T extends Row>(entity: Entity) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setRows(await call<T[]>(`/api/cotr/masters/${entity}`)); } catch (e) { setError((e as Error).message); }
  }, [entity]);
  useEffect(() => { void load(); }, [load]);
  const save = async (row: Partial<T>, key: string | null) => {
    await call(`/api/cotr/masters/${entity}${key ? `/${encodeURIComponent(key)}` : ''}`, { method: key ? 'PUT' : 'POST', json: row });
    await load();
  };
  const remove = async (key: string) => {
    await call(`/api/cotr/masters/${entity}/${encodeURIComponent(key)}`, { method: 'DELETE' });
    await load();
  };
  return { rows, error, load, save, remove };
}

export type FieldSpec = {
  key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'bool'; required?: boolean; hint?: string;
  options?: { value: string; label: string }[]; placeholder?: string;
};

export type Column<T> = { label: string; render: (row: T) => ReactNode; className?: string };

/** A master list: table + add / edit drawer on the backend. */
export function MasterTable<T extends Row>({ title, description, master, columns, fields, blank, noun, toForm, fromForm }: {
  title: string; description?: string; master: ReturnType<typeof useMaster<T>>; columns: Column<T>[]; fields: FieldSpec[];
  blank: () => Partial<T>; noun: string;
  /** the row as the form edits it (e.g. a list to a comma text) and back */
  toForm?: (row: Partial<T>) => Record<string, unknown>; fromForm?: (v: Record<string, unknown>) => Partial<T>;
}) {
  const [open, setOpen] = useState<{ row: Partial<T>; key: string | null } | null>(null);
  const rows = master.rows;
  return (
    <Panel title={rows ? `${title} (${rows.length})` : title} description={description}
      actions={<Button size="sm" onClick={() => setOpen({ row: blank(), key: null })}><Plus size={14} /> {tr('Add {0}', noun)}</Button>}>
      {master.error ? <ErrorState message={master.error} onRetry={() => void master.load()} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>{columns.map((c) => <th key={c.label} className={cx('px-4 py-2.5', c.className)}>{c.label}</th>)}<th className="w-12 px-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows ? <SkeletonRows cols={columns.length + 1} rows={4} /> : rows.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50/70">
                  {columns.map((c) => <td key={c.label} className={cx('px-4 py-2.5 align-top', c.className)}>{c.render(r)}</td>)}
                  <td className="px-2 py-2.5 text-right">
                    <button type="button" onClick={() => setOpen({ row: r, key: r.code })} aria-label={tr('Edit')}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">{tr('Nothing yet')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <EditDrawer title={open.key ? tr('Edit {0}', noun) : tr('New {0}', noun)} initial={toForm ? toForm(open.row) : open.row} fields={fields}
          onClose={() => setOpen(null)}
          onSave={async (v) => { await master.save(fromForm ? fromForm(v) : (v as Partial<T>), open.key); setOpen(null); }}
          onDelete={open.key ? async () => { await master.remove(open.key!); setOpen(null); } : undefined} />
      )}
    </Panel>
  );
}

function EditDrawer({ title, initial, fields, onClose, onSave, onDelete }: {
  title: string; initial: Record<string, unknown>; fields: FieldSpec[]; onClose: () => void;
  onSave: (v: Record<string, unknown>) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const missing = fields.some((f) => f.required && f.type !== 'bool' && (v[f.key] === '' || v[f.key] === null || v[f.key] === undefined));
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setError('');
    try { await fn(); toast(done); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} title={title} size="md"
      footer={<>
        {onDelete && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setDeleting(true)}><Trash2 size={15} /> {tr('Delete')}</Button>}
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
        <Button loading={busy} disabled={missing} onClick={() => void run(() => onSave(v), tr('Saved'))}><Save size={16} /> {tr('Save')}</Button>
      </>}>
      <div className="space-y-3">
        {fields.map((f) => {
          const val = v[f.key];
          const str = val === null || val === undefined ? '' : String(val);
          return (
            <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
              {f.type === 'select' ? (
                <Select value={str} onChange={(e) => set(f.key, e.target.value || null)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === 'bool' ? (
                <Select value={val === false ? '0' : '1'} onChange={(e) => set(f.key, e.target.value === '1')}>
                  <option value="1">{tr('Yes')}</option><option value="0">{tr('No')}</option>
                </Select>
              ) : f.type === 'textarea' ? (
                <textarea value={str} rows={3} onChange={(e) => set(f.key, e.target.value)} className={cx(inputClass, 'h-auto py-2')} placeholder={f.placeholder} />
              ) : (
                <Input type={f.type ?? 'text'} value={str} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      <ConfirmDialog open={deleting} danger onClose={() => setDeleting(false)} title={tr('Delete this row?')} confirmLabel={tr('Delete')}
        description={tr('Rows still used by other data cannot be deleted.')} onConfirm={() => { setDeleting(false); if (onDelete) void run(onDelete, tr('Deleted')); }} />
    </Drawer>
  );
}

export function YesNo({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <Badge tone={on ? 'green' : 'slate'} dot>{on ? yes : no}</Badge>;
}

export const rupiah = (n: number) => `Rp ${Math.round(Number(n)).toLocaleString('id-ID')}`;
