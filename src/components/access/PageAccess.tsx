'use client';

// Page access in User Accounts: the pages a role opens (Roles & pages, editable by super admins) and the exceptions of
// one user on top of the role (user form). Backend: /api/access (integrated_portal_be app/access.py).

import { Briefcase, Building2, Check, LayoutGrid, Loader2, Pencil, Plus, RotateCcw, Save, Smartphone, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { addMaster, loadMaster, MasterKind, MasterName } from '@/components/MasterCombobox';
import { OPERATIONS_PAGES, OPERATIONS_URL, operationsOnly, Role, ROLE_LABELS } from '@/lib/auth';
import { serverMsg, tr } from '@/lib/i18n';
import { PageInfo, PageKey, PAGES, STATE_LABEL } from '@/lib/pages';
import { SkeletonList } from '@/components/kc/Skeleton';

type EditableRole = 'cost_control' | 'user' | 'outlet';
type RolePages = Record<EditableRole, PageKey[]>;
const EDITABLE: EditableRole[] = ['cost_control', 'user', 'outlet'];

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  return body as T;
}

let rolesPromise: Promise<RolePages> | null = null;
export function loadRolePages(fresh = false): Promise<RolePages> {
  if (fresh || !rolesPromise) {
    rolesPromise = call<{ roles: RolePages }>('/api/access/pages').then(r => ({ ...r.roles, outlet: r.roles.outlet ?? [] })).catch(() => ({ cost_control: [], user: [], outlet: [] }));
  }
  return rolesPromise;
}

/** Pages grouped as in the menu. */
function groups(): { group: string; pages: typeof PAGES }[] {
  const out: { group: string; pages: typeof PAGES }[] = [];
  for (const p of PAGES) {
    const last = out[out.length - 1];
    if (last && last.group === p.group) last.pages.push(p);
    else out.push({ group: p.group, pages: [p] });
  }
  return out;
}

