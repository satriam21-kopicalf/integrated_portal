'use client';

import { ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';

/** Client-side providers that live for the whole session (one WebSocket across page changes). */
export default function Providers({ children }: { children: ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
