"use client";

// The Jira-like monitoring look (2026-11-18, first on Monitoring Maintenance & Procurement): one card per page with its
// tabs on top (an optional switch on the left, the sections on the right), a toolbar band, then a dense issue table
// (uppercase grey headers, thin row rules, a blue key, lozenges for states, initials avatars). Shared by every
// Monitoring page so they read as one system.

import { Check, ChevronDown, Search } from "lucide-react";
import { Children, isValidElement, useMemo, useRef, useState } from "react";
import Floating, { usePhone } from "@/components/kc/Floating";
import { cx } from "@/so/ui";
import { tr } from "@/lib/i18n";

export type JOption = { value: string; label: string; hint?: string; group?: string; disabled?: boolean;
  /** a logo shown instead of the label */ icon?: React.ReactNode };

type SelectChange = { target: { value: string }; currentTarget: { value: string } };
const textOf = (n: React.ReactNode): string =>
  n == null || typeof n === "boolean" ? "" : typeof n === "string" || typeof n === "number" ? String(n)
    : Array.isArray(n) ? n.map(textOf).join("") : isValidElement(n) ? textOf((n.props as { children?: React.ReactNode }).children) : "";
function optionsOf(children: React.ReactNode, group?: string): JOption[] {
  const out: JOption[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: React.ReactNode; label?: string; disabled?: boolean };
    if (c.type === "option") out.push({ value: String(p.value ?? textOf(p.children)), label: textOf(p.children), group, disabled: p.disabled });
    else if (c.type === "optgroup") out.push(...optionsOf(p.children, p.label));
    else if (p.children) out.push(...optionsOf(p.children, group));
  });
  return out;
}
const WIDTH = /^(?:[a-z0-9]+:)?(?:w-|min-w-|max-w-|flex-1|flex-none|basis-|col-span-|self-|ml-auto|justify-self-)/;

/** A drop-in for a native <select> (2026-11-18): the same value / onChange (e.target.value) and <option> / <optgroup>
 *  children, shown as the Jira dropdown with a search box. The first option with an empty value is the placeholder. */
export function NativeSelect({ value, onChange, children, className, disabled, ...rest }: {
  value?: string | number | readonly string[]; onChange?: (e: SelectChange) => void; children?: React.ReactNode; className?: string; disabled?: boolean;
  "aria-label"?: string; id?: string; required?: boolean; name?: string; title?: string;
}) {
  const opts = optionsOf(children);
  const empty = opts.find((o) => o.value === "");
  const v = value == null ? "" : String(value);
  const width = (className ?? "").split(/\s+/).filter((c) => WIDTH.test(c)).join(" ");
  return (
    <JSelect value={v} disabled={disabled} label={rest["aria-label"] ?? rest.title} className={cx("min-w-[8rem]", width)}
      placeholder={empty?.label || tr("Choose")} options={opts}
      onChange={(nv) => onChange?.({ target: { value: nv }, currentTarget: { value: nv } })} />
  );
}

/** A Jira dropdown (2026-11-18): a flat trigger, a popover with a search box, options grouped under small caps, the
 *  chosen one marked by a blue bar and a check. Replaces the native select on the Monitoring pages. */
