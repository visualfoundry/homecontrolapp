import { ClientShell } from '@/components/ClientShell';
import { fetchConfig } from '@/lib/config';

// Always server-rendered so fetchConfig() runs at request time, not build time.
// The underlying fetch is still cache-tagged 'hca-config' — on-demand revalidation
// via /api/revalidate purges the fetch cache so the next request re-fetches from WPGraphQL.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const config = await fetchConfig();
  return <ClientShell config={config} />;
}
