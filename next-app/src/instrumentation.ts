/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * Used to boot background tasks that must persist for the server lifetime.
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startAlertScheduler } = await import('@/lib/push');
  startAlertScheduler();
}
