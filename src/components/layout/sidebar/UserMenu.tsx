'use client';

// The account at the foot of the sidebar: name, role, then a menu with the profile, the password, the preferences
// (language, theme) and signing out.

import { useCallback, useRef, useState } from 'react';
import { ChevronsUpDown, KeyRound, LogOut, ShieldCheck, UserRoundPen } from 'lucide-react';
import { useAccountDrawers } from '@/components/AccountDrawers';
import UserAvatar from '@/components/UserAvatar';
import { PreferenceControls } from '@/components/ui/Preferences';
import { Pill, cx } from '@/components/kc';
import { ROLE_LABELS, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

const item = 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors';

export default function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const { openProfile, openPassword } = useAccountDrawers();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!user) return null;
  const role = ROLE_LABELS[user.role] ?? user.role;
  const superadmin = user.role === 'superadmin';

  return (
    <div className="flex-shrink-0 border-t border-neutral-200 p-2.5" ref={ref}>
      <div className="relative">
        {open && (
          <div className={cx('absolute bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl', collapsed ? 'left-0 w-64' : 'inset-x-0')}>
            <div className="border-b border-neutral-100 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{user.displayName}</p>
                  <Pill tone={superadmin ? 'red' : 'brand'} icon={superadmin ? <ShieldCheck size={11} /> : undefined} className="mt-0.5 uppercase tracking-wide">{role}</Pill>
                </div>
              </div>
              <dl className="mt-2.5 space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-neutral-400">{tr('Username')}</dt><dd className="truncate font-medium text-neutral-700">{user.username}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-neutral-400">{tr('Email')}</dt><dd className="truncate font-medium text-neutral-700">{user.email}</dd></div>
              </dl>
            </div>
            <PreferenceControls />
            <div className="p-1.5">
              <button type="button" onClick={() => { setOpen(false); openProfile(); }} className={cx(item, 'text-neutral-700 hover:bg-neutral-100')}>
                <UserRoundPen size={16} /> {tr('My profile')}
                {!user.profileComplete && <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{tr('Incomplete')}</span>}
              </button>
              <button type="button" onClick={() => { setOpen(false); openPassword(); }} className={cx(item, 'text-neutral-700 hover:bg-neutral-100')}>
                <KeyRound size={16} /> {tr('Change password')}
              </button>
              <button type="button" onClick={() => { setOpen(false); logout(); }} className={cx(item, 'text-red-600 hover:bg-red-50')}>
                <LogOut size={16} /> {tr('Sign out')}
              </button>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={collapsed ? `${user.displayName} · ${role}` : undefined}
          className={cx('flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-neutral-200/60', collapsed && 'justify-center')}>
          <span className="relative flex-shrink-0">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {!user.profileComplete && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-neutral-50" title={tr('Profile incomplete')} />}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium text-neutral-900">{user.displayName}</span>
                <span className="block truncate text-[11px] text-neutral-500">{role} · {user.username}</span>
              </span>
              <ChevronsUpDown size={14} className="text-neutral-400" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
