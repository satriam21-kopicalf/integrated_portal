"use client";

// The frame of the public Damaged Equipment pages (share link of a request, photo link of a technician): no sign-in, a
// brand band with the document name, an ID / EN switch (Indonesian when the browser has no choice yet) and a footer.

import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ErrorState } from "@/so/ui";
import { assetUrl } from "@/lib/assets";
import { LANG_KEY, tr, useLang } from "@/lib/i18n";

export default function PublicShell({ eyebrow, title, subtitle, actions, children }: {
  eyebrow: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  const { lang, setLang } = useLang();
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(LANG_KEY)) setLang("id");
    } catch {
      /* English */
    }
  }, [setLang]);
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="bg-[#0b1f4d] text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from the assets bucket */}
          <img src={assetUrl("assets/calf-logo.png")} alt="Kopi Calf" className="h-10 w-10 flex-shrink-0 rounded-xl bg-white object-contain p-1" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200">{eyebrow}</p>
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {subtitle && <p className="truncate text-xs text-blue-100/80">{subtitle}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {actions}
            <div className="flex overflow-hidden rounded-lg ring-1 ring-white/25" role="group" aria-label={tr("Language")}>
              {(["id", "en"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={lang === l ? "bg-white px-2 py-1 text-[11px] font-semibold text-[#0b1f4d]" : "px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"}>
                  {l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-1 bg-blue-600" />
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-4xl px-4 py-3 text-center text-[11px] text-slate-400 sm:px-6">Kopi Calf Integrated Portal · Damaged Equipment</p>
      </footer>
    </div>
  );
}

export function PublicLoading() {
  return <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {tr("Loading…")}</div>;
}

export function PublicError({ message }: { message: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><ErrorState message={message} /></div>;
}