/** Exceptions of one user: tick or untick pages on top of the role's pages. */
export function PageAccessEditor({ role, overrides, onChange, hidden, onHiddenChange }: {
  role: Role; overrides: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void;
  /** superadmins: pages left out of their menu (display only) */
  hidden?: string[]; onHiddenChange?: (v: string[]) => void;
}) {
  const [roles, setRoles] = useState<RolePages | null>(null);
  useEffect(() => { void loadRolePages().then(setRoles); }, []);
  if (role === 'superadmin') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">{tr('Super admins open every page, including User Accounts and Activity Logs.')}</p>
        {onHiddenChange && <MenuDisplay hidden={hidden ?? []} onChange={onHiddenChange} />}
      </div>
    );
  }
  if (!roles) return <SkeletonList rows={4} />;
  const base = new Set<string>(roles[role as EditableRole] ?? []);
  const effective = (k: PageKey) => (k in overrides ? overrides[k] : base.has(k));
  const toggle = (k: PageKey) => {
    const want = !effective(k);
    const next = { ...overrides };
    if (want === base.has(k)) delete next[k]; else next[k] = want;
    onChange(next);
  };
  const changed = Object.keys(overrides).length;
  const pages = PAGES.map(p => p.key).filter(effective);
  const onlyOps = operationsOnly(role, pages);
  return (
    <div className="space-y-3">
      <OperationsNote only={onlyOps} some={pages.some(k => OPERATIONS_PAGES.includes(k))} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{tr('Ticked = the user opens the page. Grey label = from the role {0}.', ROLE_LABELS[role])}</span>
        {changed > 0 && (
          <button type="button" onClick={() => onChange({})} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <RotateCcw size={12} /> {tr('Back to the role ({0} exceptions)', changed)}
          </button>
        )}
      </div>
      {groups().map(g => (
        <div key={g.group}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{g.group}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.pages.map(p => {
              const on = effective(p.key);
              const exception = p.key in overrides;
              return (
                <li key={p.key}>
                  <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                    exception ? (on ? 'border-emerald-300 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60') : 'border-neutral-200 hover:bg-neutral-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.key)} className="h-4 w-4 rounded border-neutral-300 text-brand-700" />
                    <span className="min-w-0 flex-1 truncate text-neutral-800">{p.label} <StateTag page={p} /></span>
                    <OpsTag page={p.key} />
                    <span className={`text-[10px] font-semibold uppercase ${exception ? (on ? 'text-emerald-700' : 'text-rose-700') : 'text-neutral-400'}`}>
                      {exception ? (on ? tr('Extra') : tr('Removed')) : base.has(p.key) ? tr('Role') : ''}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Roles & pages: which pages each role opens (super admins: always every page). */
export function RolePagesDrawer({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState<RolePages | null>(null);
  const [draft, setDraft] = useState<RolePages | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { void loadRolePages(true).then(r => { setSaved(r); setDraft(r); }); }, []);
  const dirty = useMemo(() => !!saved && !!draft && EDITABLE.some(r => [...saved[r]].sort().join() !== [...draft[r]].sort().join()), [saved, draft]);
  const toggle = (role: EditableRole, page: PageKey) => setDraft(d => d && ({
    ...d, [role]: d[role].includes(page) ? d[role].filter(x => x !== page) : [...d[role], page],
  }));
  const save = async () => {
    if (!draft || !saved) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const role of EDITABLE) {
        if ([...saved[role]].sort().join() !== [...draft[role]].sort().join()) {
          await call(`/api/access/roles/${role}`, { method: 'PUT', body: JSON.stringify({ pages: draft[role] }) });
        }
      }
      const fresh = await loadRolePages(true);
      setSaved(fresh);
      setDraft(fresh);
      setMessage({ ok: true, text: tr('Saved. Signed-in users get the new pages within a minute.') });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<LayoutGrid size={18} />} title={tr('Roles & pages')}
      description={tr('The pages every role opens. A single user can get pages added or removed in their account.')}
      footer={<>
        <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Close')}</button>
        <button type="button" className={buttonPrimary} disabled={!dirty || busy} onClick={save}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {tr('Save')}
        </button>
      </>}>
      {!draft ? <SkeletonList rows={5} /> : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5">{tr('Page')}</th>
                  <th className="w-28 px-3 py-2.5 text-center">{ROLE_LABELS.superadmin}</th>
                  {EDITABLE.map(r => <th key={r} className="w-28 px-3 py-2.5 text-center">{ROLE_LABELS[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups().map(g => (
                  <GroupRows key={g.group} group={g.group}>
                    {g.pages.map(p => (
                      <tr key={p.key} className="border-t border-neutral-100">
                        <td className="px-3 py-2 text-neutral-800">{p.label} <StateTag page={p} /> <OpsTag page={p.key} /></td>
                        <td className="px-3 py-2 text-center"><Check size={15} className="inline text-neutral-400" aria-label={tr('Always')} /></td>
                        {EDITABLE.map(r => (
                          <td key={r} className="px-3 py-2 text-center">
                            <input type="checkbox" aria-label={`${ROLE_LABELS[r]} · ${p.label}`} checked={draft[r].includes(p.key)}
                              onChange={() => toggle(r, p.key)} className="h-4 w-4 rounded border-neutral-300 text-brand-700" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </GroupRows>
                ))}
                <tr className="border-t border-neutral-200 bg-neutral-50/60 text-neutral-500">
                  <td className="px-3 py-2">{tr('User Accounts, Activity Logs')}</td>
                  <td className="px-3 py-2 text-center"><Check size={15} className="inline text-neutral-400" /></td>
                  <td colSpan={EDITABLE.length} className="px-3 py-2 text-center text-xs">{tr('Super admins only')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <OperationsNote only={false} some />
          <p className="text-xs text-neutral-500">{tr('Roles User (PIC) and Outlet / Hub see only their assigned branches; Cost Control pages show every branch. A new form is added to role User (PIC).')}</p>
          <p className="text-xs text-neutral-500">{tr('Not in the menu: the page opens only by its address. Being built: the menu entry shows a skeleton screen until the feature is ready.')}</p>
          {message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        </div>
      )}
    </Drawer>
  );
}

/** Beside a page Operations also has: the account can open it at operations.kopicalf.co.id (2026-10-28). */
/** The menu of a super admin: untick pages to keep the menu short; they keep opening by their address. */
export function MenuDisplay({ hidden, onChange }: { hidden: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: string) => onChange(hidden.includes(k) ? hidden.filter(x => x !== k) : [...hidden, k]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{tr('Menu display: ticked pages are shown in the menu. Unticked pages keep working (by their address, links and approvals) — only the menu gets shorter.')}</span>
        {hidden.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <RotateCcw size={12} /> {tr('Show every page ({0} hidden)', hidden.length)}
          </button>
        )}
      </div>
      {groups().map(g => (
        <div key={g.group}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{g.group}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.pages.filter(p => p.state !== 'hidden').map(p => (
              <li key={p.key}>
                <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm ${hidden.includes(p.key) ? 'border-neutral-200 bg-neutral-50 text-neutral-400' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                  <input type="checkbox" checked={!hidden.includes(p.key)} onChange={() => toggle(p.key)} className="h-4 w-4 rounded border-neutral-300 text-brand-700" />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type PlatformKey = 'portal' | 'operations' | 'cotr';
type PlatformPage = { key: string; label: string; group: string; available: PlatformKey[] };
const PLATFORM_LABEL: Record<PlatformKey, string> = { portal: 'Portal', operations: 'Operations', cotr: 'Calf On The Road' };
const ALL_PLATFORMS: PlatformKey[] = ['portal', 'operations', 'cotr'];

/** Menus per platform: on which app (portal, Operations, the driver app) every page is shown in the menu. Display only:
 * the access stays as the roles give it. No setting = the default of each app (every platform that has the page). */
export function PlatformsDrawer({ onClose }: { onClose: () => void }) {
  const [pages, setPages] = useState<PlatformPage[] | null>(null);
  const [saved, setSaved] = useState<Record<string, PlatformKey[]>>({});
  const [draft, setDraft] = useState<Record<string, PlatformKey[] | null>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void call<{ pages: PlatformPage[]; platforms: Record<string, PlatformKey[]> }>('/api/access/platforms')
      .then(r => { setPages(r.pages); setSaved(r.platforms); }).catch(e => setMessage({ ok: false, text: (e as Error).message }));
  }, []);
  const current = (p: PlatformPage): PlatformKey[] => (p.key in draft ? draft[p.key] ?? p.available : saved[p.key] ?? p.available);
  const custom = (p: PlatformPage) => (p.key in draft ? draft[p.key] !== null : p.key in saved);
  const toggle = (p: PlatformPage, k: PlatformKey) => {
    const now = current(p);
    const next = now.includes(k) ? now.filter(x => x !== k) : [...now, k];
    const isDefault = next.length === p.available.length && p.available.every(a => next.includes(a));
    setDraft(d => ({ ...d, [p.key]: isDefault ? null : next }));
  };
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await call<{ platforms: Record<string, PlatformKey[]> }>('/api/access/platforms', { method: 'PUT', body: JSON.stringify({ platforms: draft }) });
      setSaved(r.platforms);
      setDraft({});
      setMessage({ ok: true, text: tr('Saved. The menus follow within a minute (after the next sign-in check).') });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const byGroup = useMemo(() => {
    const out: { group: string; pages: PlatformPage[] }[] = [];
    for (const p of pages ?? []) {
      const last = out[out.length - 1];
      if (last && last.group === p.group) last.pages.push(p);
      else out.push({ group: p.group, pages: [p] });
    }
    return out;
  }, [pages]);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Smartphone size={18} />} title={tr('Menus per platform')}
      description={tr('Where every page is shown in the menu: the portal, Operations or the Calf On The Road app. Only the menu changes; the access and the flows stay as they are.')}
      footer={<>
        <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Close')}</button>
        <button type="button" className={buttonPrimary} disabled={!Object.keys(draft).length || busy} onClick={save}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {tr('Save')}
        </button>
      </>}>
      {message && <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
      {!pages ? <SkeletonList rows={5} /> : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <tr><th className="px-3 py-2.5">{tr('Page')}</th>{ALL_PLATFORMS.map(k => <th key={k} className="w-28 px-3 py-2.5 text-center">{PLATFORM_LABEL[k]}</th>)}<th className="w-10" /></tr>
            </thead>
            <tbody>
              {byGroup.map(g => (
                <Fragment key={g.group}>
                  <tr className="border-t border-neutral-200 bg-neutral-50/60"><td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{g.group}</td></tr>
                  {g.pages.map(p => (
                    <tr key={p.key} className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-neutral-800">{p.label}{custom(p) && <span className="ml-1 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold uppercase text-amber-700">{tr('Set')}</span>}</td>
                      {ALL_PLATFORMS.map(k => (
                        <td key={k} className="px-3 py-2 text-center">
                          {p.available.includes(k)
                            ? <input type="checkbox" aria-label={`${PLATFORM_LABEL[k]} · ${p.label}`} checked={current(p).includes(k)} onChange={() => toggle(p, k)} className="h-4 w-4 rounded border-neutral-300 text-brand-700" />
                            : <span className="text-neutral-300">—</span>}
                        </td>
                      ))}
                      <td className="px-1 text-center">
                        {custom(p) && (
                          <button type="button" title={tr('Back to the default')} aria-label={tr('Back to the default')} onClick={() => setDraft(d => ({ ...d, [p.key]: null }))} className="rounded p-1 text-neutral-400 hover:text-brand-700"><RotateCcw size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Drawer>
  );
}

function OpsTag({ page }: { page: PageKey }) {
  if (!OPERATIONS_PAGES.includes(page)) return null;
  return (
    <span title={tr('Also opens in Operations: {0}', OPERATIONS_URL.replace('https://', ''))}
      className="inline-flex flex-shrink-0 items-center gap-0.5 whitespace-nowrap rounded bg-brand-50 px-1.5 py-px align-middle text-[10px] font-semibold text-brand-700">
      <Smartphone size={10} aria-hidden /> Operations
    </span>
  );
}

/** Where the account signs in: an account with forms and only pages Operations has uses Operations, not the portal. */
function OperationsNote({ only, some }: { only: boolean; some: boolean }) {
  if (!only && !some) return null;
  const host = OPERATIONS_URL.replace('https://', '');
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${only ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200' : 'bg-neutral-50 text-neutral-600'}`}>
      <Smartphone size={14} className="mt-px flex-shrink-0" />
      <span>{only
        ? tr('This account opens forms and pages Operations has only: it signs in at {0} and the portal refuses it. Add a page without the Operations tag to keep the portal.', host)
        : tr('Pages tagged Operations can also be opened at {0}. An account with forms and only such pages signs in there, not in the portal.', host)}</span>
    </p>
  );
}

/** "Not in the menu", "Being built" … beside a page whose menu entry is special. */
function StateTag({ page }: { page: PageInfo }) {
  if (!page.state) return null;
  const tone = page.state === 'hidden' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500';
  return <span className={`ml-1 inline-block whitespace-nowrap rounded px-1.5 py-px align-middle text-[10px] font-semibold uppercase ${tone}`}>{STATE_LABEL[page.state]()}</span>;
}

function GroupRows({ group, children }: { group: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-t border-neutral-200 bg-neutral-50/60">
        <td colSpan={EDITABLE.length + 2} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{group}</td>
      </tr>
      {children}
    </>
  );
}

/** Job titles & departments: add, rename (accounts follow) and switch off names. */
export function MastersDrawer({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<MasterKind>('jobTitle');
  return (
    <Drawer open onClose={onClose} size="md" icon={kind === 'jobTitle' ? <Briefcase size={18} /> : <Building2 size={18} />}
      title={tr('Job titles & departments')} description={tr('The names offered in the user forms. New names can also be added straight from a form.')}
      footer={<button type="button" className={buttonSecondary} onClick={onClose}>{tr('Close')}</button>}>
      <div className="mb-4 flex gap-1 border-b border-neutral-200" role="tablist">
        {(['jobTitle', 'department'] as MasterKind[]).map(k => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${kind === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
            {k === 'jobTitle' ? tr('Job titles') : tr('Departments')}
          </button>
        ))}
      </div>
      <MasterList key={kind} kind={kind} />
    </Drawer>
  );
}

function MasterList({ kind }: { kind: MasterKind }) {
  const [rows, setRows] = useState<MasterName[] | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => setRows(await loadMaster(kind, true)), [kind]);
  useEffect(() => { void reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const patch = (id: string, body: object) => call(`/api/access/masters/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

  return (
    <DrawerSection>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (name.trim()) void run(async () => { await addMaster(kind, name.trim()); setName(''); }); }}>
        <input className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={80}
          placeholder={kind === 'jobTitle' ? tr('New job title') : tr('New department')} aria-label={tr('New name')} />
        <button type="submit" className={buttonPrimary} disabled={!name.trim()}><Plus size={16} /> {tr('Add')}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!rows ? <SkeletonList rows={4} /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">{tr('No names yet')}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {rows.map(r => (
            <li key={r.id} className={`flex items-center gap-2 px-3 py-2 ${r.isActive ? '' : 'bg-neutral-50 opacity-70'}`}>
              {editing?.id === r.id ? (
                <form className="flex flex-1 gap-2" onSubmit={e => { e.preventDefault(); void run(async () => { await patch(r.id, { name: editing.name }); setEditing(null); }); }}>
                  <input className={`${inputClass} h-9`} value={editing.name} autoFocus maxLength={80} onChange={e => setEditing({ id: r.id, name: e.target.value })} aria-label={tr('Name')} />
                  <button type="submit" className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50" aria-label={tr('Save')}><Check size={16} /></button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label={tr('Cancel')}><X size={16} /></button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-900">{r.name}</span>
                    <span className="block text-[11px] text-neutral-400">{tr('{0} users', r.users)}{r.isActive ? '' : ` · ${tr('Inactive')}`}</span>
                  </span>
                  <button type="button" onClick={() => setEditing({ id: r.id, name: r.name })} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr('Rename {0}', r.name)}><Pencil size={15} /></button>
                  <button type="button" onClick={() => void run(() => patch(r.id, { isActive: !r.isActive }))}
                    className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100">{r.isActive ? tr('Hide') : tr('Show')}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-neutral-500">{tr('Renaming changes the name on every account that uses it. Hidden names are no longer offered; accounts keep them.')}</p>
    </DrawerSection>
  );
}
