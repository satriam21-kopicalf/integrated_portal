'use client';

import { ReactNode, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { AccountDrawersProvider } from '@/components/AccountDrawers';
import ExportToasts from '@/components/ExportToasts';
import { usePageViewLog } from '@/lib/activity';
import { AuthProvider, canAccess, isPublicPath, useAuth } from '@/lib/auth';
import { ExportsProvider } from '@/lib/exports';
import { RealtimeProvider } from '@/lib/realtime';
import { LanguageProvider, tr } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';

/**
 * Session-wide providers: the signed-in user, then (only once signed in) one
 * realtime WebSocket shared by all pages. Protected pages render only after the
 * session is confirmed, so no dashboard content flashes before a redirect.
 * AccountDrawersProvider adds "My profile" / "Change password" (incl. the forced
 * password change and the reminder to complete the profile). ExportsProvider follows
 * Excel exports across pages. Role "user" only opens Overview and Sales; every page
 * visit is reported to the activity log. Theme (light / dark) and language (EN / ID) wrap
 * everything, the login page included.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Gate>{children}</Gate>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user } = useAuth();
  const isPublic = isPublicPath(pathname);
  const allowed = Boolean(user && canAccess(user.role, pathname));

  useEffect(() => {
    if (user && !isPublic && !allowed) router.replace('/overview');
  }, [user, isPublic, allowed, router]);
  usePageViewLog(pathname, Boolean(user) && !isPublic && allowed);

  if (isPublic) return <>{children}</>;
  if (status !== 'authenticated' || !user || !allowed) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-400" aria-busy="true">
        <Loader2 size={22} className="animate-spin" />
        <span className="sr-only">{tr('Checking your session…')}</span>
      </div>
    );
  }
  return (
    <RealtimeProvider>
      <ExportsProvider>
        <AccountDrawersProvider>{children}</AccountDrawersProvider>
        <ExportToasts />
      </ExportsProvider>
    </RealtimeProvider>
  );
}
