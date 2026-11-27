"use client";

// Jira look (2026-11-27, Management & Aggregator Insight first): the Atlassian Design System's tokens — text #172B4D,
// subtle #44546F, subtlest #626F86, border #DCDFE4, brand #0C66E4, selected #E9F2FF, 3px radius, 32px controls, 14px
// text — in components with the props of the ones they replace (@/components/kc/compat, @/so/ui/Jira, @/so/ui Button /
// ErrorState, @/components/kc/Drawer, @/aggregator/fields): a page moves to it by changing its imports. Phones and the
// PWA: 44px touch targets, full-width sheets, tabs that scroll sideways.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import Floating, { usePhone } from "@/components/kc/Floating";
import { SkeletonValue } from "@/components/kc/Skeleton";
import { tr } from "@/lib/i18n";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------------------------------------------------------------- tokens (ADS)
export const J = {
  text: "text-[color:var(--j-172B4D)]", subtle: "text-[color:var(--j-44546F)]", subtlest: "text-[color:var(--j-626F86)]", border: "border-[color:var(--j-DCDFE4)]", link: "text-[color:var(--j-0C66E4)]",
  surface: "bg-white", sunken: "bg-[color:var(--j-F7F8F9)]", neutral: "bg-[color:var(--j-091E420F)]", hovered: "hover:bg-[color:var(--j-091E4224)]", selected: "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]",
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)] focus-visible:ring-offset-0",
};
/** a text field / select of the forms: 40px on phones, 32px from tablets */
export const ctl = cx("h-11 w-full rounded-[3px] border border-[color:var(--j-8590A2)] bg-white px-2 text-base text-[color:var(--j-172B4D)] placeholder:text-[color:var(--j-626F86)]",
  "transition-colors hover:bg-[color:var(--j-F7F8F9)] focus:border-[color:var(--j-388BFF)] focus:outline-none focus:ring-1 focus:ring-[color:var(--j-388BFF)] disabled:border-[color:var(--j-DCDFE4)] disabled:bg-[color:var(--j-F7F8F9)] disabled:text-[color:var(--j-8590A2)] sm:h-8 sm:text-sm");

// ---------------------------------------------------------------- page

/** Inside a tab of another page: no own header. */
export const EmbeddedPage = createContext(false);

/** The page: breadcrumbs (eyebrow), the title (24px, #172B4D) with the actions at its right, the description, then the
 *  content on the white surface of Jira. `media` is kept for the API and not drawn (Jira has no page icon). */
export function Page({ title, subtitle, actions, stats, children, eyebrow }: {
  title: ReactNode; subtitle?: string; actions?: ReactNode; stats?: ReactNode; children: ReactNode; eyebrow?: ReactNode; media?: ReactNode;
}) {
  if (useContext(EmbeddedPage)) return <div className="space-y-4">{actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}{stats}{children}</div>;
  return (
    <div className="min-h-full bg-white text-sm text-[color:var(--j-172B4D)] [font-feature-settings:'tnum'_0]">
      <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 pb-8 pt-4 sm:px-6 lg:px-10 lg:pt-6">
        <header className="space-y-1">
          {eyebrow && <nav aria-label={tr("Breadcrumbs")} className="flex flex-wrap items-center gap-1 text-sm text-[color:var(--j-44546F)]">
            {String(eyebrow).split(/\s*·\s*/).map((b, i, all) => <span key={i} className="inline-flex items-center gap-1">{b}{i < all.length - 1 && <span aria-hidden className="text-[color:var(--j-8590A2)]">/</span>}</span>)}
            <span aria-hidden className="text-[color:var(--j-8590A2)]">/</span></nav>}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 text-[24px] font-semibold leading-8 text-[color:var(--j-172B4D)]">{title}</h1>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {subtitle && <p className="max-w-3xl text-sm text-[color:var(--j-44546F)]">{subtitle}</p>}
        </header>
        {stats}
        {children}
      </div>
    </div>
  );
}

