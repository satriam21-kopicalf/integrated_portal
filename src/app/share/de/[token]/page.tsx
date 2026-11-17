"use client";

// A Maintenance Request opened from its share link (no sign-in): a report page with the head of the request
// (status, urgency, key facts, steps), the request itself (items, analysis, evidence, handling, signature) and, beside
// it, the time per stage and every note of the team. Read-only; the link expires (SHARE_LINK_DAYS). PDF to download.

import { Check, Copy, Info } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ToastProvider, useToast } from "@/so/ui";
import PublicShell, { PublicError, PublicLoading } from "@/so/features/de/PublicShell";
import RequestView, { DetailsPanel, RequestHero } from "@/so/features/de/RequestView";
import { PdfIcon, WhatsAppIcon } from "@/so/features/de/icons";
import { type Request, download, shareUrls, useLive } from "@/so/features/de/de";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

export default function SharePage() {
  return <ToastProvider><ShareView /></ToastProvider>;
}

function ShareView() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [r, setR] = useState<(Request & { shareExpiresAt?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  // live (2026-11-17): the progress, photos and attachments refresh by themselves; a failed refresh keeps what is shown
  const load = useCallback(async (first = false) => {
    try {
      const res = await fetch(`/api/public/de/${encodeURIComponent(token)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? tr("The link is not found or has expired"));
      setR(body);
      setSeen(new Date().toISOString());
    } catch (e) {
      if (first) setError((e as Error).message);
    }
  }, [token]);
  useEffect(() => { void load(true); }, [load]);
  useLive(() => load(), 15000, !error);
  const urls = shareUrls(token);
  const pdf = async () => {
    if (!r) return;
    setBusy(true);
    try {
      await download(urls.pdf(r.id), `${r.number}.pdf`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(tr("Copy the address from the browser bar"), "error");
    }
  };
  return (
    <PublicShell eyebrow="Maintenance Request" title={r ? `${r.number} · ${r.branchName}` : tr("Request")}
      subtitle={r ? `${r.kindLabel} · PIC ${r.picName}` : undefined}
      actions={r && (
        <>
          <button type="button" onClick={() => void copy()} aria-label={tr("Copy Link")}
            className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white ring-1 ring-white/25 hover:bg-white/10 sm:inline-flex">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tr("Copied") : tr("Copy Link")}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${r.number} · ${r.kindLabel} · ${r.branchName}\n${typeof window === "undefined" ? "" : window.location.href}`)}`} target="_blank" rel="noreferrer"
            aria-label="WhatsApp" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"><WhatsAppIcon size={16} /><span className="hidden sm:inline">WhatsApp</span></a>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void pdf()}><PdfIcon size={16} /> PDF</Button>
        </>
      )}>
      {error ? <PublicError message={error} /> : !r ? <PublicLoading /> : (
        <div className="space-y-5">
          <RequestHero r={r} facts={false} />
          {/* issue layout (2026-11-17): the request, its handling and activity; beside it the details and time */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <div className="min-w-0 space-y-4">
              <RequestView r={r} urls={urls} part="detail" numbered={false} />
              <RequestView r={r} urls={urls} part="handling" numbered={false} />
              <RequestView r={r} urls={urls} part="activity" numbered={false} />
            </div>
            <aside className="space-y-4 lg:sticky lg:top-4">
              <DetailsPanel r={r} />
              <RequestView r={r} urls={urls} part="tracker" numbered={false} />
              {seen && <p className="flex items-center gap-1.5 text-[11px] text-neutral-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                {tr("Live · updated {0}", wibDateTime(seen))}</p>}
            </aside>
          </div>
          <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-neutral-400">
            <Info size={12} className="mt-px flex-shrink-0" />
            {tr("Read-only copy for sharing; it always shows the latest progress.")}{r.shareExpiresAt ? ` ${tr("Link valid until {0}.", wibDateTime(r.shareExpiresAt))}` : ""}
          </p>
        </div>
      )}
    </PublicShell>
  );
}
