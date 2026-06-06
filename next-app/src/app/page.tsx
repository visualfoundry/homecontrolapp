import { ClientShell } from '@/components/ClientShell';
import { fetchConfig } from '@/lib/config';

// Root page — fetches config at build/ISR time, passes it to the PWA shell.
// ClientShell hosts the ssr:false dynamic import (not allowed in Server Components).
export default async function Home() {
  const config = await fetchConfig();
  return <ClientShell config={config} />;
}