/** A bordered surface holding a toolbar and a table. */
export function Panel({ title, description, actions, toolbar, footer, children, className }: {
  title?: string; description?: string; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cx("overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-3">
          <div className="min-w-0">{title && <h2 className="text-base font-semibold text-[color:var(--j-172B4D)]">{title}</h2>}{description && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{description}</p>}</div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>)}
      {toolbar && <div className="space-y-2 px-4 pb-3">{toolbar}</div>}
      <div className={cx(!!(title || actions || toolbar) && "border-t border-[color:var(--j-DCDFE4)]")}>{children}</div>
      {footer && <div className="flex flex-col items-center justify-between gap-2 border-t border-[color:var(--j-DCDFE4)] px-4 py-2 text-xs text-[color:var(--j-626F86)] sm:flex-row">{footer}</div>}
    </section>
  );
}

const GRID = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" } as const;
/** The summary of a page as Jira's dashboard gadgets: one row of quiet tiles. */
export function StatStrip({ children, columns = 4, label, gridClassName }: { children: ReactNode; columns?: 3 | 4 | 5; label: string; gridClassName?: string }) {
  return <section aria-label={label} className={cx("grid gap-2 sm:gap-3", gridClassName ?? `grid-cols-2 ${GRID[columns]}`)}>{children}</section>;
}

/** A figure: its label (12px, subtlest), the value (20px semibold), the lines under it; a filter when clickable (the
 *  selected one in Jira blue). */
export function Stat({ label, icon, value, title, children, emphasis = false, className, valueClassName, info, onClick, active = false }: {
  label: string; icon?: ReactNode; info?: ReactNode; value: ReactNode; title?: string; children?: ReactNode; emphasis?: boolean;
  className?: string; valueClassName?: string; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--j-626F86)]">{icon && <span className="text-[color:var(--j-626F86)] [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}<span className="min-w-0 truncate">{label}</span>{info}</span>
      <span className={cx("mt-1 block text-xl font-semibold leading-7 tabular-nums text-[color:var(--j-172B4D)]", valueClassName)}>{value}</span>
      {children && <span className="mt-0.5 block space-y-0.5 text-xs text-[color:var(--j-626F86)] [&_p]:truncate">{children}</span>}
    </>
  );
  const cls = cx("block min-w-0 rounded-[3px] border px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3",
    active ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] ring-1 ring-[color:var(--j-0C66E4)]" : emphasis ? "border-[color:var(--j-85B8FF)] bg-white" : "border-[color:var(--j-DCDFE4)] bg-white",
    onClick && !active && "hover:bg-[color:var(--j-F7F8F9)]", J.focus, className);
  return onClick ? <button type="button" title={title} onClick={onClick} aria-pressed={active} className={cls}>{body}</button> : <div title={title} className={cls}>{body}</div>;
}
export const StatSkeleton = SkeletonValue;

// ---------------------------------------------------------------- buttons, lozenges, people

type Variant = "primary" | "secondary" | "subtle" | "danger" | "ghost" | "warning";
const BTN: Record<Variant, string> = {
  primary: "bg-[color:var(--j-0C66E4)] text-white hover:bg-[color:var(--j-0055CC)] active:bg-[#09326C]",
  secondary: "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)] active:bg-[color:var(--j-091E424F)]",
  subtle: "bg-transparent text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] active:bg-[color:var(--j-091E4224)]",
  ghost: "bg-transparent text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] active:bg-[color:var(--j-091E4224)]",
  danger: "bg-[color:var(--j-C9372C)] text-white hover:bg-[color:var(--j-AE2E24)]",
  warning: "bg-[color:var(--j-F5CD47)] text-[color:var(--j-172B4D)] hover:bg-[#E2B203]",
};
/** Jira's button: 32px (44px on phones), 3px radius, medium weight. */
export function Button({ variant = "primary", size = "md", className, children, loading = false, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={cx("inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] font-medium transition-colors disabled:cursor-not-allowed disabled:bg-[color:var(--j-091E4208)] disabled:text-[color:var(--j-091E424F)]",
      size === "sm" ? "h-9 px-2.5 text-[13px] sm:h-7" : "h-11 px-3 text-sm sm:h-8", BTN[variant], J.focus, className)}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}{children}</button>
  );
}

