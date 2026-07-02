import { NextRequest, NextResponse } from 'next/server';
import { checkAndResendAlerts } from '@/lib/push';

/**
 * POST /api/push/alerts
 *
 * Triggers an immediate check of all active persistent alerts, re-sending
 * any that haven't been sent in the configured resend window (default 24h).
 *
 * Call this from a system cron job so re-notifications survive server restarts:
 *   0 * * * * curl -s -X POST http://localhost:3000/api/push/alerts \
 *     -H "x-hca-internal-key: YOUR_HCA_INTERNAL_KEY"
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-hca-internal-key');
  if (!key || key !== process.env.HCA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await checkAndResendAlerts();
  return NextResponse.json({ ok: true });
}
