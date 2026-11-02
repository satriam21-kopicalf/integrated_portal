'use client';

// Production at the main hub and its distribution (backend migration 062): a batch of a menu made at a production hub
// with its production and expiry date (the shelf life of the menu by default), sent to the pools in parts; the storage
// of a pool receives the parts and sees its stock per batch, first expired first (Storage & Assignment).

import { AlarmClock, Building2, CalendarClock, CookingPot, Factory, PackageCheck, Plus, Send, Trash2, Truck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Empty, ErrorState, Field, Input, Panel, Select, cx, theadClass, useToast } from '@/so/ui';
import { call } from '@/so/features/checkin/checkin';
import { Menu, Pool } from '@/cotr/types';
import { useMaster } from '@/cotr/ui';
import { locale, tr } from '@/lib/i18n';
import { IconButton, SearchInput, StatCard, StatGrid, ValueSkeleton } from '@/components/kc';
import Drawer, { DrawerSection } from '@/components/kc/Drawer';
import { SkeletonCards } from '@/components/kc/Skeleton';
import { ScopeBar } from '@/components/kc/ScopeBar';
import { ComboFilter, FilterRow, MonitorFilterSheet, OptionList } from '@/so/ui/MonitorFilters';

type BatchFilter = '' | 'hub' | 'expiring' | 'expired' | 'out';

type Transfer = { id: string; pool: string; poolName: string; qty: number; status: 'sent' | 'received'; note: string | null; sentAt: string; receivedAt: string | null };
type Batch = { id: string; batchNo: string; hub: string; menu: string; qty: number; producedOn: string; expiresOn: string; note: string | null;
  sent: number; received: number; atHub: number; transfers: Transfer[] };
type StockItem = { transfer: string; batchNo: string; menu: string; menuName: string; qty: number; status: 'sent' | 'received'; producedOn: string; expiresOn: string; daysLeft: number };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dmy = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The expiry of a batch as a badge: expired, today, tomorrow, in n days. */
export function ExpiryBadge({ days, date }: { days: number; date: string }) {
  const tone = days < 0 ? 'red' : days <= 1 ? 'amber' : days <= 3 ? 'blue' : 'green';
  const text = days < 0 ? tr('Expired {0}', dmy(date)) : days === 0 ? tr('Expires today') : days === 1 ? tr('Expires tomorrow') : tr('Expires in {0} days', days);
  return <Badge tone={tone} icon={<CalendarClock size={11} />}>{text}</Badge>;
}