/** An icon-only button (subtle). */
export function IconButton({ label, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} {...rest} className={cx("inline-flex h-11 w-11 items-center justify-center rounded-[3px] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] sm:h-8 sm:w-8", J.focus, className)}>{children}</button>;
}

export type LozengeTone = "grey" | "blue" | "green" | "amber" | "red" | "violet" | "cyan";
const LOZ: Record<LozengeTone, string> = {
  grey: "bg-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)]", blue: "bg-[color:var(--j-CCE0FF)] text-[color:var(--j-0055CC)]", green: "bg-[color:var(--j-BAF3DB)] text-[color:var(--j-216E4E)]", amber: "bg-[color:var(--j-F8E6A0)] text-[color:var(--j-7F5F01)]",
  red: "bg-[color:var(--j-FFD5D2)] text-[color:var(--j-AE2E24)]", violet: "bg-[color:var(--j-DFD8FD)] text-[color:var(--j-5E4DB2)]", cyan: "bg-[color:var(--j-C6EDFB)] text-[color:var(--j-206A83)]",
};
/** Jira's status lozenge: 11px bold caps, 3px radius. */
export function Lozenge({ tone = "grey", children, title }: { tone?: LozengeTone; children: ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-block max-w-[14rem] truncate rounded-[3px] px-1 align-middle text-[11px] font-bold uppercase leading-4", LOZ[tone])}>{children}</span>;
}

const AVATAR = ["bg-[color:var(--j-0C66E4)]", "bg-[#1F845A]", "bg-[#6E5DC6]", "bg-[color:var(--j-C9372C)]", "bg-[#B65C02]", "bg-[#227D9B]", "bg-[#943D73]"];
export const initialsOf = (name: string) => name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const tone = AVATAR[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
  return <span className={cx("inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white", tone)} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }} aria-hidden>{initialsOf(name)}</span>;
}
export function Person({ name, sub, size = 24 }: { name: string; sub?: ReactNode; size?: number }) {
  return <span className="flex min-w-0 items-center gap-2"><Avatar name={name} size={size} /><span className="min-w-0"><span className="block truncate text-[color:var(--j-172B4D)]">{name}</span>{sub && <span className="block truncate text-xs text-[color:var(--j-626F86)]">{sub}</span>}</span></span>;
}

// ---------------------------------------------------------------- messages

