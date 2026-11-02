'use client';

// Shared pieces of Monitoring COTR (integrated_portal_be app/routes/cotr.py): a master list read and written through
// /api/cotr/masters/{entity}, one table + drawer form driven by field specs (sections, searchable selects, pictures,
// coordinates on a map), and the picture of a master row (/api/cotr/masters/{entity}/{code}/image/{slot}).

import { Camera, ChevronDown, ImageOff, MapPin, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ErrorState, Field, Input, Panel, Select, SkeletonRows, cx, inputClass, theadClass, useToast } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { ConfirmDialog } from '@/so/ui/Dialog';
import { call } from '@/so/features/checkin/checkin';
import { tr } from '@/lib/i18n';

export type Entity = 'pools' | 'fleet' | 'fleet-types' | 'shift-templates' | 'incentive-schemes' | 'menus' | 'boms' | 'items' | 'drivers';
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
  const save = async (row: Partial<T>, key: string | null): Promise<T> => {
    const saved = await call<T>(`/api/cotr/masters/${entity}${key ? `/${encodeURIComponent(key)}` : ''}`, { method: key ? 'PUT' : 'POST', json: row });
    await load();
    return saved;
  };
  const remove = async (key: string) => {
    await call(`/api/cotr/masters/${entity}/${encodeURIComponent(key)}`, { method: 'DELETE' });
    await load();
  };
  return { rows, error, load, save, remove };
}

/** The URL of the picture of a master row (photo of a driver / armada, QRIS of an armada); `v` busts the cache. */
export const imageUrl = (entity: 'drivers' | 'fleet', code: string, slot: 'photo' | 'qris', v?: unknown) =>
  `/api/cotr/masters/${entity}/${encodeURIComponent(code)}/image/${slot}${v ? `?v=${encodeURIComponent(String(v))}` : ''}`;

export type Option = { value: string; label: string; hint?: string };
export type FieldSpec = {
  key: string; label: string; required?: boolean; hint?: string; placeholder?: string; section?: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'search' | 'textarea' | 'bool' | 'image' | 'coords';
  options?: Option[];
  /** image: the master and slot of the picture */ image?: { entity: 'drivers' | 'fleet'; slot: 'photo' | 'qris' };
  /** coords: the keys of the latitude / longitude */ coords?: [string, string];
  /** shown only when true (e.g. salary for the COTR management) */ when?: boolean;
};

export type Column<T> = { label: string; render: (row: T) => ReactNode; className?: string };

/** A master list: table + add / edit drawer on the backend; pictures are uploaded after the row is saved. */
export function MasterTable<T extends Row>({ title, description, master, columns, fields, blank, noun, toForm, fromForm, actions, rowActions }: {
  title: string; description?: string; master: ReturnType<typeof useMaster<T>>; columns: Column<T>[]; fields: FieldSpec[];
  blank: () => Partial<T>; noun: string;
  /** the row as the form edits it (e.g. a list to a comma text) and back */
  toForm?: (row: Partial<T>) => Record<string, unknown>; fromForm?: (v: Record<string, unknown>) => Partial<T>;
  actions?: ReactNode; rowActions?: (row: T) => ReactNode;
}) {
  const [open, setOpen] = useState<{ row: Partial<T>; key: string | null } | null>(null);
  const [q, setQ] = useState('');
  const rows = master.rows;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !rows || !s ? rows : rows.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(s)));
  }, [rows, q]);
  const shownFields = fields.filter((f) => f.when !== false);
  const images = shownFields.filter((f) => f.type === 'image' && f.image);
  return (
    <Panel title={rows ? `${title} (${rows.length})` : title} description={description}
      actions={<>{actions}<Button size="sm" onClick={() => setOpen({ row: blank(), key: null })}><Plus size={14} /> {tr('Add {0}', noun)}</Button></>}
      toolbar={rows && rows.length > 8 ? (
        <div className="relative max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search')} className={cx(inputClass, 'pl-9')} />
        </div>
      ) : undefined}>
      {master.error ? <ErrorState message={master.error} onRetry={() => void master.load()} /> : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}>
              <tr>{columns.map((c) => <th key={c.label} className={cx('px-4 py-2.5', c.className)}>{c.label}</th>)}<th className="w-20 px-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!shown ? <SkeletonRows cols={columns.length + 1} rows={4} /> : shown.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50/70">
                  {columns.map((c) => <td key={c.label} className={cx('px-4 py-2.5 align-top', c.className)}>{c.render(r)}</td>)}
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    {rowActions?.(r)}
                    <button type="button" onClick={() => setOpen({ row: r, key: r.code })} aria-label={tr('Edit')}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                  </td>
                </tr>
              ))}
              {shown && shown.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">{tr('Nothing yet')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <EditDrawer title={open.key ? tr('Edit {0}', noun) : tr('New {0}', noun)} initial={toForm ? toForm(open.row) : open.row} fields={shownFields}
          code={open.key} onClose={() => setOpen(null)}
          onSave={async (v, pictures) => {
            const plain = Object.fromEntries(Object.entries(v).filter(([k]) => !images.some((f) => f.key === k)));
            const saved = await master.save(fromForm ? fromForm(plain) : (plain as Partial<T>), open.key);
            const code = String(saved.code ?? v.code ?? open.key);
            for (const f of images) {
              if (f.key in pictures) {
                await call(`/api/cotr/masters/${f.image!.entity}/${encodeURIComponent(code)}/image/${f.image!.slot}`, { method: 'PUT', json: { image: pictures[f.key] } });
              }
            }
            if (Object.keys(pictures).length) await master.load();
            setOpen(null);
          }}
          onDelete={open.key ? async () => { await master.remove(open.key!); setOpen(null); } : undefined} />
      )}
    </Panel>
  );
}

