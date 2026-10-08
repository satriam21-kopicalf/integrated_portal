'use client';

import { useEffect, useState } from 'react';
import { DrawerSection } from '@/components/ui/Drawer';
import { Field, inputClass } from '@/components/ui/Dialog';
import { AuthUser, Gender, GENDER_LABELS } from '@/lib/auth';
import { tr } from '@/lib/i18n';

/**
 * Identity fields of an account, shared by "My profile" (the user fills them in
 * themself, PATCH /api/auth/me) and the superadmin's Edit user drawer.
 * Limits mirror the backend (integrated_portal_be/app/profile.py).
 */
export interface ProfileValues {
  fullName: string;
  employeeNumber: string;
  gender: Gender | '';
  birthDate: string;
  phoneNumber: string;
  address: string;
  city: string;
  jobTitle: string;
  department: string;
  workBranchCode: string;
}

export const PROFILE_KEYS = [
  'fullName', 'employeeNumber', 'gender', 'birthDate', 'phoneNumber', 'address', 'city', 'jobTitle', 'department', 'workBranchCode',
] as const satisfies readonly (keyof ProfileValues)[];

/** needed for a complete profile (same as the backend's REQUIRED_FOR_COMPLETE) */
export const REQUIRED_PROFILE_KEYS = ['fullName', 'phoneNumber', 'jobTitle', 'department'] as const;

export function profileValues(user: AuthUser | null): ProfileValues {
  return {
    fullName: user?.fullName ?? '',
    employeeNumber: user?.employeeNumber ?? '',
    gender: user?.gender ?? '',
    birthDate: user?.birthDate ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    address: user?.address ?? '',
    city: user?.city ?? '',
    jobTitle: user?.jobTitle ?? '',
    department: user?.department ?? '',
    workBranchCode: user?.workBranchCode ?? '',
  };
}

export function sameProfile(a: ProfileValues, b: ProfileValues): boolean {
  return PROFILE_KEYS.every(k => a[k].trim() === b[k].trim());
}

export interface Branch {
  code: string;
  name: string;
}

let branchesRequest: Promise<Branch[]> | null = null;

/** Outlets / offices for the work location select (loaded once per page load). */
export function useBranches(): Branch[] {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => {
    branchesRequest ??= fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then((rows: { branch_code: string; branch_name: string | null }[]) => {
        const byCode = new Map<string, Branch>();
        for (const r of rows) {
          if (r.branch_code && !byCode.has(r.branch_code)) byCode.set(r.branch_code, { code: r.branch_code, name: r.branch_name || r.branch_code });
        }
        return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
      })
      .catch(() => {
        branchesRequest = null; // try again next time
        return [];
      });
    let cancelled = false;
    branchesRequest.then(list => { if (!cancelled) setBranches(list); });
    return () => { cancelled = true; };
  }, []);
  return branches;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProfileFields({
  values, onChange, fieldError, idPrefix = 'p', markRequired = true, currentBranchName,
}: {
  values: ProfileValues;
  onChange: <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => void;
  fieldError: (name: string) => string | null;
  idPrefix?: string;
  /** show * on the fields a complete profile needs */
  markRequired?: boolean;
  /** name of the saved work location, shown if it is no longer in the branch list */
  currentBranchName?: string | null;
}) {
  const branches = useBranches();
  const id = (name: string) => `${idPrefix}-${name}`;
  const required = (key: string) => markRequired && (REQUIRED_PROFILE_KEYS as readonly string[]).includes(key);
  const savedBranchMissing = values.workBranchCode && !branches.some(b => b.code === values.workBranchCode);

  return (
    <>
      <DrawerSection title={tr('Personal information')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr('Full name')} htmlFor={id('name')} required={required('fullName')} error={fieldError('fullName')} className="sm:col-span-2">
            <input id={id('name')} className={inputClass} value={values.fullName} onChange={e => onChange('fullName', e.target.value)}
              maxLength={120} autoComplete="name" placeholder={tr('As on your ID card')} />
          </Field>
          <Field label={tr('Gender')} htmlFor={id('gender')} error={fieldError('gender')}>
            <select id={id('gender')} className={inputClass} value={values.gender} onChange={e => onChange('gender', e.target.value as Gender | '')}>
              <option value="">{tr('Not specified')}</option>
              {(Object.keys(GENDER_LABELS) as Gender[]).map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
            </select>
          </Field>
          <Field label={tr('Date of birth')} htmlFor={id('birth')} error={fieldError('birthDate')}>
            <input id={id('birth')} type="date" className={inputClass} value={values.birthDate} onChange={e => onChange('birthDate', e.target.value)}
              min="1900-01-01" max={today()} autoComplete="bday" />
          </Field>
          <Field label={tr('Phone number')} htmlFor={id('phone')} required={required('phoneNumber')} error={fieldError('phoneNumber')} className="sm:col-span-2"
            hint={tr('Digits, spaces, + ( ) and - only')}>
            <input id={id('phone')} type="tel" inputMode="tel" className={inputClass} value={values.phoneNumber} onChange={e => onChange('phoneNumber', e.target.value)}
              maxLength={32} autoComplete="tel" placeholder="0812 3456 7890" />
          </Field>
          <Field label={tr('Address')} htmlFor={id('address')} error={fieldError('address')} className="sm:col-span-2">
            <textarea id={id('address')} rows={2} className={`${inputClass} h-auto py-2`} value={values.address} onChange={e => onChange('address', e.target.value)}
              maxLength={300} autoComplete="street-address" />
          </Field>
          <Field label={tr('City')} htmlFor={id('city')} error={fieldError('city')} className="sm:col-span-2">
            <input id={id('city')} className={inputClass} value={values.city} onChange={e => onChange('city', e.target.value)} maxLength={80} autoComplete="address-level2" />
          </Field>
        </div>
      </DrawerSection>

      <DrawerSection title={tr('Work information')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr('Employee number')} htmlFor={id('employee')} error={fieldError('employeeNumber')} hint={tr('Letters, numbers, . / -')}>
            <input id={id('employee')} className={inputClass} value={values.employeeNumber} onChange={e => onChange('employeeNumber', e.target.value)}
              maxLength={32} autoCapitalize="characters" spellCheck={false} />
          </Field>
          <Field label={tr('Job title')} htmlFor={id('job')} required={required('jobTitle')} error={fieldError('jobTitle')}>
            <input id={id('job')} className={inputClass} value={values.jobTitle} onChange={e => onChange('jobTitle', e.target.value)} maxLength={80}
              autoComplete="organization-title" />
          </Field>
          <Field label={tr('Department')} htmlFor={id('dept')} required={required('department')} error={fieldError('department')}>
            <input id={id('dept')} className={inputClass} value={values.department} onChange={e => onChange('department', e.target.value)} maxLength={80} />
          </Field>
          <Field label={tr('Work location')} htmlFor={id('branch')} error={fieldError('workBranchCode')}>
            <select id={id('branch')} className={inputClass} value={values.workBranchCode} onChange={e => onChange('workBranchCode', e.target.value)}>
              <option value="">{tr('Not specified')}</option>
              {savedBranchMissing && <option value={values.workBranchCode}>{currentBranchName || values.workBranchCode}</option>}
              {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </Field>
        </div>
      </DrawerSection>
    </>
  );
}