/** Jira's section message (error by default) with a retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex gap-3 rounded-[3px] bg-[color:var(--j-FFECEB)] p-4 text-sm text-[color:var(--j-172B4D)]">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[color:var(--j-C9372C)]" />
      <div className="min-w-0 space-y-2"><p className="font-semibold">{tr("Something went wrong")}</p><p className="text-[color:var(--j-44546F)]">{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium text-[color:var(--j-0C66E4)] hover:underline"><RotateCcw size={13} />{tr("Try again")}</button>}</div>
    </div>
  );
}
export function SectionMessage({ tone = "info", title, children }: { tone?: "info" | "warning" | "success" | "error"; title?: string; children?: ReactNode }) {
  const bg = { info: "bg-[color:var(--j-E9F2FF)]", warning: "bg-[color:var(--j-FFF7D6)]", success: "bg-[color:var(--j-DCFFF1)]", error: "bg-[color:var(--j-FFECEB)]" }[tone];
  return <div className={cx("rounded-[3px] p-3 text-sm text-[color:var(--j-172B4D)]", bg)}>{title && <p className="font-semibold">{title}</p>}{children && <div className={cx("text-[color:var(--j-44546F)]", title && "mt-1")}>{children}</div>}</div>;
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="px-4 py-12 text-center"><p className="text-base font-semibold text-[color:var(--j-172B4D)]">{title}</p>{children && <p className="mx-auto mt-1 max-w-md text-sm text-[color:var(--j-626F86)]">{children}</p>}</div>;
}

// ---------------------------------------------------------------- tabs, quick filters, cards

export type JTab<K extends string> = { key: K; label: string; icon?: ReactNode; count?: number | null };
/** The tabs of the page (Jira's horizontal navigation: subtle text, the selected one blue with a 2px bar) over the work. */
export function WorkCard<K extends string>({ tabs, active, onTab, left, children, label }: {
  tabs: JTab<K>[]; active: K; onTab: (k: K) => void; left?: ReactNode; children: ReactNode; label?: string;
}) {
  return (
    <section className="min-w-0 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
      <div className="flex flex-wrap items-end gap-x-4 border-b-2 border-[color:var(--j-DCDFE4)] px-2 sm:px-3">
        {left && <div className="py-2">{left}</div>}
        <div role="tablist" aria-label={label} className="-mb-[2px] flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((t) => {
            const on = active === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onTab(t.key)}
                className={cx("relative inline-flex h-12 flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-medium transition-colors sm:h-10",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-t-sm", on ? "text-[color:var(--j-0C66E4)] after:bg-[color:var(--j-0C66E4)]" : "text-[color:var(--j-44546F)] hover:text-[color:var(--j-172B4D)] hover:after:bg-[color:var(--j-8590A2)]", J.focus)}>
                <span className="[&>svg]:h-4 [&>svg]:w-4">{t.icon}</span>{t.label}
                {t.count != null && <span className={cx("rounded-[2rem] px-1.5 text-xs font-semibold leading-4 tabular-nums", on ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)]")}>{t.count.toLocaleString("id-ID")}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-b border-[color:var(--j-DCDFE4)] px-3 py-3 sm:px-4">{children}</div>;
}

/** Jira's quick filters: toggle buttons, the selected one in the selected blue. */
export function QuickChips<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string; dot?: string; count?: number | null }[]; value: K; onChange: (k: K) => void; label?: string;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label={label}>
      {items.map((x) => {
        const on = value === x.key;
        return (
          <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(x.key)}
            className={cx("inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-medium transition-colors sm:h-7",
              on ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)] ring-1 ring-inset ring-[color:var(--j-0C66E4)]" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)]", J.focus)}>
            {x.dot && <span className={cx("h-2 w-2 rounded-full", x.dot)} aria-hidden />}{x.label}
            {x.count != null && <span className={cx("tabular-nums", on ? "text-[color:var(--j-0C66E4)]" : "text-[color:var(--j-626F86)]")}>{x.count.toLocaleString("id-ID")}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("space-y-4 p-3 sm:p-4", className)}>{children}</div>;
}
export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--j-DCDFE4)] px-3 py-2 text-xs text-[color:var(--j-626F86)] sm:px-4">{children}</div>;
}

// ---------------------------------------------------------------- select

export type JOption = { value: string; label: string; hint?: string; group?: string; disabled?: boolean; icon?: ReactNode };
/** Jira's single select: the field (#F7F8F9 → white when open, 2px blue focus), a popover list with a search when long,
 *  the selected option in the selected blue with a check. Phones: a bottom sheet. */