/** A list field. Phones and the PWA: a bottom sheet with its name and rows big enough to tap; else a list under the field. */
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
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const groups = [...new Set(shown.map((o) => o.group ?? ""))];
  const pick = (v: string) => { onChange(v); close(); };
  const search = options.length > 8 && (
    <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white p-2">
      <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input autoFocus={!phone} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search")} aria-label={tr("Search")}
          className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-base outline-none focus:border-brand-500 sm:h-8 sm:rounded-[4px] sm:text-sm" /></div>
    </div>
  );
  const list = (
    <ul role="listbox" aria-label={label ?? placeholder} className="py-1">
      {groups.map((g) => (
        <li key={g || "_"}>
          {g && <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 sm:px-3">{g}</p>}
          <ul>
            {shown.filter((o) => (o.group ?? "") === g).map((o) => (
              <li key={o.value || "_none"}>
                <button type="button" role="option" aria-selected={o.value === value} disabled={o.disabled} onClick={() => pick(o.value)}
                  className={cx("flex min-h-12 w-full items-center gap-2 border-l-2 px-4 py-2 text-left text-[15px] disabled:opacity-40 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm",
                    o.value === value ? "border-brand-700 bg-brand-50 font-medium text-brand-800" : "border-transparent text-neutral-700 hover:bg-neutral-100")}>
                  <span className="min-w-0 flex-1 break-words sm:truncate">{o.icon ?? o.label}</span>
                  {o.hint && <span className="flex-shrink-0 text-xs text-neutral-400 sm:text-[11px]">{o.hint}</span>}
                  {o.value === value && <Check size={16} className="flex-shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
      {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("No match")}</li>}
    </ul>
  );
  return (
    <div ref={box} className={cx("relative", className)}>
      <button type="button" disabled={disabled} onClick={() => { if (open) close(); else { setWide(Math.max(256, box.current?.offsetWidth ?? 0)); setOpen(true); } }} aria-expanded={open} aria-haspopup="listbox" aria-label={label ?? placeholder}
        className={cx("flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-left text-[15px] transition-colors hover:bg-neutral-50 disabled:opacity-50 sm:h-9 sm:rounded-[4px] sm:bg-neutral-50 sm:px-2.5 sm:text-sm sm:hover:bg-neutral-100",
          open && "border-brand-500 ring-2 ring-brand-500/20")}>
        <span className={cx("min-w-0 truncate", !current && "text-neutral-500")}>{current ? current.icon ?? current.label : placeholder}</span>
        <ChevronDown size={15} className={cx("flex-shrink-0 text-neutral-400 transition", open && "rotate-180")} />
      </button>
      <Floating open={open} onClose={close} title={label ?? placeholder} anchor={box} width={wide} maxHeight={320}>{search}{list}</Floating>
    </div>
  );
}

export type JTab<K extends string> = { key: K; label: string; icon?: React.ReactNode; count?: number | null };

/** The page card: tabs in its head, then the sections. `left` sits before the tabs (e.g. a form switch). */
export function WorkCard<K extends string>({ tabs, active, onTab, left, children, label }: {
  tabs: JTab<K>[]; active: K; onTab: (k: K) => void; left?: React.ReactNode; children: React.ReactNode; label?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-neutral-200 px-4 pt-3 sm:px-5">
        {left && <div className="pb-2">{left}</div>}
        {/* phones: the tabs take the whole row and scroll sideways (2026-11-18) */}
        <div className={cx("-mx-4 flex w-[calc(100%+2rem)] gap-x-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0", !!left && "sm:ml-auto")} role="tablist" aria-label={label}>
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onTab(t.key)}
              className={cx("-mb-px inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1.5 text-sm font-medium transition-colors",
                active === t.key ? "border-brand-700 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-900")}>
              {t.icon}{t.label}
              {t.count != null && <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold tabular-nums text-neutral-500">{t.count.toLocaleString("id-ID")}</span>}
            </button>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A switch of the card's head (e.g. Maintenance | Procurement): pill buttons with a coloured type icon. */
export function TypeSwitch<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string; icon: React.ReactNode; tone: string; count?: number | null }[]; value: K; onChange: (k: K) => void; label?: string;
}) {
  return (
    <div className="flex gap-1" role="tablist" aria-label={label}>
      {items.map((x) => (
        <button key={x.key} type="button" role="tab" aria-selected={value === x.key} onClick={() => onChange(x.key)}
          className={cx("inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            value === x.key ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")}>
          <span className={cx("flex h-6 w-6 items-center justify-center rounded-md text-white", x.tone)}>{x.icon}</span>{x.label}
          {x.count != null && <span className={cx("rounded-full px-1.5 text-[11px] font-bold tabular-nums", value === x.key ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-500")}>{x.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** The band under the tabs: status chips, search, filters, view switch. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2.5 border-b border-neutral-200 px-4 py-3 sm:px-5">{children}</div>;
}

/** Quick filter chips like Jira's quick filters: the active one dark. */
export function QuickChips<K extends string>({ items, value, onChange, label }: {
  items: { key: K; label: string; dot?: string; count?: number | null }[]; value: K; onChange: (k: K) => void; label?: string;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto" role="tablist" aria-label={label}>
      {items.map((x) => {
        const on = value === x.key;
        return (
          <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(x.key)}
            className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors", on ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")}>
            {x.dot && <span className={cx("h-2 w-2 rounded-full", x.dot)} aria-hidden />}{x.label}
            {x.count != null && <span className={cx("tabular-nums", on ? "text-white/70" : "text-neutral-400")}>{x.count.toLocaleString("id-ID")}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A section body inside the card (analysis, settings): a soft background so its own panels stand out. */
export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("space-y-4 bg-neutral-50/60 p-3 sm:p-4", className)}>{children}</div>;
}

/** The footer of a list: counts and the pager. */
export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2.5 text-xs text-neutral-500 sm:px-5">{children}</div>;
}

// the issue table: <table className={jTable}><thead><tr className={jHeadRow}><th className={jTh}>… <tbody><tr className={jRow}><td className={jTd}>
export const jTable = "w-full border-collapse text-[13px]";
export const jHeadRow = "border-b-2 border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-500";
export const jTh = "px-2 py-2 font-semibold first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
export const jRow = "group cursor-pointer border-b border-neutral-100 hover:bg-neutral-50";
export const jTd = "px-2 py-2 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
/** A wide data table like the Stock List (2026-11-19): one line per cell (a second line of a cell sits beside the first),
 *  the first column kept in sight while the table scrolls sideways, 13px, thin rules. Add the min width of the table. */
export const sheetTable = "w-full border-separate border-spacing-0 text-[13px] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap " +
  "[&_td>.block]:inline [&_td>.block:not(:first-child)]:ml-1.5 [&_td>p]:inline [&_td>p:not(:first-child)]:ml-1.5 " +
  "[&_td]:border-b [&_td]:border-neutral-100 [&_tbody_tr:hover_td]:bg-neutral-50 " +
  "[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-white " +
  "[&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-white [&_td:first-child]:shadow-[inset_-1px_0_0_#e5e5e5]";

/** the key of a row (number, code): blue, underlined on hover */
export const jKey = "font-medium text-brand-700 group-hover:underline";

export type LozengeTone = "grey" | "blue" | "green" | "amber" | "red" | "violet" | "cyan";
const LOZ: Record<LozengeTone, string> = {
  grey: "bg-neutral-200 text-neutral-800", blue: "bg-blue-100 text-blue-800", green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800", violet: "bg-violet-100 text-violet-800", cyan: "bg-cyan-100 text-cyan-900",
};
/** a Jira status lozenge: small bold caps on a soft colour */
export function Lozenge({ tone = "grey", children, title }: { tone?: LozengeTone; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-block max-w-[12rem] truncate rounded-[3px] px-1.5 py-0.5 align-middle text-[11px] font-bold uppercase leading-4 tracking-wide", LOZ[tone])}>{children}</span>;
}

const AVATAR = ["bg-sky-600", "bg-emerald-600", "bg-violet-600", "bg-rose-600", "bg-amber-600", "bg-teal-600", "bg-indigo-600"];
export const initialsOf = (name: string) => name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
/** a person: a coloured initials avatar (same colour for the same name) and the name, an optional second line */
export function Person({ name, sub, size = 24 }: { name: string; sub?: React.ReactNode; size?: number }) {
  const tone = AVATAR[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cx("flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white", tone)} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>{initialsOf(name)}</span>
      <span className="min-w-0"><span className="block truncate text-neutral-800">{name}</span>{sub && <span className="block truncate text-[11px] text-neutral-400">{sub}</span>}</span>
    </span>
  );
}

/** a small square type icon (the kind of a row) */
export function TypeIcon({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white", tone)}>{children}</span>;
}

/** a score like Jira's progress: a lozenge coloured by the score (≥ 90 green, ≥ 75 amber, else red) */
export function ScoreLozenge({ score }: { score: number | null }) {
  return <Lozenge tone={score === null ? "grey" : score >= 90 ? "green" : score >= 75 ? "amber" : "red"}>{score === null ? "—" : `${score}%`}</Lozenge>;
}
