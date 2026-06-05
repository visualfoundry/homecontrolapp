import { AppShell } from '@/components/AppShell';
import { fetchConfig } from '@/lib/config';

// Root page — fetches config at build/ISR time, passes it to the PWA shell.
// AppShell is a client component; this page is the server entry point.
export default async function Home() {
  const config = await fetchConfig();
  return <AppShell config={config} />;
}
