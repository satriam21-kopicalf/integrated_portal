"use client";

// The props of @/components/kc in the Jira look (2026-11-27, Management first): User Accounts and Activity Logs move to it
// by changing their import; the rest of the portal keeps @/components/kc.

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { tr } from "@/lib/i18n";
import { cx } from "./index";

export { cx };

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-full bg-white text-sm text-[#172B4D]">
      <div className={cx("mx-auto w-full max-w-[1440px] space-y-5 px-4 pb-8 pt-4 sm:px-6 lg:px-10 lg:pt-6", className)}>{children}</div>
    </div>
  );
}

/** Breadcrumbs (eyebrow), the title 24px with the actions at its right, the description. `media` is not drawn (Jira). */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; media?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="space-y-1">
      {eyebrow && <nav aria-label={tr("Breadcrumbs")} className="flex items-center gap-1 text-sm text-[#44546F]">{eyebrow}<span aria-hidden className="text-[#8590A2]">/</span></nav>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-[24px] font-semibold leading-8 text-[#172B4D]">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="max-w-3xl text-sm text-[#44546F]">{subtitle}</p>}
    </header>
  );
}

type BtnTone = "solid" | "subtle" | "outline" | "ghost" | "danger";
const BTN: Record<BtnTone, string> = {
  solid: "bg-[#0C66E4] text-white hover:bg-[#0055CC]",
  subtle: "bg-[#091E420F] text-[#44546F] hover:bg-[#091E4224]",
  outline: "bg-[#091E420F] text-[#44546F] hover:bg-[#091E4224]",
  ghost: "text-[#44546F] hover:bg-[#091E420F]",
  danger: "bg-[#C9372C] text-white hover:bg-[#AE2E24]",
};
/** Jira's button classes (for <button>, <a>, <Link>): 32px (40px on phones), 3px radius. */
export const btn = (tone: BtnTone = "outline", size: "sm" | "md" = "md") => cx(
  "inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]",
  size === "sm" ? "h-9 px-2.5 text-[13px] sm:h-7" : "h-10 px-3 text-sm sm:h-8", BTN[tone]);

export function IconButton({ label, onClick, children, active }: { label: string; onClick?: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={cx("inline-flex h-10 w-10 items-center justify-center rounded-[3px] transition-colors sm:h-8 sm:w-8", active ? "bg-[#E9F2FF] text-[#0C66E4]" : "text-[#44546F] hover:bg-[#091E420F]")}>{children}</button>
  );
}

export function Card({ title, subtitle, actions, toolbar, footer, children, className, flush }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children?: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={cx("overflow-hidden rounded-[3px] border border-[#DCDFE4] bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0">{title && <h2 className="text-base font-semibold text-[#172B4D]">{title}</h2>}{subtitle && <p className="mt-0.5 text-xs text-[#626F86]">{subtitle}</p>}</div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>)}
      {toolbar && <div className={cx("px-4 pb-3", !(title || actions) && "pt-3")}>{toolbar}</div>}
      <div className={cx(!flush && "px-4 pb-4", !flush && !(title || actions || toolbar) && "pt-4", flush && !!(title || actions || toolbar) && "border-t border-[#DCDFE4]")}>{children}</div>
      {footer && <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#DCDFE4] px-4 py-2 text-xs text-[#626F86] sm:flex-row">{footer}</footer>}
    </section>
  );
}

const COLS = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" } as const;
export function StatGrid({ children, cols = 4, label }: { children: ReactNode; cols?: keyof typeof COLS; label?: string }) {
  return <div role="group" aria-label={label} className={cx("grid grid-cols-2 gap-2 sm:gap-3", COLS[cols])}>{children}</div>;
}

const VALUE = { default: "text-[#172B4D]", good: "text-[#172B4D]", warn: "text-[#7F5F01]", bad: "text-[#AE2E24]", brand: "text-[#172B4D]" } as const;
export type StatTone = keyof typeof VALUE;
export function StatCard({ label, value, sub, icon, tone = "default", onClick, active }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: StatTone; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#626F86]">{icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}<span className="min-w-0 truncate">{label}</span></span>
      <span className={cx("mt-1 block truncate text-xl font-semibold leading-7 tabular-nums", VALUE[tone])}>{value}</span>
      {sub && <span className="mt-0.5 block truncate text-xs text-[#626F86]">{sub}</span>}
    </>
  );
  const cls = cx("block min-w-0 rounded-[3px] border px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3",
    active ? "border-[#0C66E4] bg-[#E9F2FF] ring-1 ring-[#0C66E4]" : tone === "bad" ? "border-[#FD9891] bg-white" : tone === "warn" ? "border-[#F5CD47] bg-white" : "border-[#DCDFE4] bg-white",
    onClick && !active && "hover:bg-[#F7F8F9]");
  return onClick ? <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}