function EditDrawer({ title, initial, fields, code, onClose, onSave, onDelete }: {
  title: string; initial: Record<string, unknown>; fields: FieldSpec[]; code: string | null; onClose: () => void;
  onSave: (v: Record<string, unknown>, pictures: Record<string, string | null>) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const toast = useToast();
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [pictures, setPictures] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const missing = fields.some((f) => f.required && !['bool', 'image', 'coords'].includes(f.type ?? '') && (v[f.key] === '' || v[f.key] === null || v[f.key] === undefined));
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setError('');
    try { await fn(); toast(done); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const sections = [...new Set(fields.map((f) => f.section ?? ''))];
  return (
    <Drawer open onClose={onClose} title={title} size="lg"
      footer={<>
        {onDelete && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setDeleting(true)}><Trash2 size={15} /> {tr('Delete')}</Button>}
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
        <Button loading={busy} disabled={missing} onClick={() => void run(() => onSave(v, pictures), tr('Saved'))}><Save size={16} /> {tr('Save')}</Button>
      </>}>
      <div className="space-y-5">
        {sections.map((sec) => (
          <section key={sec || 'main'} className={cx(sec && 'rounded-2xl border border-slate-200/80 p-4')}>
            {sec && <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{sec}</h3>}
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.filter((f) => (f.section ?? '') === sec).map((f) => (
                <div key={f.key} className={cx(['textarea', 'image', 'coords'].includes(f.type ?? '') && 'sm:col-span-2')}>
                  <FieldInput f={f} v={v} set={set} code={code} picture={pictures[f.key]} onPicture={(p) => setPictures((x) => ({ ...x, [f.key]: p }))} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ConfirmDialog open={deleting} danger onClose={() => setDeleting(false)} title={tr('Delete this row?')} confirmLabel={tr('Delete')}
        description={tr('Rows still used by other data cannot be deleted.')} onConfirm={() => { setDeleting(false); if (onDelete) void run(onDelete, tr('Deleted')); }} />
    </Drawer>
  );
}

function FieldInput({ f, v, set, code, picture, onPicture }: {
  f: FieldSpec; v: Record<string, unknown>; set: (k: string, val: unknown) => void; code: string | null;
  picture: string | null | undefined; onPicture: (p: string | null) => void;
}) {
  const val = v[f.key];
  const str = val === null || val === undefined ? '' : String(val);
  if (f.type === 'coords' && f.coords) {
    return <Field label={f.label} hint={f.hint}><CoordsInput lat={v[f.coords[0]] as number | null} lng={v[f.coords[1]] as number | null}
      onChange={(lat, lng) => { set(f.coords![0], lat); set(f.coords![1], lng); }} /></Field>;
  }
  if (f.type === 'image' && f.image) {
    const current = picture !== undefined ? picture : code && v[f.image.slot === 'qris' ? 'has_qris' : 'has_photo'] ? imageUrl(f.image.entity, code, f.image.slot, v.updated_at) : null;
    return <Field label={f.label} hint={f.hint}><ImageInput value={current} onChange={onPicture} square={f.image.slot === 'qris'} /></Field>;
  }
  return (
    <Field label={f.label} required={f.required} hint={f.hint}>
      {f.type === 'select' ? (
        <Select value={str} onChange={(e) => set(f.key, e.target.value || null)}>
          {!f.required && <option value="">—</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : f.type === 'search' ? (
        <SearchSelect value={str} options={f.options ?? []} required={f.required} onChange={(x) => set(f.key, x)} placeholder={f.placeholder} />
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
}

/** A select with a search box and a hint per option (pool, armada, account …). */
export function SearchSelect({ value, options, onChange, required, placeholder }: {
  value: string; options: Option[]; onChange: (v: string | null) => void; required?: boolean; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const s = q.trim().toLowerCase();
  const shown = options.filter((o) => !s || o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s));
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cx(inputClass, 'flex items-center justify-between gap-2 text-left')}>
        <span className={cx('truncate', !current && 'text-slate-400')}>{current ? current.label : placeholder ?? tr('Choose')}</span>
        <span className="flex items-center gap-1">
          {current && !required && <X size={14} className="text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
          <ChevronDown size={15} className="text-slate-400" />
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search')} className={cx(inputClass, 'h-9')} /></div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                  className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50', o.value === value && 'bg-blue-50 text-blue-800')}>
                  <span className="truncate">{o.label}</span>{o.hint && <span className="flex-shrink-0 text-[11px] text-slate-400">{o.hint}</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">{tr('No match')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A picture from the camera / files, shrunk to 1000 px JPEG (PNG kept for a QRIS so the code stays sharp). */
export function ImageInput({ value, onChange, square }: { value: string | null; onChange: (v: string | null) => void; square?: boolean }) {
  const pick = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      onChange(square ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  return (
    <div className="flex items-center gap-3">
      <span className={cx('flex flex-shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50', square ? 'h-28 w-28 rounded-xl' : 'h-20 w-20 rounded-full')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className={cx('h-full w-full', square ? 'object-contain' : 'object-cover')} /> : <ImageOff size={20} className="text-slate-300" />}
      </span>
      <span className="flex flex-col gap-1.5">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Camera size={14} /> {value ? tr('Change') : tr('Upload')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && <button type="button" onClick={() => onChange(null)} className="text-left text-xs text-red-600">{tr('Remove')}</button>}
      </span>
    </div>
  );
}

// the map of the coordinates reads window (Leaflet): loaded in the browser only
const CoordsMap = dynamic(() => import('./CoordsMap'), { ssr: false, loading: () => <div className="skeleton h-56 rounded-xl" /> });

/** Latitude / longitude: typed, pasted from a Google Maps link, or picked on the map. */
function CoordsInput({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number | null, lng: number | null) => void }) {
  const [link, setLink] = useState('');
  const fromLink = (t: string) => {
    setLink(t);
    const m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? t.match(/[?&]q(?:uery)?=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ?? t.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{2,3}\.\d{3,})/);
    if (m) onChange(Number(m[1]), Number(m[2]));
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={link} onChange={(e) => fromLink(e.target.value)} placeholder={tr('Paste a Google Maps link or “-6.18, 106.84”')} className={cx(inputClass, 'pl-9')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.000001" value={lat ?? ''} placeholder={tr('Latitude')} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value), lng)} />
        <Input type="number" step="0.000001" value={lng ?? ''} placeholder={tr('Longitude')} onChange={(e) => onChange(lat, e.target.value === '' ? null : Number(e.target.value))} />
      </div>
      <CoordsMap lat={lat} lng={lng} onPick={onChange} />
      <p className="text-[11px] text-slate-400">{tr('Click the map to set the position')}</p>
    </div>
  );
}

export function YesNo({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <Badge tone={on ? 'green' : 'slate'} dot>{on ? yes : no}</Badge>;
}

export const rupiah = (n: number) => `Rp ${Math.round(Number(n)).toLocaleString('id-ID')}`;
