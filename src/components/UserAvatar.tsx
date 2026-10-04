'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { AuthUser, initials } from '@/lib/auth';

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-base', xl: 'h-20 w-20 text-xl' };

/** Profile picture, or the initials on the brand gradient when there is none. */
export default function UserAvatar({
  name, src, size = 'md', className = '',
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = `flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZES[size]} ${className}`;
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not a static asset
    return <img src={src} alt={name} className={`${box} object-cover`} onError={() => setFailed(true)} />;
  }
  return (
    <span className={`${box} bg-gradient-to-br from-blue-700 to-blue-900 font-semibold text-white`} aria-label={name}>
      {initials(name)}
    </span>
  );
}

const OUTPUT = 256;

/** Center-crops to a square and scales to 256x256 (WebP, JPEG fallback) in the browser. */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Gunakan file JPG, PNG atau WebP');
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak dapat memproses gambar');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT, OUTPUT);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Upload / replace / remove a profile picture.
 * - `endpoint` set: changes are saved right away (PUT/DELETE endpoint) and `onSaved` gets the user.
 * - no endpoint: the picked image is only handed to `onPick` (used before a user exists).
 */
export function AvatarEditor({
  name, src, endpoint, onSaved, onPick,
}: {
  name: string;
  src: string | null;
  endpoint?: string;
  onSaved?: (user: AuthUser) => void;
  onPick?: (dataUrl: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(src);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (method: 'PUT' | 'DELETE', image?: string) => {
    const res = await fetch(endpoint!, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: image ? JSON.stringify({ image }) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Gagal menyimpan foto');
    onSaved?.(body.user);
    return body.user as AuthUser;
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await toAvatarDataUrl(file);
      if (endpoint) {
        const user = await send('PUT', dataUrl);
        setPreview(user.avatarUrl);
      } else {
        setPreview(dataUrl);
        onPick?.(dataUrl);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      if (endpoint) await send('DELETE');
      else onPick?.(null);
      setPreview(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar name={name || '?'} src={preview} size="xl" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <Loader2 size={20} className="animate-spin text-blue-700" />
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Camera size={15} /> {preview ? 'Change photo' : 'Upload photo'}
          </button>
          {preview && (
            <button type="button" onClick={remove} disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
              <Trash2 size={15} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">JPG, PNG or WebP. Cropped to a square, 256 × 256 px.</p>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
    </div>
  );
}
