"use client";

// Building blocks with the integrated_portal look (buttons, fields, badges, page header band, empty/error
// states, toasts). Drawers, menus, stat strips and filters live next to this file.

import { NativeSelect } from "@/so/ui/Jira";
import { tc } from '@/lib/title-case';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox, Loader2, Search, X } from "lucide-react";
import { Children, createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { locale, tr } from "@/lib/i18n";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// 16px text on phones: iOS zooms into a field with smaller text
export const inputClass =
  "h-11 w-full rounded-[3px] px-3 text-base lg:h-10 lg:text-sm " +
  "border-2 border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] text-[color:var(--j-172B4D)] placeholder:text-[color:var(--j-626F86)] transition-colors hover:bg-[color:var(--j-091E420F)] focus:border-[color:var(--j-388BFF)] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-[color:var(--j-091E4208)] disabled:text-[color:var(--j-091E424F)]";

/** A search field (2026-11-16, the kopicalf-hrms look): white with a border; the grey inputClass stays for the forms. */
export const searchClass =
  "h-11 w-full rounded-[3px] border-2 border-[color:var(--j-DCDFE4)] bg-white px-3 text-base text-[color:var(--j-172B4D)] placeholder:text-[color:var(--j-626F86)] " +
  "transition-colors hover:border-[color:var(--j-8590A2)] focus:border-[color:var(--j-388BFF)] focus:outline-none lg:h-10 lg:text-xs";


// 2026-11-28 the Jira buttons (same as src/jira): flat, 3px, no shadow
const BUTTON = {
  primary: "bg-[color:var(--j-0C66E4)] font-medium text-white hover:bg-[color:var(--j-0055CC)]",
  secondary: "bg-[color:var(--j-091E420F)] font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)] active:bg-[color:var(--j-091E424F)]",
  danger: "bg-[color:var(--j-C9372C)] font-medium text-white hover:bg-[color:var(--j-AE2E24)]",
  ghost: "font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)] disabled:cursor-not-allowed disabled:bg-[color:var(--j-091E4208)] disabled:text-[color:var(--j-091E424F)]",
        size === "sm" ? "h-9 px-2.5 text-[13px] sm:h-7" : "h-11 px-3 text-sm sm:h-8",
        BUTTON[variant],
        className,
      )}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {Children.map(children, (c) => tc(c))}
    </button>
  );
}

