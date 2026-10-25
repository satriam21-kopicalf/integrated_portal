'use client';

// Job title / department field: pick a name from the list (GET /api/access/masters/{kind}) or type a new one; super
// admins add it to the list straight from the field ("+ Add …"). A name typed by anyone is kept on the account; a
// super admin saving a user also adds it to the list (backend).

import { Check, Loader2, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { inputClass } from '@/components/ui/Dialog';
import { serverMsg, tr } from '@/lib/i18n';

export type MasterKind = 'jobTitle' | 'department';
export interface MasterName { id: string; name: string; isActive: boolean; users: number }

const lists = new Map<MasterKind, Promise<MasterName[]>>();

/** The names of a list (shared by every field of the page; `fresh` reloads). */
export function loadMaster(kind: MasterKind, fresh = false): Promise<MasterName[]> {
  if (fresh || !lists.has(kind)) {
    lists.set(kind, fetch(`/api/access/masters/${kind}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []));
  }
  return lists.get(kind)!;
}

export async function addMaster(kind: MasterKind, name: string): Promise<{ name: string; created: boolean }> {
  const res = await fetch(`/api/access/masters/${kind}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  void loadMaster(kind, true);
  return body;
}

export default function MasterCombobox({ kind, id, value, onChange, canAdd, placeholder }: {
  kind: MasterKind; id: string; value: string; onChange: (v: string) => void; canAdd: boolean; placeholder?: string;
}) {
  const [names, setNames] = useState<MasterName[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => { void loadMaster(kind).then(setNames); }, [kind]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);

  const q = value.trim().toLowerCase();
  const shown = useMemo(() => names.filter(n => n.isActive && (!q || n.name.toLowerCase().includes(q))).slice(0, 50), [names, q]);
  const exact = names.some(n => n.name.toLowerCase() === q);
  const offerAdd = canAdd && !!q && !exact;
  const options = shown.length + (offerAdd ? 1 : 0);

  const pick = (name: string) => { onChange(name); setOpen(false); setError(''); };
  const add = async () => {
    setAdding(true);
    setError('');
    try {
      const out = await addMaster(kind, value.trim());
      setNames(await loadMaster(kind));
      pick(out.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <input id={id} className={inputClass} value={value} maxLength={80} autoComplete="off" placeholder={placeholder}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={e => {
          if (!open || !options) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % options); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + options) % options); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (active < shown.length) pick(shown[active].name); else void add();
          } else if (e.key === 'Escape') setOpen(false);
        }} />
      {open && options > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white py-1 shadow-xl">
          {shown.map((n, i) => (
            <li key={n.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(n.name)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? 'bg-slate-100' : ''}`}>
                <span className="min-w-0 flex-1 truncate text-slate-800">{n.name}</span>
                {n.name.toLowerCase() === q && <Check size={14} className="text-blue-600" />}
              </button>
            </li>
          ))}
          {offerAdd && (
            <li role="option" aria-selected={active === shown.length}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => void add()} disabled={adding}
                onMouseEnter={() => setActive(shown.length)}
                className={`flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 ${active === shown.length ? 'bg-blue-50' : ''}`}>
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {tr('Add "{0}" to the list', value.trim())}
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
