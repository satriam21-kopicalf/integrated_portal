"use client";

// The sections of a Calf On The Road page in the order of the work (2026-11-12, the request of the COTR team: every
// feature easy and in order): numbered groups — what each is for and when — and the tabs of the chosen group. The tab
// stays in the address (?tab=) so a link (the dashboard, the guide) opens it.

import { ReactNode, useCallback, useEffect, useState } from "react";
import { cx } from "@/components/kc";
import { Tabs } from "@/components/kc";

export type FlowTab<K extends string> = { key: K; label: string; icon: ReactNode };
export type FlowGroup<K extends string> = { key: string; title: string; when: string; tabs: FlowTab<K>[] };

/** the tab of ?tab= (when it is one of `keys`), else the first; changing it rewrites the address */
export function useFlowTab<K extends string>(keys: K[], first: K): [K, (k: K) => void] {
  const [tab, setTab] = useState<K>(first);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as K | null;
    if (t && keys.includes(t)) setTab(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- read once on load
  const choose = useCallback((k: K) => {
    setTab(k);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    window.history.replaceState(null, "", url);
  }, []);
  return [tab, choose];
}

export function FlowNav<K extends string>({ groups, value, onChange, label }: { groups: FlowGroup<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  const at = Math.max(0, groups.findIndex((g) => g.tabs.some((t) => t.key === value)));
  const group = groups[at];
  return (
    <div className="space-y-3">
      <nav aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {groups.map((g, i) => {
          const on = i === at;
          return (
            <button key={g.key} type="button" onClick={() => onChange(g.tabs[0].key)} aria-current={on ? "step" : undefined}
              className={cx("flex w-[13.5rem] flex-none items-start sm:w-auto sm:min-w-[10.5rem] sm:flex-1 gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                on ? "bg-brand-700 text-white shadow-sm ring-brand-700" : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50")}>
              <span className={cx("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                on ? "bg-white text-brand-700" : "bg-neutral-100 text-neutral-600")}>{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{g.title}</span>
                <span className={cx("mt-0.5 block text-[11px] leading-snug", on ? "text-white/75" : "text-neutral-500")}>{g.when}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {group.tabs.length > 1 && (
        <Tabs label={group.title} value={value} onChange={(k) => onChange(k as K)}
          tabs={group.tabs.map((t) => ({ key: t.key, label: <span className="inline-flex items-center gap-1.5">{t.icon}{t.label}</span> }))} />
      )}
    </div>
  );
}