export function JSelect({ value, onChange, options, placeholder, label, className, disabled }: {
  value: string; onChange: (v: string) => void; options: JOption[]; placeholder: string; label?: string; className?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [wide, setWide] = useState(256);
  const phone = usePhone();
  const box = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); setQ(""); };
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return s ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(s)) : options; }, [options, q]);
  const groups = [...new Set(shown.map((o) => o.group ?? ""))];
  return (
    <div ref={box} className={cx("relative", className)}>
      <button type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-label={label ?? placeholder}
        onClick={() => { if (open) close(); else { setWide(Math.max(256, box.current?.offsetWidth ?? 0)); setOpen(true); } }}
        className={cx("flex h-11 w-full items-center justify-between gap-2 rounded-[3px] border px-2 text-left text-base transition-colors disabled:opacity-50 sm:h-8 sm:text-sm",
          open ? "border-[color:var(--j-388BFF)] bg-white ring-1 ring-[color:var(--j-388BFF)]" : "border-[color:var(--j-8590A2)] bg-white hover:bg-[color:var(--j-F7F8F9)]")}>
        <span className={cx("min-w-0 truncate", current ? "text-[color:var(--j-172B4D)]" : "text-[color:var(--j-626F86)]")}>{current ? current.icon ?? current.label : placeholder}</span>
        <ChevronDown size={16} className="flex-shrink-0 text-[color:var(--j-44546F)]" />
      </button>
      <Floating open={open} onClose={close} title={label ?? placeholder} anchor={box} width={wide} maxHeight={340}>
        {options.length > 8 && (
          <div className="sticky top-0 z-10 border-b border-[color:var(--j-DCDFE4)] bg-white p-2"><div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
            <input autoFocus={!phone} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search")} aria-label={tr("Search")} className={cx(ctl, "pl-7")} /></div></div>)}
        <ul role="listbox" aria-label={label ?? placeholder} className="py-1.5">
          {groups.map((g) => (
            <li key={g || "_"}>
              {g && <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase text-[color:var(--j-626F86)] sm:px-3">{g}</p>}
              <ul>{shown.filter((o) => (o.group ?? "") === g).map((o) => {
                const on = o.value === value;
                return (
                  <li key={o.value || "_none"}>
                    <button type="button" role="option" aria-selected={on} disabled={o.disabled} onClick={() => { onChange(o.value); close(); }}
                      className={cx("relative flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left text-base disabled:opacity-40 sm:min-h-8 sm:px-3 sm:py-1.5 sm:text-sm",
                        on ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-[color:var(--j-0C66E4)]" : "text-[color:var(--j-172B4D)] hover:bg-[color:var(--j-091E420F)]")}>
                      <span className="min-w-0 flex-1 break-words sm:truncate">{o.icon ?? o.label}</span>
                      {o.hint && <span className="flex-shrink-0 text-xs text-[color:var(--j-626F86)]">{o.hint}</span>}
                      {on && <Check size={16} className="flex-shrink-0" />}
                    </button>
                  </li>);
              })}</ul>
            </li>))}
          {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-[color:var(--j-626F86)]">{tr("No match")}</li>}
        </ul>
      </Floating>
    </div>
  );
}

// ---------------------------------------------------------------- drawer

const WIDTH = { sm: "sm:max-w-[400px]", md: "sm:max-w-[480px]", lg: "sm:max-w-[640px]", xl: "sm:max-w-[800px]" } as const;
/** The side panel of Jira (the issue view): white, a 1px border, the title 20px; a full screen sheet on phones. Escape and
 *  the blanket close it (not when `locked`). Same props as @/components/kc/Drawer. */
export default function Drawer({ open, title, description, onClose, children, footer, size = "md", locked = false, onBack, titleExtra, icon }: {
  open: boolean; title: string; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl";
  onBack?: () => void; titleExtra?: ReactNode; locked?: boolean; icon?: ReactNode; focusFirstField?: boolean; iconPlain?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !locked) closeRef.current(); };
    document.addEventListener("keydown", key);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => { (panel.current?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,select") ?? panel.current)?.focus(); }, 30);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = body; clearTimeout(t); prev?.focus?.(); };
  }, [open, locked]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-[color:var(--j-091E427D)]" onClick={() => !locked && onClose()} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cx("relative flex h-full w-full flex-col bg-white text-sm text-[color:var(--j-172B4D)] shadow-[0_8px_12px_#091E4226,0_0_1px_#091E424F] outline-none", WIDTH[size])}>
        <header className="flex items-start gap-2 border-b border-[color:var(--j-DCDFE4)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          {onBack && <IconButton label={tr("Back")} onClick={onBack} className="-ml-2"><ArrowLeft size={18} /></IconButton>}
          {icon && !onBack && <span className="mt-1 hidden text-[color:var(--j-44546F)] sm:block [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
          <div className="min-w-0 flex-1 pt-1.5 sm:pt-0">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold leading-6 text-[color:var(--j-172B4D)] sm:text-xl">{title}{titleExtra}</h2>
            {description && <div className="mt-0.5 text-sm text-[color:var(--j-44546F)]">{description}</div>}
          </div>
          {!locked && <IconButton label={tr("Close")} onClick={onClose} className="-mr-2"><X size={20} /></IconButton>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        {/* the actions: at the right; on phones they share the width (44px tall). A single block child (its own layout) takes the whole row. */}
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--j-DCDFE4)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 [&>div:only-child]:w-full max-sm:[&>a]:flex-1 max-sm:[&>button]:flex-1 max-sm:[&>button]:h-11">{footer}</footer>}
      </div>
    </div>
  );
}
export function DrawerSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return <section className="space-y-3 border-b border-[color:var(--j-DCDFE4)] pb-5 last:border-b-0 last:pb-0 [&:not(:first-child)]:pt-5">
    {(title || description) && <div>{title && <h3 className="text-sm font-semibold text-[color:var(--j-172B4D)]">{title}</h3>}{description && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{description}</p>}</div>}{children}</section>;
}

// ---------------------------------------------------------------- form fields (props of @/aggregator/fields)

/** Label (12px semibold subtle) above the field, the helper or the error under it. */
export function Row({ label, hint, required, error, children, className }: { label: string; hint?: ReactNode; required?: boolean; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="mb-1 text-xs font-semibold text-[color:var(--j-44546F)]">{label}{required && <span className="ml-0.5 text-[color:var(--j-C9372C)]" aria-hidden>*</span>}</p>
      {children}
      {error ? <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--j-AE2E24)]"><AlertTriangle size={12} />{error}</p> : hint ? <p className="mt-1 text-xs text-[color:var(--j-626F86)]">{hint}</p> : null}
    </div>
  );
}
export function Group({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return <DrawerSection title={title} description={typeof note === "string" ? note : undefined}>{typeof note !== "string" && note}{children}</DrawerSection>;
}
/** The details of Jira's issue view: label on the left (subtle), value on the right. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-[color:var(--j-44546F)]">{k}</dt><dd className="min-w-0 break-words text-[color:var(--j-172B4D)]">{v}</dd></div>)}
    </dl>
  );
}
export { DateField, PeriodField, TimeField } from "@/aggregator/fields";

/** a breadcrumb chevron for inline paths */
export const Crumb = () => <ChevronRight size={14} className="text-[color:var(--j-8590A2)]" aria-hidden />;

/** Jira's search field: a magnifier inside, clear button when filled. */
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? tr("Search")} aria-label={placeholder ?? tr("Search")}
        className={cx(ctl, "pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden")} />
      {value && <button type="button" onClick={() => onChange("")} aria-label={tr("Clear")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[3px] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] sm:h-6 sm:w-6"><X size={14} /></button>}
    </div>
  );
}

// Jira's list (the issue navigator): header 12px semibold subtle with a 2px rule, rows with a 1px rule, hover #F7F8F9
export const jTable = "w-full border-collapse text-sm text-[color:var(--j-172B4D)]";
export const jHeadRow = "text-left text-xs font-semibold text-[color:var(--j-44546F)]";
export const jTh = "h-9 px-2 font-semibold first:pl-4 last:pr-4";
export const jRow = "group cursor-pointer border-b border-[color:var(--j-DCDFE4)] hover:bg-[color:var(--j-F7F8F9)]";
export const jTd = "px-2 py-2 align-middle first:pl-4 last:pr-4";
export const jKey = "font-medium text-[color:var(--j-0C66E4)] group-hover:underline";
