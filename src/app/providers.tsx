'use client';

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AccountDrawersProvider } from '@/components/AccountDrawers';
import { AuthProvider, isPublicPath, useAuth } from '@/lib/auth';
import { RealtimeProvider } from '@/lib/realtime';

/**
 * Session-wide providers: the signed-in user, then (only once signed in) one
 * realtime WebSocket shared by all pages. Protected pages render only after the
 * session is confirmed, so no dashboard content flashes before a redirect.
 * AccountDrawersProvider adds "My profile" / "Change password" (incl. the forced
 * password change and the reminder to complete the profile).
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, user } = useAuth();
  if (isPublicPath(pathname)) return <>{children}</>;
  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-400" aria-busy="true">
        <Loader2 size={22} className="animate-spin" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }
  return (
    <RealtimeProvider>
      <AccountDrawersProvider>{children}</AccountDrawersProvider>
    </RealtimeProvider>
  );
}