export function Field({ label, hint, error, required, children, className }: {
  label: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-[color:var(--j-44546F)]">
        {tc(label)}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-[color:var(--j-626F86)]">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputClass, className)} />;
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // the Jira dropdown (2026-11-18); callers read e.target.value only
  const { value, onChange, children, disabled } = p;
  return <NativeSelect value={value} disabled={disabled} aria-label={p["aria-label"]} className={className}
    onChange={onChange as unknown as (e: { target: { value: string } }) => void}>{children}</NativeSelect>;
}

export function Checkbox({ label, hint, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-[color:var(--j-172B4D)]">
      <input type="checkbox" {...p} className="mt-0.5 h-4 w-4 rounded border-[color:var(--j-8590A2)] accent-[color:var(--j-0C66E4)]" />
      <span>
        {label}
        {hint && <span className="block text-xs text-[color:var(--j-626F86)]">{hint}</span>}
      </span>
    </label>
  );
}

// 2026-11-28 the Jira lozenges (same as src/jira Lozenge)
const TONES = {
  slate: "bg-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)]",
  green: "bg-[color:var(--j-BAF3DB)] text-[color:var(--j-216E4E)]",
  amber: "bg-[color:var(--j-F8E6A0)] text-[color:var(--j-7F5F01)]",
  red: "bg-[color:var(--j-FFD5D2)] text-[color:var(--j-AE2E24)]",
  blue: "bg-[color:var(--j-CCE0FF)] text-[color:var(--j-0055CC)]",
  violet: "bg-[color:var(--j-DFD8FD)] text-[color:var(--j-5E4DB2)]",
  cyan: "bg-[color:var(--j-C6EDFB)] text-[color:var(--j-206A83)]",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", dot, icon, title, wrap, children }: {
  tone?: Tone; dot?: boolean; icon?: ReactNode; title?: string; /** long text may break onto a second line (phones) */ wrap?: boolean; children: ReactNode;
}) {
  return (
    <span title={title} className={cx("inline-flex max-w-full items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold uppercase leading-4 tracking-wide", wrap ? "whitespace-normal" : "whitespace-nowrap", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {icon}
      {children}
    </span>
  );
}

// the page frame and the cards of the new design (after kopicalf-hrms): every form and monitor shares them
export { Page, Panel } from "@/components/kc/compat";

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={`${searchClass} pl-9 pr-9`} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={tr("Clear Search")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Table header row style shared by every list. */
// the kopicalf-hrms table head (2026-11-16): grey with rounded ends, sentence-case labels in Title Case
// Jira-like (2026-11-18): small grey caps over a double rule
export const theadClass = "border-b-2 border-[color:var(--j-DCDFE4)] bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]";

export { SkeletonRows } from "@/components/kc/Skeleton";

export function Empty({ icon, title, children }: { icon?: ReactNode; title?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="mb-2 text-[color:var(--j-8590A2)]">{icon ?? <Inbox size={28} />}</span>
      {title && <p className="text-sm font-medium text-[color:var(--j-44546F)]">{tc(title)}</p>}
      {children && <p className="mt-1 max-w-md text-sm text-[color:var(--j-626F86)]">{children}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <AlertCircle className="text-red-500" />
      <p className="text-sm text-[color:var(--j-44546F)]">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>{tr("Try Again")}</Button>}
    </div>
  );
}

/* ------------------------------------------------------------------ pages of 50 rows (client side) */

export const PAGE_SIZE = 50;

/** The rows of the current page; back to page 1 whenever `reset` changes (search, filters, sort). */
export function usePaged<T>(rows: T[], reset: unknown, size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [reset]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const pageRows = useMemo(() => rows.slice((current - 1) * size, current * size), [rows, current, size]);
  return { page: current, pages, setPage, rows: pageRows, total: rows.length, size };
}

/** "51–100 of 312 ‹ 2 / 7 ›" in a panel footer; nothing when everything fits on one page. */
/** The one pager of the portal (2026-11-28, the Jira look): range, first / previous / n of N / next / last. */
export function PageNav({ paged }: { paged: { page: number; pages: number; total: number; size: number; setPage: (p: number) => void } }) {
  const { page, pages, total, size, setPage } = paged;
  if (pages <= 1) return null;
  return <Pager page={page} pages={pages} total={total} size={size} onPage={setPage} />;
}

export function Pager({ page, pages, total, size, onPage, className }: { page: number; pages: number; total?: number; size?: number; onPage: (p: number) => void; className?: string }) {
  if (pages <= 1) return null;
  const nav = (label: string, to: number, off: boolean, icon: ReactNode) => (
    <button type="button" aria-label={label} title={label} disabled={off} onClick={() => onPage(to)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)] disabled:cursor-not-allowed disabled:text-[color:var(--j-091E424F)] disabled:hover:bg-transparent sm:h-8 sm:w-8">{icon}</button>);
  return (
    <div className={cx("flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-[color:var(--j-626F86)]", className)}>
      {total != null && size != null && <span className="whitespace-nowrap tabular-nums">{tr("{0}–{1} of {2}", fmtNumber((page - 1) * size + 1), fmtNumber(Math.min(page * size, total)), fmtNumber(total))}</span>}
      <span className="inline-flex items-center">
        {nav(tr("First page"), 1, page <= 1, <ChevronsLeft size={16} />)}
        {nav(tr("Previous Page"), page - 1, page <= 1, <ChevronLeft size={16} />)}
        <span className="px-1.5 font-medium tabular-nums text-[color:var(--j-172B4D)]">{page} / {pages}</span>
        {nav(tr("Next Page"), page + 1, page >= pages, <ChevronRight size={16} />)}
        {nav(tr("Last page"), pages, page >= pages, <ChevronsRight size={16} />)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts (portal: top centre) */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[90] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={cx("notice-in pointer-events-auto flex max-w-full items-center gap-2 rounded-[3px] px-4 py-3 text-sm font-medium text-white shadow-lg",
              t.tone === "ok" ? "bg-neutral-900" : "bg-red-600")}>
            {t.tone === "ok" ? <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-400" /> : <AlertCircle size={16} className="flex-shrink-0" />}
            <span className="min-w-0">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label={tr("Dismiss")}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ formatting */

/** Date and time in WIB (stock opname runs on WIB everywhere, see so/lib/wib.ts). */
export const fmtDate = (v: string | null | undefined) =>
  v ? `${new Date(v).toLocaleString(locale(), { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} WIB` : "—";

export const fmtDay = (v: string | null | undefined) =>
  v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00+07:00` : v).toLocaleDateString(locale(), { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtNumber = (n: number | string) => Number(n).toLocaleString(locale());
