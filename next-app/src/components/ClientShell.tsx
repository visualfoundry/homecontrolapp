'use client';

// Client-only wrapper for AppShell.
// `ssr: false` is only allowed inside a Client Component, so this thin wrapper
// exists solely to host the dynamic import. Config is fetched server-side (ISR)
// in page.tsx and passed down as props.

import dynamic from 'next/dynamic';
import type { AppConfig } from '@/types/config';
import { AuthGate } from '@/components/AuthGate';
import { PresenceReporter } from '@/components/PresenceReporter';

const AppShell = dynamic<{ config: AppConfig }>(
  () => import('@/components/AppShell').then((m) => ({ default: m.AppShell })),
  { ssr: false },
);

export function ClientShell({ config }: { config: AppConfig }) {
  return (
    <AuthGate>
      {/* Inside the gate: reporting presence needs a session to attribute it to. */}
      <PresenceReporter />
      <AppShell config={config} />
    </AuthGate>
  );
}
