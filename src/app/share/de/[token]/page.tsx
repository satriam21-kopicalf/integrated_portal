"use client";

// A Damaged Equipment request opened from its share link (no sign-in): the document as the teams read it, with the
// current progress and every note, the evidence and the PDF. The link is read-only and expires (SHARE_LINK_DAYS).

import { Download, FileText, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorState, ToastProvider, useToast } from "@/so/ui";
import RequestView from "@/so/features/de/RequestView";
import { type Request, download, shareUrls } from "@/so/features/de/de";
import { wibDateTime } from "@/so/lib/wib";
import { assetUrl } from "@/lib/assets";
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
  useEffect(() => {
    fetch(`/api/public/de/${encodeURIComponent(token)}`)
      .then(async (res) => { const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error ?? tr("The link is not found or has expired")); setR(body); })
      .catch((e) => setError((e as Error).message));
  }, [token]);
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
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from the assets bucket */}
          <img src={assetUrl("assets/calf-logo.png")} alt="Kopi Calf" className="h-9 w-9 rounded-lg object-contain ring-1 ring-slate-200" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Kopi Calf · Damaged Equipment</p>
            <h1 className="truncate text-base font-semibold text-slate-900">{r ? `${r.number} · ${r.branchName}` : tr("Request")}</h1>
          </div>
          {r && <Button size="sm" variant="secondary" loading={busy} onClick={() => void pdf()}><Download size={14} /> PDF</Button>}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">
        {error ? <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} /></div>
          : !r ? <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {tr("Loading…")}</div> : (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500"><FileText size={13} /> {r.kindLabel} · PIC {r.picName} · {tr("sent {0}", wibDateTime(r.submittedAt))}
                {r.shareExpiresAt ? ` · ${tr("link valid until {0}", wibDateTime(r.shareExpiresAt))}` : ""}</p>
              <RequestView r={r} urls={urls} />
            </>
          )}
      </main>
    </div>
  );
}
