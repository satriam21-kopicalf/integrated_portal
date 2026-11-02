'use client';

// The account at the foot of the sidebar (after kopicalf-hrms): name and role, then a compact menu with who is signed
// in, the profile and the password, the preferences (theme, language) and signing out.

import { useCallback, useRef, useState } from 'react';
import { ChevronsUpDown, KeyRound, Languages, LogOut, Monitor, Moon, ShieldCheck, Sun, UserRoundPen } from 'lucide-react';
import { useAccountDrawers } from '@/components/AccountDrawers';
import UserAvatar from '@/components/UserAvatar';
import { Pill, cx } from '@/components/kc';
import { ROLE_LABELS, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';
import { Lang, tr, useLang } from '@/lib/i18n';
import { ThemeMode, useTheme } from '@/lib/theme';

const item = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors [&>svg]:h-[15px] [&>svg]:w-[15px]';

/** Icon or short segmented switch inside the menu. */
function Switch<V extends string>({ label, value, onChange, options }: {
  label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string; icon?: React.ReactNode; text?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-neutral-100 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} title={o.label} aria-label={o.label} onClick={() => onChange(o.value)}
            className={cx('inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-[11px] font-semibold transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
              on ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200' : 'text-neutral-500 hover:text-neutral-800')}>
            {o.icon ?? o.text}
          </button>
        );
      })}
    </div>
  );
}

export default function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const { openProfile, openPassword } = useAccountDrawers();
  const { mode, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!user) return null;
  const role = ROLE_LABELS[user.role] ?? user.role;
  const superadmin = user.role === 'superadmin';

  return (
    <div className="flex-shrink-0 border-t border-neutral-200 p-2" ref={ref}>
      <div className="relative">
        {open && (
          <div role="menu" className={cx('absolute bottom-full z-10 mb-1.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg', collapsed ? 'left-0 w-64' : 'inset-x-0 min-w-[15rem]')}>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-neutral-900">{user.displayName}</p>
                <p className="truncate text-[11px] text-neutral-500">{user.email || `@${user.username}`}</p>
              </div>
              <Pill tone={superadmin ? 'red' : 'brand'} icon={superadmin ? <ShieldCheck size={11} /> : undefined} className="flex-shrink-0">{role}</Pill>
            </div>
            <div className="my-1 h-px bg-neutral-200" />
            <button type="button" role="menuitem" onClick={() => { setOpen(false); openProfile(); }} className={cx(item, 'text-neutral-700 hover:bg-neutral-100')}>
              <UserRoundPen /> {tr('My profile')}
              {!user.profileComplete && <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{tr('Incomplete')}</span>}
            </button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); openPassword(); }} className={cx(item, 'text-neutral-700 hover:bg-neutral-100')}>
              <KeyRound /> {tr('Change password')}
            </button>
            <div className="my-1 h-px bg-neutral-200" />
            <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-neutral-700">
              <Sun size={15} className="text-neutral-500" /><span className="flex-1">{tr('Appearance')}</span>
              <Switch<ThemeMode> label={tr('Appearance')} value={mode} onChange={setMode} options={[
                { value: 'light', label: tr('Light'), icon: <Sun /> }, { value: 'dark', label: tr('Dark'), icon: <Moon /> }, { value: 'system', label: tr('System'), icon: <Monitor /> },
              ]} />
            </div>
            <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-neutral-700">
              <Languages size={15} className="text-neutral-500" /><span className="flex-1">{tr('Language')}</span>
              <Switch<Lang> label={tr('Language')} value={lang} onChange={setLang} options={[
                { value: 'en', label: tr('English'), text: 'EN' }, { value: 'id', label: tr('Indonesia'), text: 'ID' },
              ]} />
            </div>
            <div className="my-1 h-px bg-neutral-200" />
            <button type="button" role="menuitem" onClick={() => { setOpen(false); logout(); }} className={cx(item, 'text-red-600 hover:bg-red-50')}>
              <LogOut /> {tr('Sign out')}
            </button>
          </div>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" title={collapsed ? `${user.displayName} · ${role}` : undefined}
          className={cx('flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-neutral-200/60', open && 'bg-neutral-200/60', collapsed && 'justify-center')}>
          <span className="relative flex-shrink-0">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {!user.profileComplete && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-neutral-50" title={tr('Profile incomplete')} />}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-neutral-900">{user.displayName}</span>
                <span className="block truncate text-[11px] text-neutral-500">{role}</span>
              </span>
              <ChevronsUpDown size={14} className="text-neutral-400" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
