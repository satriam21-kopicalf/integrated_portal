"use client";

// Building blocks with the integrated_portal look (buttons, fields, badges, page header band, empty/error
// states, toasts). Drawers, menus, stat strips and filters live next to this file.

import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { locale, tr } from "@/lib/i18n";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500";

const BUTTON = {
  primary: "bg-blue-700 font-semibold text-white hover:bg-blue-800",
  secondary: "border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50",
  danger: "bg-red-600 font-semibold text-white hover:bg-red-700",
  ghost: "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
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
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4",
        BUTTON[variant],
        className,
      )}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required, children, className }: {
  label: string; hint?: string; error?: string | null; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputClass, className)} />;
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputClass, "pr-8", className)} />;
}

export function Checkbox({ label, hint, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-slate-700">
      <input type="checkbox" {...p} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500" />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", dot, icon, title, wrap, children }: {
  tone?: Tone; dot?: boolean; icon?: ReactNode; title?: string; /** long text may break onto a second line (phones) */ wrap?: boolean; children: ReactNode;
}) {
  return (
    <span title={title} className={cx("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", wrap ? "whitespace-normal" : "whitespace-nowrap", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {icon}
      {children}
    </span>
  );
}

/** Page header band (white, under the app bar) like the portal pages; `stats` sits right under it. */
export function Page({ title, subtitle, actions, stats, children }: {
  /** text, or e.g. a brand logo (with its alt text) */ title: ReactNode; subtitle?: string; actions?: ReactNode; stats?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 sm:truncate sm:text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      {/* the summary sits in the content, with its margins, like Sales Transactions */}
      <div className="space-y-4 p-4 sm:p-6">{stats}{children}</div>
    </div>
  );
}

/** White card holding a toolbar and a table (portal list pages). */
export function Panel({ title, description, actions, toolbar, footer, children, className }: {
  title?: string; description?: string; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cx("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">{toolbar}</div>}
      {children}
      {footer && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={`${inputClass} pl-9 pr-9`} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={tr("Clear search")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Table header row style shared by every list. */
export const theadClass = "border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}><td colSpan={cols} className="px-4 py-3"><div className="skeleton h-9 rounded" /></td></tr>
      ))}
    </>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400" role="status">
      <Loader2 size={18} className="animate-spin text-blue-600" /> {label ?? tr("Loading…")}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="mb-2 text-slate-300">{icon ?? <Inbox size={28} />}</span>
      {title && <p className="text-sm font-medium text-slate-700">{title}</p>}
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <AlertCircle className="text-red-500" />
      <p className="text-sm text-slate-700">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>{tr("Try again")}</Button>}
    </div>
  );
}

/** "12 users · Page 1 of 3 ‹ ›" footer of a client-side paged list. */
export function Pager({ total, page, pageSize, onPage, noun }: {
  total: number; page: number; pageSize: number; onPage: (p: number) => void; noun: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <span>{fmtNumber(total)} {noun}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" className="px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tr("Previous page")}>
          <ChevronLeft size={16} />
        </Button>
        <span>{tr("Page {0} of {1}", page, pages)}</span>
        <Button variant="secondary" size="sm" className="px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={tr("Next page")}>
          <ChevronRight size={16} />
        </Button>
      </div>
    </>
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
export function PageNav({ paged }: { paged: { page: number; pages: number; total: number; size: number; setPage: (p: number) => void } }) {
  const { page, pages, total, size, setPage } = paged;
  if (pages <= 1) return null;
  const first = (page - 1) * size + 1;
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">{tr("{0}–{1} of {2}", fmtNumber(first), fmtNumber(Math.min(page * size, total)), fmtNumber(total))}</span>
      <Button variant="secondary" size="sm" className="px-2" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={tr("Previous page")}>
        <ChevronLeft size={16} />
      </Button>
      <span className="tabular-nums">{page} / {pages}</span>
      <Button variant="secondary" size="sm" className="px-2" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={tr("Next page")}>
        <ChevronRight size={16} />
      </Button>
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
            className={cx("notice-in pointer-events-auto flex max-w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg",
              t.tone === "ok" ? "bg-slate-900" : "bg-red-600")}>
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

/** "Okta Fajri" -> "OF" */
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
