'use client';

// Schedule of the Cost Control team (Cost Control · Clock In, page cc.schedule; integrated_portal_be app/cc_schedule.py,
// 2026-11-13): the leader plans which outlets each member visits per day; every planned visit shows whether it was
// clocked in (done), missed or still planned, and the clock ins outside the plan. Monitoring of Cost Control Clock In
// opens it read-only.

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Copy, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import BranchAssign from '@/components/BranchAssign';
import type { Branch } from '@/components/BranchFilter';
import Dialog from '@/so/ui/Dialog';
import { Button, cx, ErrorState, Input, Page, Panel, SkeletonRows, useToast } from '@/so/ui';
import { Stat, StatSkeleton, StatStrip } from '@/so/ui/StatStrip';
import { call } from '@/so/features/checkin/checkin';
import { hasPage, useAuth } from '@/lib/auth';
import { numberLocale, tr } from '@/lib/i18n';

type Member = { id: string; username: string; name: string };
type Visit = { id: number; userId: string; day: string; branchCode: string; branchName: string; note: string | null; status: 'done' | 'missed' | 'planned'; clockIn: string | null };
type Extra = { userId: string; day: string; branchCode: string; branchName: string; clockIn: string };
type Week = { period: { from: string; to: string }; team: Member[]; data: Visit[]; unplanned: Extra[]; counts: Record<'done' | 'missed' | 'planned' | 'unplanned', number> };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const short = (name: string) => name.replace(/^Kopi Calf (To Go )?/i, '');
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const STATUS = {
  done: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', label: () => tr('Done') },
  missed: { icon: XCircle, cls: 'bg-red-50 text-red-700 ring-red-200', label: () => tr('Missed') },
  planned: { icon: CircleDashed, cls: 'bg-white text-neutral-700 ring-neutral-200', label: () => tr('Planned') },
};