export const ValueSkeleton = () => <span className="skeleton inline-block h-6 w-16 rounded-[3px] align-middle" aria-hidden />;

export type TabItem = { key: string; label: ReactNode; count?: ReactNode; title?: string };
/** Jira's tabs: subtle text, the selected one blue with a 2px bar; the chosen one kept in sight on phones. */
export function Tabs({ tabs, value, onChange, label, className }: { tabs: TabItem[]; value: string; onChange: (k: string) => void; label: string; className?: string; variant?: "line" | "card" }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const box = bar.current;
    if (el && box && box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [value]);
  return (
    <div ref={bar} role="tablist" aria-label={label} className={cx("flex overflow-x-auto border-b-2 border-[#DCDFE4] [scrollbar-width:none]", className)}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} title={t.title} onClick={() => onChange(t.key)}
            className={cx("relative -mb-[2px] inline-flex h-11 flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-medium transition-colors sm:h-10",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px]", on ? "text-[#0C66E4] after:bg-[#0C66E4]" : "text-[#44546F] hover:text-[#172B4D] hover:after:bg-[#8590A2]")}>
            {t.label}
            {t.count !== undefined && t.count !== null && <span className={cx("rounded-[2rem] px-1.5 text-xs font-semibold tabular-nums", on ? "bg-[#E9F2FF] text-[#0C66E4]" : "bg-[#091E420F] text-[#44546F]")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-56 sm:max-w-md">
      <Search size={16} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#626F86]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder}
        className="h-10 w-full rounded-[3px] border border-[#8590A2] bg-white pl-8 pr-8 text-sm text-[#172B4D] placeholder:text-[#626F86] hover:bg-[#F7F8F9] focus:border-[#388BFF] focus:outline-none focus:ring-1 focus:ring-[#388BFF] sm:h-8" />
      {value && <button type="button" onClick={() => onChange("")} aria-label={tr("Clear Search")} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[3px] text-[#44546F] hover:bg-[#091E420F] sm:h-6 sm:w-6"><X size={14} /></button>}
    </div>
  );
}

export function Toolbar({ search, children, chips }: { search?: ReactNode; children?: ReactNode; chips?: ReactNode }) {
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2">{search}{children}</div>{chips}</div>;
}

const PILL = {
  gray: "bg-[#DCDFE4] text-[#44546F]", brand: "bg-[#CCE0FF] text-[#0055CC]", green: "bg-[#BAF3DB] text-[#216E4E]", amber: "bg-[#F8E6A0] text-[#7F5F01]",
  red: "bg-[#FFD5D2] text-[#AE2E24]", violet: "bg-[#DFD8FD] text-[#5E4DB2]", teal: "bg-[#C6EDFB] text-[#206A83]",
} as const;
export type PillTone = keyof typeof PILL;
/** Jira's lozenge with the props of the Pill. */
export function Pill({ tone = "gray", icon, dot, children, title, className }: { tone?: PillTone; icon?: ReactNode; dot?: boolean; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cx("inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-[3px] px-1 text-[11px] font-bold uppercase leading-4", PILL[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />}{icon}{children}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {icon && <span className="mb-3 text-[#626F86] [&>svg]:h-8 [&>svg]:w-8">{icon}</span>}
      <p className="text-base font-semibold text-[#172B4D]">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-[#626F86]">{children}</div>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-4 flex gap-3 rounded-[3px] bg-[#FFECEB] p-4 text-sm text-[#172B4D]">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#C9372C]" />
      <div className="space-y-2"><p>{message}</p>{onRetry && <button type="button" className={btn("subtle", "sm")} onClick={onRetry}>{tr("Try Again")}</button>}</div>
    </div>
  );
}

/** Jira's list: a 2px rule under the head, 1px between rows, hover #F7F8F9. */
export const kcTable = {
  table: "w-full text-sm text-[#172B4D]",
  thead: "border-b-2 border-[#DCDFE4] text-left text-xs font-semibold text-[#44546F]",
  th: "whitespace-nowrap px-3 py-2 font-semibold",
  tbody: "divide-y divide-[#DCDFE4]",
  row: "group transition-colors hover:bg-[#F7F8F9]",
  td: "px-3 py-2.5 align-middle text-[#172B4D]",
};

// the button and field classes of @/components/ui/Dialog in the Jira look
export const buttonPrimary = btn("solid");
export const buttonSecondary = btn("subtle");
export const buttonDanger = btn("danger");
export const inputClass = "h-10 w-full rounded-[3px] border border-[#8590A2] bg-white px-2 text-sm text-[#172B4D] placeholder:text-[#626F86] hover:bg-[#F7F8F9] focus:border-[#388BFF] focus:outline-none focus:ring-1 focus:ring-[#388BFF] disabled:border-[#DCDFE4] disabled:bg-[#F7F8F9] sm:h-8";
