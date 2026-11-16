// Progress of the file download running now, shown by <DownloadProgress> (mounted once in the providers). Same design
// as kopicalf-hrms (lib/download-progress.ts, 2026-11-16). Use downloadFile(); the Sales exports keep their own cards
// (lib/exports.tsx) because they run as server jobs.

import { tr } from './i18n';

export type DownloadState = {
  id: number; filename: string; percent: number | null; phase: 'preparing' | 'downloading' | 'done';
  cancel?: () => void;
};

let current: DownloadState | null = null;
let seq = 0;
const subs = new Set<(s: DownloadState | null) => void>();
const emit = () => subs.forEach(f => f(current));

export function subscribeDownload(f: (s: DownloadState | null) => void): () => void {
  subs.add(f);
  f(current);
  return () => { subs.delete(f); };
}

function close(id: number) {
  if (current?.id === id) { current = null; emit(); }
}

/** What went wrong, from the error body of the API (portal backend or the warehouse /portal proxy). */
async function defaultError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? (typeof body?.error === 'string' ? body.error : null) ?? body?.detail ?? tr('The file could not be downloaded');
}

/**
 * Download a file with the progress ring: "preparing" while the server builds it, then the percentage (from the
 * Content-Length; without it the ring stays indeterminate). The user may cancel: then it resolves without saving.
 * A failure closes the ring and throws, so the caller shows its message as before.
 */
export async function downloadFile(filename: string, request: (signal: AbortSignal) => Promise<Response>,
  errorOf: (res: Response) => Promise<string> = defaultError): Promise<void> {
  const id = ++seq;
  const ctrl = new AbortController();
  const patch = (p: Partial<DownloadState>) => { if (current?.id === id) { current = { ...current, ...p }; emit(); } };
  current = { id, filename, percent: null, phase: 'preparing', cancel: () => ctrl.abort() };
  emit();
  try {
    const res = await request(ctrl.signal);
    if (!res.ok) throw new Error(await errorOf(res));
    const total = Number(res.headers.get('content-length')) || 0;
    let blob: Blob;
    if (res.body && total > 0) {
      const reader = res.body.getReader();
      const parts: BlobPart[] = [];
      let got = 0;
      patch({ phase: 'downloading', percent: 0 });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        patch({ percent: Math.min(99, Math.round((got / total) * 100)) });
      }
      blob = new Blob(parts, { type: res.headers.get('content-type') ?? undefined });
    } else {
      patch({ phase: 'downloading' });
      blob = await res.blob();
    }
    const href = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    patch({ phase: 'done', percent: 100, cancel: undefined });
    setTimeout(() => close(id), 1200);
  } catch (e) {
    close(id);
    if (ctrl.signal.aborted) return; // cancelled by the user: nothing to report
    throw e;
  }
}
