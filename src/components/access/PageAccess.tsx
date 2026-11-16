'use client';

// Page access in User Accounts: the pages a role opens (Roles & pages, editable by super admins) and the exceptions of
// one user on top of the role (user form). Backend: /api/access (integrated_portal_be app/access.py).

import { Briefcase, Building2, Check, LayoutGrid, Loader2, RotateCcw, Save, ShieldCheck, Smartphone } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import Drawer from '@/components/ui/Drawer';
import { loadMaster, MasterKind, MasterName } from '@/components/MasterCombobox';
import { OPERATIONS_PAGES, OPERATIONS_URL, operationsOnly, Role, ROLE_LABELS } from '@/lib/auth';
import { serverMsg, tr } from '@/lib/i18n';
import { PageInfo, PageKey, PAGES, STATE_LABEL } from '@/lib/pages';
import { SkeletonList } from '@/components/kc/Skeleton';
import { kcTable } from '@/components/kc';

type EditableRole = 'admin' | 'cost_control' | 'user' | 'outlet';
type RolePages = Record<EditableRole, PageKey[]>;
const EDITABLE: EditableRole[] = ['admin', 'cost_control', 'user', 'outlet'];

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  return body as T;
}

let rolesPromise: Promise<RolePages> | null = null;
export function loadRolePages(fresh = false): Promise<RolePages> {
  if (fresh || !rolesPromise) {
    rolesPromise = call<{ roles: RolePages }>('/api/access/pages').then(r => ({ ...r.roles, outlet: r.roles.outlet ?? [], admin: r.roles.admin ?? [] })).catch(() => ({ admin: [], cost_control: [], user: [], outlet: [] }));
  }
  return rolesPromise;
}

// How a page is named where menus are assigned (2026-11-11): every form in one section "Forms · Operations app" named
// "Form …", the monitoring of the forms apart from them, the Aggregator marked as in both apps.
const PICK_LABEL: Partial<Record<PageKey, () => string>> = {
  'stock-opname': () => tr('Form Stock Opname'), waste: () => tr('Form Waste'),
  'form.pic-check-in': () => tr('Form PIC Check In'), 'form.surveyor-check-in': () => tr('Form Cost Control Check In'),
  'form.product': () => tr('Form Product'), 'form.outlet': () => tr('Form Outlet'),
  'form.damaged-equipment': () => tr('Form Maintenance & Procurement'), 'form.pengajuan': () => tr('Form Fund Request'),
  'form.stock-transfer': () => tr('Form Transfer Stock (TITO)'), 'form.wwwr': () => tr('Form WW-WR (SWAT)'),
};
function pickGroup(p: PageInfo): string {
  if (p.key in PICK_LABEL) return tr('Forms · Operations app');
  if (p.key.startsWith('rating.')) return tr('Aggregator · portal & Operations');
  if (p.key.startsWith('mon.') && p.group === tr('Operations')) return tr('Monitoring · Operations');
  return p.group;
}

/** Pages grouped as in the menu, named for assigning them. */
function groups(): { group: string; pages: typeof PAGES }[] {
  const out: { group: string; pages: typeof PAGES }[] = [];
  for (const page of PAGES) {
    const p = { ...page, group: pickGroup(page), label: PICK_LABEL[page.key]?.() ?? page.label } as PageInfo;
    const last = out[out.length - 1];
    if (last && last.group === p.group) last.pages.push(p);
    else out.push({ group: p.group, pages: [p] });
  }
  return out;
}

