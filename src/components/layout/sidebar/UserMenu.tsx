'use client';

// The account at the foot of the sidebar (after kopicalf-hrms): name and role, then a compact menu with who is signed
// in, the notifications and the guide (2026-11-13: moved here from the header of the sidebar), the profile and the
// password, the preferences (theme, language) and signing out.

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Bell, BookOpen, ChevronsUpDown, KeyRound, Languages, LogOut, Monitor, Moon, ShieldCheck, Sun, UserRoundPen } from 'lucide-react';
import { NotificationsDrawer, UnreadBadge, useNotifications } from '@/components/AlertBell';
import { useAccountDrawers } from '@/components/AccountDrawers';
import UserAvatar from '@/components/UserAvatar';
import { Pill, cx } from '@/components/kc';
import { ROLE_LABELS, canAccess, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';
import { Lang, tr, useLang } from '@/lib/i18n';
import { ThemeMode, useTheme } from '@/lib/theme';

const item = 'relative flex w-full items-center gap-2.5 rounded-[4px] px-3 py-1.5 text-left text-[13px] transition-colors [&>svg]:h-[15px] [&>svg]:w-[15px] [&>svg]:text-[color:var(--j-626F86)]';
const group = 'px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--j-626F86)]';

/** Icon or short segmented switch inside the menu. */
function Switch<V extends string>({ label, value, onChange, options }: {
  label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string; icon?: React.ReactNode; text?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} title={o.label} aria-label={o.label} onClick={() => onChange(o.value)}
            className={cx('inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-[11px] font-semibold transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
              on ? 'bg-[color:var(--j-0C66E4)] text-white' : 'border border-[color:var(--j-DCDFE4)] text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]')}>
            {o.icon ?? o.text}
          </button>
        );
      })}
    </div>
  );
}

export default function UserMenu({ collapsed, onNavigate, placement = 'side' }: { collapsed: boolean; onNavigate?: () => void;
  /** 'top': the avatar of the desktop top bar, the menu opening under it (2026-11-18); 'side': the foot of the sidebar */ placement?: 'top' | 'side' }) {
  const { user, logout } = useAuth();
  const { openProfile, openPassword } = useAccountDrawers();
  const { mode, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(false);
  const { enabled: canNotify, unread } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!user) return null;
  const role = ROLE_LABELS[user.role] ?? user.role;
  const superadmin = user.role === 'superadmin';
  const top = placement === 'top';
  // in the top bar the bell and the guide have their own buttons
  const guide = !top && canAccess(user, '/guide');

  return (
    <div className={top ? 'relative' : 'flex-shrink-0 border-t border-[color:var(--j-DCDFE4)] p-2 lg:hidden'} ref={ref}>
      <div className="relative">
        {open && (
          <div role="menu" className={cx('absolute z-40 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white py-1 shadow-xl', top ? 'right-0 top-full mt-1.5 w-72' : collapsed ? 'bottom-full left-0 mb-1.5 w-64' : 'inset-x-0 bottom-full mb-1.5 min-w-[15rem]')}>
            <p className={group}>{tr("Account")}</p>
            <div className="flex items-center gap-2.5 px-3 py-2">
              <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[color:var(--j-172B4D)]">{user.displayName}</p>
                <p className="truncate text-[11px] text-[color:var(--j-626F86)]">{user.email || `@${user.username}`}</p>
              </div>
              <Pill tone={superadmin ? 'red' : 'brand'} icon={superadmin ? <ShieldCheck size={11} /> : undefined} className="flex-shrink-0">{role}</Pill>
            </div>
            <div className="my-1 h-px bg-[color:var(--j-DCDFE4)]" />
            {canNotify && !top && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setNotes(true); }} className={cx(item, 'text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
                <Bell /> {tr('Notifications')}<UnreadBadge n={unread} className="ml-auto" />
              </button>
            )}
            {guide && (
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate?.(); router.push('/guide'); }}
                className={cx(item, pathname === '/guide' ? 'bg-[color:var(--j-E9F2FF)] font-medium text-[color:var(--j-0055CC)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
                <BookOpen /> {tr('Guide')}
              </button>
            )}
            {((canNotify && !top) || guide) && <div className="my-1 h-px bg-[color:var(--j-DCDFE4)]" />}
            <p className={group}>{tr('Profile')}</p>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); openProfile(); }} className={cx(item, 'text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
              <UserRoundPen /> {tr('My profile')}
              {!user.profileComplete && <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{tr('Incomplete')}</span>}
            </button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); openPassword(); }} className={cx(item, 'text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
              <KeyRound /> {tr('Change Password')}
            </button>
            <div className="my-1 h-px bg-[color:var(--j-DCDFE4)]" />
            <p className={group}>{tr('Preferences')}</p>
            <div className="flex items-center gap-2.5 px-3 py-1 text-[13px] text-[color:var(--j-44546F)]">
              <Sun size={15} className="text-[color:var(--j-626F86)]" /><span className="flex-1">{tr('Appearance')}</span>
              <Switch<ThemeMode> label={tr('Appearance')} value={mode} onChange={setMode} options={[
                { value: 'light', label: tr('Light'), icon: <Sun /> }, { value: 'dark', label: tr('Dark'), icon: <Moon /> }, { value: 'system', label: tr('System'), icon: <Monitor /> },
              ]} />
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1 text-[13px] text-[color:var(--j-44546F)]">
              <Languages size={15} className="text-[color:var(--j-626F86)]" /><span className="flex-1">{tr('Language')}</span>
              <Switch<Lang> label={tr('Language')} value={lang} onChange={setLang} options={[
                { value: 'en', label: tr('English'), text: 'EN' }, { value: 'id', label: tr('Indonesia'), text: 'ID' },
              ]} />
            </div>
            <div className="my-1 h-px bg-[color:var(--j-DCDFE4)]" />
            <button type="button" role="menuitem" onClick={() => { setOpen(false); logout(); }} className={cx(item, 'text-red-600 hover:bg-red-50 [&>svg]:!text-red-500')}>
              <LogOut /> {tr('Sign Out')}
            </button>
          </div>
        )}
        {top ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={tr('Account')} title={`${user.displayName} · ${role}`}
            className={cx('relative flex rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-[color:var(--j-DCDFE4)]', open && 'ring-2 ring-[color:var(--j-388BFF)]')}>
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {!user.profileComplete && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" title={tr('Profile Incomplete')} />}
          </button>
        ) : (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" title={collapsed ? `${user.displayName} · ${role}` : undefined}
          className={cx('flex w-full items-center gap-2 rounded-[4px] p-1.5 text-left transition-colors hover:bg-[color:var(--j-091E420F)]', open && 'bg-[color:var(--j-E9F2FF)]', collapsed && 'justify-center')}>
          <span className="relative flex-shrink-0">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {unread > 0 ? <UnreadBadge n={unread} className="absolute -right-1.5 -top-1.5 ring-2 ring-neutral-50" />
              : !user.profileComplete && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-neutral-50" title={tr('Profile Incomplete')} />}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[color:var(--j-172B4D)]">{user.displayName}</span>
                <span className="block truncate text-[11px] text-[color:var(--j-626F86)]">{role}</span>
              </span>
              <ChevronsUpDown size={14} className="text-[color:var(--j-626F86)]" />
            </>
          )}
        </button>
        )}
      </div>
      {/* on phones the menu sits in a sliding (transformed) drawer: the notifications open over the whole screen */}
      {canNotify && notes && createPortal(<NotificationsDrawer open onClose={() => setNotes(false)} onNavigate={onNavigate} />, document.body)}
    </div>
  );
}
