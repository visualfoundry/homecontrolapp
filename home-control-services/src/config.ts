// =============================================================================
// Configuration — home-control-services
// All values come from environment variables (see .env.example).
// =============================================================================

import 'dotenv/config';

export const EISY_URLS: string[] = [
  process.env.EISY_0_URL ?? 'http://192.168.1.10:8080',
  process.env.EISY_1_URL ?? 'http://192.168.1.11:8080',
  process.env.EISY_2_URL ?? 'http://192.168.1.12:8080',
  process.env.EISY_3_URL ?? 'http://192.168.1.13:8080',
  process.env.EISY_4_URL ?? 'http://192.168.1.14:8080',
];

export const EISY_USER = process.env.EISY_USER ?? '';
export const EISY_PASS = process.env.EISY_PASS ?? '';

/** Polling interval between full EISY status sweeps (ms). */
export const POLL_MS = parseInt(process.env.POLL_MS ?? '1000', 10);

/** Port this HTTP service listens on. */
export const PORT = parseInt(process.env.PORT ?? '8081', 10);

/** Port the Hue bridge emulation listens on. Must be free on this host — the
 *  state API already owns PORT, Apache owns 80/443. */
export const HUE_PORT = parseInt(process.env.HUE_PORT ?? '8082', 10);

/** Set only if this host has several interfaces and SSDP picks the wrong one —
 *  the address a Harmony hub is told to come back to. */
export const HUE_HOST_IP = process.env.HUE_HOST_IP ?? '';

/** Hue bridge emulation on/off. */
export const HUE_ENABLED = (process.env.HUE_ENABLED ?? 'true') !== 'false';

/** WPGraphQL endpoint — used by the export-devices script only. */
export const WP_GRAPHQL_URL = process.env.WP_GRAPHQL_URL ?? '';

/** Next.js app base URL — used to call /api/push/notify on device alerts. */
export const NEXT_APP_URL = process.env.NEXT_APP_URL ?? 'http://localhost:3000';

/** Shared secret for internal server-to-server calls (same value as HCA_INTERNAL_KEY in Next.js). */
export const HCA_INTERNAL_KEY = process.env.HCA_INTERNAL_KEY ?? '';