/** Exceptions of one user: tick or untick pages on top of the role's pages. */
export function PageAccessEditor({ role, overrides, onChange, hidden, onHiddenChange, limit }: {
  role: Role; overrides: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void;
  /** an Admin gives only the pages it opens itself (migration 105): the others cannot be ticked */
  limit?: string[];
  /** superadmins: pages left out of their menu (display only) */
  hidden?: string[]; onHiddenChange?: (v: string[]) => void;
}) {
  const [roles, setRoles] = useState<RolePages | null>(null);
  useEffect(() => { void loadRolePages().then(setRoles); }, []);
  if (role === 'superadmin') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">{tr('A Superadmin opens every page, User Accounts and Activity Logs included.')}</p>
        {/* the WW-WR team (2026-11-04): a super admin shows in the team list only when marked here */}
        <div className="rounded-lg border border-neutral-200 px-3 py-2.5">
          <p className="text-sm font-medium text-neutral-900">{tr('WW-WR Team')}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{tr('Tick to list this Superadmin in the WW-WR team (lead and members of an audit).')}</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {([['form.wwwr', tr('Form WW-WR')], ['mon.wwwr', tr('WW-WR')]] as const).map(([k, label]) => (
              <label key={k} className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 accent-brand-700" checked={!!overrides[k]}
                  onChange={() => { const next = { ...overrides }; if (next[k]) delete next[k]; else next[k] = true; onChange(next); }} />
                {label}
              </label>
            ))}
          </div>
        </div>
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
          <p className="mb-1 text-xs font-semibold capitalize text-neutral-400">{g.group}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.pages.map(p => {
              const on = effective(p.key);
              const exception = p.key in overrides;
              return (
                <li key={p.key} className="min-w-0">
                  {/* 2026-11-16: the page name in full (it wraps, never cut), the app badges and state on a second line */}
                  <label className={`flex h-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    exception ? (on ? 'border-emerald-300 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60') : 'border-neutral-200 hover:bg-neutral-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.key)} disabled={!!limit && !on && !limit.includes(p.key)}
                      title={limit && !on && !limit.includes(p.key) ? tr('Only pages you open yourself can be given') : undefined} className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-neutral-300 text-brand-700 disabled:opacity-40" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words font-medium leading-snug text-neutral-800">{p.label}</span>
                        {(exception || base.has(p.key)) && (
                          <span className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${exception ? (on ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800') : 'bg-neutral-100 text-neutral-500'}`}>
                            {exception ? (on ? tr('Extra') : tr('Removed')) : tr('Role')}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 empty:hidden"><OpsTag page={p.key} /><StateTag page={p} /></span>
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
function RolePagesPanel({ onDirty }: { onDirty: (dirty: boolean) => void }) {
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
      setMessage({ ok: true, text: tr('Saved. Signed-in users get the new pages right away.') });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  return (
    <div className="space-y-3">
      <SaveBar text={tr('The pages every role opens. A single user can get pages added or removed in their account.')}
        dirty={dirty} busy={busy} onSave={save} onReset={() => setDraft(saved)} />
      {!draft ? <SkeletonList rows={5} /> : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[600px] text-sm">
              <thead className={kcTable.thead}>
                <tr>
                  <th className="min-w-[11rem] px-3 py-2.5">{tr('Page')}</th>
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
                  <td colSpan={EDITABLE.length} className="px-3 py-2 text-center text-xs">{tr('Superadmin only')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <OperationsNote only={false} some />
          <p className="text-xs text-neutral-500">{tr('Roles User and Outlet/HUB see only their assigned branches; Inventory Surveyor sees every branch. A new form is added to role User.')}</p>
          <p className="text-xs text-neutral-500">{tr('Not in the menu: the page opens only by its address. Being built: the menu entry shows a skeleton screen until the feature is ready.')}</p>
          {message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        </div>
      )}
    </div>
  );
}

/** Above every tab of Access Settings: what the tab sets, and Save / Undo for its changes. */
function SaveBar({ text, dirty, busy, onSave, onReset }: { text: string; dirty: boolean; busy: boolean; onSave?: () => void; onReset?: () => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-white/95 px-1 py-2 backdrop-blur">
      <p className="min-w-0 flex-1 text-xs text-neutral-500">{text}</p>
      {onSave && <>
        {dirty && <button type="button" className={buttonSecondary} disabled={busy} onClick={onReset}><RotateCcw size={15} /> {tr('Undo')}</button>}
        <button type="button" className={buttonPrimary} disabled={!dirty || busy} onClick={onSave}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {tr('Save')}
        </button>
      </>}
    </div>
  );
}

type AccessTab = 'roles' | 'platforms' | 'masters';

/** Access Settings (2026-11-16): one place for the pages of every role, the menus of every app (portal, Operations,
 * Calf On The Road) and the job titles & departments (from HRMS). Every tab saves on its own; a save applies at once
 * (the backend bumps the access generation: signed-in users get the new pages on their next request). */
export function AccessSettingsDrawer({ onClose, initial = 'roles' }: { onClose: () => void; initial?: AccessTab }) {
  const [tab, setTab] = useState<AccessTab>(initial);
  const [dirty, setDirty] = useState<Record<AccessTab, boolean>>({ roles: false, platforms: false, masters: false });
  const mark = useMemo(() => ({
    roles: (v: boolean) => setDirty(d => (d.roles === v ? d : { ...d, roles: v })),
    platforms: (v: boolean) => setDirty(d => (d.platforms === v ? d : { ...d, platforms: v })),
  }), []);
  const unsaved = dirty.roles || dirty.platforms;
  const close = () => {
    if (unsaved && !window.confirm(tr('Changes not saved yet. Close anyway?'))) return;
    onClose();
  };
  const TABS: { key: AccessTab; label: string; icon: React.ReactNode }[] = [
    { key: 'roles', label: tr('Roles & Pages'), icon: <LayoutGrid size={15} /> },
    { key: 'platforms', label: tr('Menus per Platform'), icon: <Smartphone size={15} /> },
    { key: 'masters', label: tr('Job Titles & Departments'), icon: <Briefcase size={15} /> },
  ];
  return (
    <Drawer open onClose={close} size="xl" icon={<ShieldCheck size={18} />} title={tr('Access Settings')}
      description={tr('Roles, pages and the menus of the portal, Operations and Calf On The Road in one place. A saved change applies right away.')}
      footer={<button type="button" className={buttonSecondary} onClick={close}>{tr('Close')}</button>}>
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-neutral-200" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
            {t.icon} {t.label}
            {t.key !== 'masters' && dirty[t.key] && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={tr('Not saved')} />}
          </button>
        ))}
      </div>
      {/* every tab stays mounted: a change not saved yet survives switching tabs */}
      <div hidden={tab !== 'roles'}><RolePagesPanel onDirty={mark.roles} /></div>
      <div hidden={tab !== 'platforms'}><PlatformsPanel onDirty={mark.platforms} /></div>
      <div hidden={tab !== 'masters'}><MastersPanel /></div>
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
      {groups().map(g => ({ ...g, pages: g.pages.filter(p => p.state !== 'hidden') })).filter(g => g.pages.length > 0).map(g => (
        <div key={g.group}>
          <p className="mb-1 text-xs font-semibold capitalize text-neutral-400">{g.group}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {g.pages.map(p => (
              <li key={p.key}>
                <label className={`flex h-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${hidden.includes(p.key) ? 'border-neutral-200 bg-neutral-50 text-neutral-400' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                  <input type="checkbox" checked={!hidden.includes(p.key)} onChange={() => toggle(p.key)} className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-neutral-300 text-brand-700" />
                  <span className="min-w-0 flex-1 break-words font-medium leading-snug">{p.label}</span>
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
function PlatformsPanel({ onDirty }: { onDirty: (dirty: boolean) => void }) {
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
      void loadPlatforms(true);
      setMessage({ ok: true, text: tr('Saved. The menus of every app follow right away.') });
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
  const dirty = Object.keys(draft).length > 0;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  return (
    <div className="space-y-3">
      <SaveBar text={tr('Where every page is shown in the menu: the portal, Operations or the Calf On The Road app. Only the menu changes; the access and the flows stay as they are.')}
        dirty={dirty} busy={busy} onSave={save} onReset={() => setDraft({})} />
      {message && <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
      {!pages ? <SkeletonList rows={5} /> : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead className={kcTable.thead}>
              <tr><th className="min-w-[11rem] px-3 py-2.5">{tr('Page')}</th>{ALL_PLATFORMS.map(k => <th key={k} className="w-28 px-3 py-2.5 text-center">{PLATFORM_LABEL[k]}</th>)}<th className="w-10" /></tr>
            </thead>
            <tbody>
              {byGroup.map(g => (
                <Fragment key={g.group}>
                  <tr className="border-t border-neutral-200 bg-neutral-50/60"><td colSpan={5} className="px-3 py-1.5 text-xs font-semibold capitalize text-neutral-400">{g.group}</td></tr>
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
                          <button type="button" title={tr('Back to the Default')} aria-label={tr('Back to the Default')} onClick={() => setDraft(d => ({ ...d, [p.key]: null }))} className="rounded p-1 text-neutral-400 hover:text-brand-700"><RotateCcw size={13} /></button>
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
    </div>
  );
}

/** The apps every page is shown in (Menus per Platform: the setting, else every app that has the page), read once
 * and shared by every tag; a save in Menus per Platform reloads it. Without access to the setting (role Admin) the
 * pages Operations has are tagged as before. */
type PlatformMap = Record<string, PlatformKey[]>;
let platformsPromise: Promise<PlatformMap | null> | null = null;
const platformListeners = new Set<(m: PlatformMap | null) => void>();
function loadPlatforms(fresh = false): Promise<PlatformMap | null> {
  if (fresh || !platformsPromise) {
    platformsPromise = call<{ pages: PlatformPage[]; platforms: PlatformMap }>('/api/access/platforms')
      .then(r => Object.fromEntries(r.pages.map(p => [p.key, r.platforms[p.key] ?? p.available])) as PlatformMap)
      .catch(() => null);
    void platformsPromise.then(m => platformListeners.forEach(f => f(m)));
  }
  return platformsPromise;
}
function usePlatforms(): PlatformMap | null | undefined {
  const [map, setMap] = useState<PlatformMap | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadPlatforms().then(m => { if (live) setMap(m); });
    const f = (m: PlatformMap | null) => { if (live) setMap(m); };
    platformListeners.add(f);
    return () => { live = false; platformListeners.delete(f); };
  }, []);
  return map;
}

const PLATFORM_TAG: Record<PlatformKey, { label: string; cls: string }> = {
  portal: { label: 'Portal', cls: 'bg-neutral-100 text-neutral-700' },
  operations: { label: 'Operations', cls: 'bg-brand-50 text-brand-700' },
  cotr: { label: 'COTR', cls: 'bg-violet-50 text-violet-700' },
};

function OpsTag({ page }: { page: PageKey }) {
  const map = usePlatforms();
  const apps: PlatformKey[] = map ? map[page] ?? [] : map === null && OPERATIONS_PAGES.includes(page) ? ['operations'] : [];
  if (!apps.length) return null;
  return (
    <span className="inline-flex flex-shrink-0 flex-wrap gap-0.5 align-middle">
      {ALL_PLATFORMS.filter(k => apps.includes(k)).map(k => (
        <span key={k} title={tr('Shown in the menu of {0}', PLATFORM_LABEL[k])}
          className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-semibold ${PLATFORM_TAG[k].cls}`}>
          {k !== 'portal' && <Smartphone size={10} aria-hidden />} {PLATFORM_TAG[k].label}
        </span>
      ))}
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
        : tr('The badges show the apps whose menu has the page. An account with forms and only pages of Operations signs in at {0}, not in the portal.', host)}</span>
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
        <td colSpan={EDITABLE.length + 2} className="px-3 py-1.5 text-xs font-semibold capitalize text-neutral-400">{group}</td>
      </tr>
      {children}
    </>
  );
}

/** Job titles & departments (2026-11-16): the names come from HRMS (positions, org units) through the HRMS sync, so the
 * list is read-only here: how many accounts carry each name. Accounts not linked to HRMS pick a name in their form. */
function MastersPanel() {
  const [kind, setKind] = useState<MasterKind>('jobTitle');
  return (
    <div className="space-y-3">
      <SaveBar text={tr('Job titles and departments follow HRMS: a linked account gets them from its employee every hour. The list is read-only; accounts not linked to HRMS pick a name in their form.')} dirty={false} busy={false} />
      <div className="flex gap-1" role="tablist">
        {(['jobTitle', 'department'] as MasterKind[]).map(k => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${kind === k ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-neutral-500 hover:bg-neutral-100'}`}>
            {k === 'jobTitle' ? <Briefcase size={13} /> : <Building2 size={13} />} {k === 'jobTitle' ? tr('Job titles') : tr('Departments')}
          </button>
        ))}
      </div>
      <MasterList key={kind} kind={kind} />
    </div>
  );
}

function MasterList({ kind }: { kind: MasterKind }) {
  const [rows, setRows] = useState<MasterName[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { void loadMaster(kind, true).then(setRows); }, [kind]);
  const shown = (rows ?? []).filter(r => r.users > 0 && r.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <input className={inputClass} value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Search')} aria-label={tr('Search')} />
      {!rows ? <SkeletonList rows={4} /> : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">{tr('No names yet')}</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {shown.map(r => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">{r.name}</span>
              <span className="flex-shrink-0 text-[11px] tabular-nums text-neutral-400">{tr('{0} users', r.users)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
