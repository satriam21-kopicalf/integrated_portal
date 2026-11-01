'use client';

// Shared pieces of the Monitoring COTR prototype: the prototype note, a list kept in the browser (sample data until the
// backend exists, so the team can try adding and editing) and one drawer form driven by field specs.

import { FlaskConical, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Panel, Select, cx, inputClass, theadClass, useToast } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { tr } from '@/lib/i18n';

export function PrototypeNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <FlaskConical size={18} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{tr('Prototype · sample data')}</p>
        <p className="text-xs text-amber-800">
          {children ?? tr('Changes are kept in this browser only, to agree on the fields and the flow before the backend is built.')}
        </p>
      </div>
    </div>
  );
}

const KEY = (name: string) => `portal.cotr.${name}`;

/** A list of rows seeded from the sample data and kept in localStorage (reset brings the sample back). */
export function useLocalList<T extends { id: string }>(name: string, seed: T[]) {
  const [rows, setRows] = useState<T[]>(seed);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY(name));
      if (v) setRows(JSON.parse(v) as T[]);
    } catch { /* sample data */ }
  }, [name]);
  const save = useCallback((next: T[]) => {
    setRows(next);
    try { window.localStorage.setItem(KEY(name), JSON.stringify(next)); } catch { /* not kept */ }
  }, [name]);
  const upsert = (row: T) => save(rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row]);
  const remove = (id: string) => save(rows.filter((r) => r.id !== id));
  const reset = () => save(seed);
  return { rows, upsert, remove, reset };
}

export type FieldSpec = {
  key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'textarea'; required?: boolean; hint?: string;
  options?: { value: string; label: string }[]; placeholder?: string;
};

export type Column<T> = { label: string; render: (row: T) => ReactNode; className?: string };

/** A master list: table + add / edit drawer on the local list. */
export function MasterTable<T extends { id: string }>({ title, description, rows, columns, fields, blank, onSave, onDelete, onReset, noun }: {
  title: string; description?: string; rows: T[]; columns: Column<T>[]; fields: FieldSpec[]; blank: () => T;
  onSave: (row: T) => void; onDelete: (id: string) => void; onReset: () => void; noun: string;
}) {
  const [open, setOpen] = useState<T | null>(null);
  const isNew = open ? !rows.some((r) => r.id === open.id) : false;
  return (
    <Panel title={title} description={description}
      actions={<>
        <Button size="sm" variant="ghost" onClick={onReset}><RotateCcw size={14} /> {tr('Reset sample')}</Button>
        <Button size="sm" onClick={() => setOpen(blank())}><Plus size={14} /> {tr('Add {0}', noun)}</Button>
      </>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr>{columns.map((c) => <th key={c.label} className={cx('px-4 py-2.5', c.className)}>{c.label}</th>)}<th className="w-12 px-2" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                {columns.map((c) => <td key={c.label} className={cx('px-4 py-2.5 align-top', c.className)}>{c.render(r)}</td>)}
                <td className="px-2 py-2.5 text-right">
                  <button type="button" onClick={() => setOpen(r)} aria-label={tr('Edit')}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">{tr('Nothing yet')}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <EditDrawer title={isNew ? tr('New {0}', noun) : tr('Edit {0}', noun)} row={open} fields={fields}
          onClose={() => setOpen(null)} onSave={(row) => { onSave(row); setOpen(null); }}
          onDelete={isNew ? undefined : () => { onDelete(open.id); setOpen(null); }} />
      )}
    </Panel>
  );
}

function EditDrawer<T extends { id: string }>({ title, row, fields, onClose, onSave, onDelete }: {
  title: string; row: T; fields: FieldSpec[]; onClose: () => void; onSave: (row: T) => void; onDelete?: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, unknown>>(row as unknown as Record<string, unknown>);
  const missing = fields.some((f) => f.required && (v[f.key] === '' || v[f.key] === null || v[f.key] === undefined));
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  return (
    <Drawer open onClose={onClose} title={title} size="md"
      footer={<>
        {onDelete && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { onDelete(); toast(tr('Deleted')); }}><Trash2 size={15} /> {tr('Delete')}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
        <Button disabled={missing} onClick={() => { onSave(v as unknown as T); toast(tr('Saved in this browser')); }}><Save size={16} /> {tr('Save')}</Button>
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
              ) : f.type === 'textarea' ? (
                <textarea value={str} rows={3} onChange={(e) => set(f.key, e.target.value)} className={cx(inputClass, 'h-auto py-2')} placeholder={f.placeholder} />
              ) : (
                <Input type={f.type ?? 'text'} value={str} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
    </Drawer>
  );
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function YesNo({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <Badge tone={on ? 'green' : 'slate'} dot>{on ? yes : no}</Badge>;
}