export function BatchesTab() {
  const toast = useToast();
  const pools = useMaster<Pool>('pools');
  const menusMaster = useMaster<Menu>('menus');
  const menus = (menusMaster.rows ?? []).filter((m) => m.is_active);
  const hubs = useMemo(() => [...(pools.rows ?? [])].sort((a, b) => Number(!!b.is_production) - Number(!!a.is_production)), [pools.rows]);
  const [rows, setRows] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({ hub: '', menu: '', qty: '', producedOn: todayWib(), expiresOn: '' });
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [fHub, setFHub] = useState('');
  const [state, setState] = useState<BatchFilter>('');
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<{ hub: string; state: BatchFilter }>({ hub: '', state: '' });
  const hub = form.hub || hubs[0]?.code || '';
  const menu = menus.find((m) => m.code === form.menu);
  const defaultExpiry = menu?.shelf_life_days ? addDays(form.producedOn, menu.shelf_life_days) : '';
  const load = useCallback(() => {
    setError(null);
    call<{ data: Batch[] }>('/api/cotr/batches').then((r) => setRows(r.data)).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load, tick]);
  const today = todayWib();
  const daysLeft = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
  const add = async () => {
    setBusy(true);
    try {
      const out = await call<{ batchNo: string }>('/api/cotr/batches', { method: 'POST', json: { hub, menu: form.menu, qty: Number(form.qty), producedOn: form.producedOn, expiresOn: form.expiresOn || defaultExpiry || null } });
      toast(tr('Batch {0} saved', out.batchNo));
      setForm({ ...form, qty: '', expiresOn: '' });
      setAdding(false);
      setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (b: Batch) => {
    if (!window.confirm(tr('Delete batch {0}?', b.batchNo))) return;
    try { await call(`/api/cotr/batches/${b.id}`, { method: 'DELETE' }); setTick((t) => t + 1); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const name = (code: string) => menus.find((m) => m.code === code)?.name ?? code;
  const STATES: { value: BatchFilter; label: string }[] = [
    { value: '', label: tr('Every batch') }, { value: 'hub', label: tr('Still at the hub') }, { value: 'expiring', label: tr('Expires within 2 days') },
    { value: 'expired', label: tr('Expired') }, { value: 'out', label: tr('Fully sent') },
  ];
  const matchState = (b: Batch, f: BatchFilter) => {
    const left = daysLeft(b.expiresOn);
    return f === 'hub' ? b.atHub > 0 : f === 'expiring' ? left >= 0 && left <= 2 : f === 'expired' ? left < 0 : f === 'out' ? b.atHub === 0 : true;
  };
  const listed = (rows ?? []).filter((b) => (!fHub || b.hub === fHub) && matchState(b, state)
    && (!q.trim() || `${name(b.menu)} ${b.batchNo}`.toLowerCase().includes(q.trim().toLowerCase())));
  const hubName = (code: string) => hubs.find((p) => p.code === code)?.name ?? code;
  return (
    <>
      <ScopeBar onOpen={() => { setDraft({ hub: fHub, state }); setSheet(true); }} onRefresh={load}
        right={<div className="flex items-center gap-2"><SearchInput value={q} onChange={setQ} placeholder={tr('Search menu or batch')} /><Button onClick={() => setAdding(true)}><Plus size={15} /> {tr('New batch')}</Button></div>}
        scopes={[
          { key: 'hub', icon: <Building2 />, label: tr('Production hub'), value: fHub ? hubName(fHub) : tr('Every hub'), active: !!fHub },
          { key: 'state', icon: <PackageCheck />, label: tr('Status'), value: STATES.find((x) => x.value === state)!.label, active: !!state },
        ]} />
      <StatGrid label={tr('Batches & distribution')} cols={4}>
        <StatCard label={tr('Batches')} icon={<Factory />} value={rows ? listed.length : <ValueSkeleton />} sub={tr('Last 14 days')} />
        <StatCard label={tr('Produced')} icon={<CookingPot />} value={rows ? listed.reduce((a, b) => a + b.qty, 0).toLocaleString(locale()) : <ValueSkeleton />} sub={rows && tr('{0} sent', listed.reduce((a, b) => a + b.sent, 0).toLocaleString(locale()))} />
        <StatCard label={tr('At the hub')} tone="brand" icon={<PackageCheck />} value={rows ? listed.reduce((a, b) => a + b.atHub, 0).toLocaleString(locale()) : <ValueSkeleton />} />
        <StatCard label={tr('Expires within 2 days')} icon={<AlarmClock />} tone={listed.some((b) => b.atHub > 0 && matchState(b, 'expiring')) ? 'warn' : 'default'} value={rows ? listed.filter((b) => b.atHub > 0 && matchState(b, 'expiring')).length : <ValueSkeleton />} sub={tr('still at the hub')} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={[draft.hub, draft.state].filter(Boolean).length} onClose={() => setSheet(false)} onReset={() => setDraft({ hub: '', state: '' })}
          onApply={() => { setFHub(draft.hub); setState(draft.state); setSheet(false); }}>
          <FilterRow icon={<Building2 size={15} />} label={tr('Production hub')} value={draft.hub ? hubName(draft.hub) : null} onClear={() => setDraft({ ...draft, hub: '' })}>
            <ComboFilter value={draft.hub} onChange={(v) => setDraft({ ...draft, hub: v })} allLabel={tr('Every hub')} placeholder={tr('Search pool')}
              options={hubs.map((p) => ({ value: p.code, label: p.name, hint: p.is_production ? tr('production hub') : p.city }))} />
          </FilterRow>
          <FilterRow icon={<PackageCheck size={15} />} label={tr('Status')} value={draft.state ? STATES.find((x) => x.value === draft.state)!.label : null} onClear={() => setDraft({ ...draft, state: '' })}>
            <OptionList value={draft.state} onChange={(v) => setDraft({ ...draft, state: v as BatchFilter })} choices={STATES} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <Drawer open={adding} onClose={() => setAdding(false)} title={tr('New production batch')} icon={<Factory size={18} />}
        description={tr('Made at the main hub: the production date and the expiry date of every batch (the shelf life of the menu by default)')}
        footer={<><Button variant="ghost" onClick={() => setAdding(false)}>{tr('Cancel')}</Button>
          <Button loading={busy} disabled={!hub || !form.menu || !Number(form.qty) || !(form.expiresOn || defaultExpiry)} onClick={() => void add()}><Plus size={16} /> {tr('Save batch')}</Button></>}>
        <DrawerSection title={tr('Batch')}>
          <Field label={tr('Production hub')}>
            <Select value={hub} onChange={(e) => setForm({ ...form, hub: e.target.value })}>
              {hubs.map((p) => <option key={p.code} value={p.code}>{p.name}{p.is_production ? ` · ${tr('production hub')}` : ''}</option>)}
            </Select>
          </Field>
          <Field label={tr('Menu')}>
            <Select value={form.menu} onChange={(e) => setForm({ ...form, menu: e.target.value, expiresOn: '' })}>
              <option value="">{tr('Choose a menu')}</option>{menus.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label={tr('Quantity')}><Input inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, '') })} placeholder="0" /></Field>
        </DrawerSection>
        <DrawerSection title={tr('Dates')}>
          <Field label={tr('Production date')}><Input type="date" value={form.producedOn} max={today} onChange={(e) => setForm({ ...form, producedOn: e.target.value || today })} /></Field>
          <Field label={tr('Expiry date')} hint={menu?.shelf_life_days ? tr('{0} days of shelf life', menu.shelf_life_days) : tr('Fill the shelf life in Master Menu to set it by itself')}>
            <Input type="date" value={form.expiresOn || defaultExpiry} min={form.producedOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
          </Field>
        </DrawerSection>
      </Drawer>

      <Panel title={tr('Batches & distribution')} description={tr('Batches of the last 14 days: what was sent to each pool and what is left at the hub')}>
        {error ? <ErrorState message={error} onRetry={load} /> : !rows ? <div className="p-4"><SkeletonCards count={4} /></div> : listed.length === 0 ? (
          rows.length === 0
            ? <Empty icon={<Factory size={26} />} title={tr('No batch yet')}>{tr('Save the first production batch.')}<div className="mt-3"><Button onClick={() => setAdding(true)}><Plus size={15} /> {tr('New batch')}</Button></div></Empty>
            : <Empty icon={<Factory size={26} />} title={tr('Nothing matches the filters')} />
        ) : (
          <ul className="grid gap-3 p-3 sm:p-4 xl:grid-cols-2">
            {listed.map((b) => {
              const left = daysLeft(b.expiresOn);
              const pct = Math.round((b.sent / b.qty) * 100);
              return (
                <li key={b.id} className="rounded-xl border border-neutral-200 bg-white">
                  <div className="flex flex-wrap items-start gap-2 border-b border-neutral-100 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{name(b.menu)} · {b.qty}</p>
                      <p className="font-mono text-[11px] text-neutral-400">{b.batchNo} · {hubName(b.hub)}</p>
                    </div>
                    <ExpiryBadge days={left} date={b.expiresOn} />
                    {b.sent === 0 && <IconButton label={tr('Delete')} onClick={() => void remove(b)}><Trash2 size={15} /></IconButton>}
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-neutral-50 py-1.5"><p className="text-[10px] uppercase text-neutral-400">{tr('Produced')}</p><p className="font-semibold">{dmy(b.producedOn)}</p></div>
                      <div className="rounded-lg bg-neutral-50 py-1.5"><p className="text-[10px] uppercase text-neutral-400">{tr('Expires')}</p><p className="font-semibold">{dmy(b.expiresOn)}</p></div>
                      <div className="rounded-lg bg-neutral-50 py-1.5"><p className="text-[10px] uppercase text-neutral-400">{tr('At the hub')}</p><p className="font-semibold tabular-nums">{b.atHub}</p></div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-neutral-500"><span>{tr('Sent {0} of {1}', b.sent, b.qty)}</span><span>{tr('{0} received', b.received)}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                    {b.transfers.length > 0 && (
                      <ul className="space-y-1 text-xs">
                        {b.transfers.map((t) => (
                          <li key={t.id} className="flex items-center gap-2"><Truck size={12} className="text-neutral-400" /><span className="flex-1 truncate">{t.poolName}</span>
                            <span className="tabular-nums">{t.qty}</span>{t.status === 'received' ? <Badge tone="green">{tr('Received')}</Badge> : <Badge tone="amber">{tr('On the way')}</Badge>}</li>
                        ))}
                      </ul>
                    )}
                    {b.atHub > 0 && (sending === b.id
                      ? <SendForm batch={b} pools={(pools.rows ?? []).filter((p) => p.code !== b.hub)} onClose={() => setSending(null)} onSent={() => { setSending(null); setTick((t) => t + 1); }} />
                      : <Button size="sm" variant="secondary" className="w-full" onClick={() => setSending(b.id)}><Send size={14} /> {tr('Send to a pool')}</Button>)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

function SendForm({ batch, pools, onClose, onSent }: { batch: Batch; pools: Pool[]; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [pool, setPool] = useState(pools[0]?.code ?? '');
  const [qty, setQty] = useState(String(batch.atHub));
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await call(`/api/cotr/batches/${batch.id}/send`, { method: 'POST', json: { pool, qty: Number(qty) } }); toast(tr('Sent')); onSent(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2.5 sm:grid-cols-[1fr_6rem_auto]">
      <Select value={pool} onChange={(e) => setPool(e.target.value)} className="h-10">{pools.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select>
      <Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} className="h-10 text-right" aria-label={tr('Quantity')} />
      <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onClose}>{tr('Cancel')}</Button>
        <Button size="sm" loading={busy} disabled={!pool || !Number(qty) || Number(qty) > batch.atHub} onClick={() => void send()}><Send size={14} /> {tr('Send')}</Button></div>
    </div>
  );
}

/** Storage & Assignment: the parts on the way to the pool (to receive) and its stock per batch, first expired first. */
export function PoolBatches({ pool }: { pool: string }) {
  const toast = useToast();
  const [data, setData] = useState<{ received: StockItem[]; incoming: StockItem[] } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pool) return;
    let alive = true;
    call<{ received: StockItem[]; incoming: StockItem[] }>(`/api/cotr/pool-stock?pool=${encodeURIComponent(pool)}`).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [pool, tick]);
  const receive = async (id: string) => {
    try { await call(`/api/cotr/transfers/${id}/receive`, { method: 'POST' }); toast(tr('Received')); setTick((t) => t + 1); } catch (e) { toast((e as Error).message, 'error'); }
  };
  if (!data || (!data.received.length && !data.incoming.length)) return null;
  return (
    <Panel title={tr('Stock from the main hub')} description={tr('Batches of the pool, first expired first: hand the oldest to the drivers')}>
      {data.incoming.length > 0 && (
        <div className="border-b border-neutral-100 p-3 sm:p-4">
          <p className="mb-2 text-xs font-semibold text-amber-800">{tr('On the way to this pool ({0})', data.incoming.length)}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.incoming.map((i) => (
              <li key={i.transfer} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2">
                <Truck size={16} className="flex-shrink-0 text-amber-700" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{i.menuName} · {i.qty}</span><span className="font-mono text-[11px] text-neutral-500">{i.batchNo} · {tr('exp')} {dmy(i.expiresOn)}</span></span>
                <Button size="sm" onClick={() => void receive(i.transfer)}><PackageCheck size={14} /> {tr('Receive')}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.received.length > 0 && (
        <table className="m-cards w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2">{tr('Product')}</th><th className="px-3 py-2">{tr('Batch')}</th><th className="px-3 py-2 text-right">{tr('Quantity')}</th><th className="px-3 py-2">{tr('Produced')}</th><th className="px-4 py-2">{tr('Expiry')}</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {data.received.map((i) => (
              <tr key={i.transfer} className={cx(i.daysLeft < 0 && 'bg-red-50/50')}>
                <td className="px-4 py-2 font-medium text-neutral-900">{i.menuName}</td><td className="px-3 py-2 font-mono text-xs">{i.batchNo}</td>
                <td className="px-3 py-2 text-right tabular-nums">{i.qty}</td><td className="px-3 py-2 text-xs">{dmy(i.producedOn)}</td>
                <td className="px-4 py-2"><ExpiryBadge days={i.daysLeft} date={i.expiresOn} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