export default function SchedulePage() {
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = hasPage(user, 'cc.schedule');
  const [from, setFrom] = useState(() => iso(monday(new Date())));
  const [res, setRes] = useState<Week | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [edit, setEdit] = useState<{ member: Member; day: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setRes(null);
    try { setRes(await call<Week>(`/api/cost-control/schedule?dateFrom=${from}&dateTo=${addDays(from, 6)}`)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [from]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (canEdit) void call<Branch[]>('/api/branches?company=all').then(setBranches).catch(() => setBranches([])); }, [canEdit]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = iso(new Date());
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(numberLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const copy = async () => {
    setBusy(true);
    try {
      const r = await call<{ copied: number }>('/api/cost-control/schedule/copy-week', { method: 'POST', json: { from } });
      toast(tr('{0} visits copied to the next week', r.copied));
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const c = res?.counts;
  return (
    <Page title={tr('Cost Control Schedule')} subtitle={tr('Which outlets each Cost Control member visits per day, against their clock ins')}
      stats={
        <StatStrip label={tr('Summary')} columns={4}>
          <Stat label={STATUS.done.label()} emphasis icon={<CheckCircle2 size={13} />} value={c ? c.done : <StatSkeleton />}>{c && <p>{tr('clocked in as planned')}</p>}</Stat>
          <Stat label={STATUS.missed.label()} icon={<XCircle size={13} />} value={c ? <span className={c.missed ? 'text-red-700' : undefined}>{c.missed}</span> : <StatSkeleton />}>{c && <p>{tr('a day gone by without a clock in')}</p>}</Stat>
          <Stat label={STATUS.planned.label()} icon={<CircleDashed size={13} />} value={c ? c.planned : <StatSkeleton />}>{c && <p>{tr('today or later')}</p>}</Stat>
          <Stat label={tr('Unplanned')} icon={<CalendarDays size={13} />} value={c ? c.unplanned : <StatSkeleton />}>{c && <p>{tr('clock ins outside the plan')}</p>}</Stat>
        </StatStrip>
      }>
      <Panel toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setFrom(addDays(from, -7))} aria-label={tr('Previous week')}><ChevronLeft size={15} /></Button>
          <span className="min-w-[12rem] text-center text-sm font-semibold text-neutral-800">{label(days[0])} – {label(days[6])}</span>
          <Button size="sm" variant="secondary" onClick={() => setFrom(addDays(from, 7))} aria-label={tr('Next week')}><ChevronRight size={15} /></Button>
          <Button size="sm" variant="ghost" onClick={() => setFrom(iso(monday(new Date())))}>{tr('This week')}</Button>
          {canEdit && <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void copy()} loading={busy}><Copy size={14} /> {tr('Copy to the next week')}</Button>}
        </div>}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={8} /></tbody></table>
          : !res.team.length ? <p className="px-5 py-8 text-center text-sm text-neutral-500">{tr('No Cost Control member yet: give an account the page Cost Control Clock In.')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <tr><th className="w-40 px-3 py-2.5 text-left">{tr('Member')}</th>
                    {days.map((d) => <th key={d} className={cx('px-2 py-2.5 text-left', d === today && 'text-brand-700')}>{label(d)}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {res.team.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className="px-3 py-2"><span className="block truncate font-medium text-neutral-900">{m.name}</span><span className="text-[11px] text-neutral-400">{m.username}</span></td>
                      {days.map((d) => {
                        const visits = res.data.filter((v) => v.userId === m.id && v.day === d);
                        const extra = res.unplanned.filter((v) => v.userId === m.id && v.day === d);
                        const editable = canEdit && d >= addDays(today, -1);
                        return (
                          <td key={d} className={cx('px-1.5 py-1.5', d === today && 'bg-brand-50/30')}>
                            <button type="button" disabled={!editable} onClick={() => setEdit({ member: m, day: d })}
                              className={cx('flex min-h-14 w-full flex-col gap-1 rounded-lg p-1 text-left', editable && 'hover:bg-neutral-50')}
                              aria-label={tr('Schedule of {0} on {1}', m.name, label(d))}>
                              {visits.map((v) => {
                                const S = STATUS[v.status];
                                return <span key={v.id} title={[v.branchName, S.label(), v.note].filter(Boolean).join(' · ')} className={cx('flex items-center gap-1 truncate rounded-md px-1.5 py-1 ring-1 ring-inset', S.cls)}>
                                  <S.icon size={11} className="flex-shrink-0" /><span className="truncate">{short(v.branchName)}</span></span>;
                              })}
                              {extra.map((v) => <span key={v.branchCode} title={tr('Clocked in outside the plan')} className="truncate rounded-md bg-amber-50 px-1.5 py-1 italic text-amber-800">+ {short(v.branchName)}</span>)}
                              {!visits.length && !extra.length && editable && <span className="text-[11px] text-neutral-300">{tr('+ plan')}</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
      {edit && res && <DayDialog member={edit.member} day={edit.day} label={label(edit.day)} branches={branches}
        current={res.data.filter((v) => v.userId === edit.member.id && v.day === edit.day)}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </Page>
  );
}

function DayDialog({ member, day, label, branches, current, onClose, onSaved }: {
  member: Member; day: string; label: string; branches: Branch[]; current: Visit[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [codes, setCodes] = useState<string[]>(current.map((v) => v.branchCode));
  const [note, setNote] = useState(current.find((v) => v.note)?.note ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await call('/api/cost-control/schedule', { method: 'PUT', json: { userId: member.id, day, branches: codes, note } });
      toast(tr('Saved'));
      onSaved();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Dialog open size="lg" onClose={onClose} title={`${member.name} · ${label}`} description={tr('The outlets to visit this day; none clears the day.')}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{tr('Cancel')}</Button><Button onClick={() => void save()} loading={busy}>{tr('Save')}</Button></>}>
      <div className="space-y-3">
        <BranchAssign branches={branches} loading={!branches.length} value={codes} onChange={setCodes} />
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={tr('Note for the member (optional), e.g. audit SO, check waste')} />
      </div>
    </Dialog>
  );
}
