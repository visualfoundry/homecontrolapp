import { NextRequest, NextResponse } from 'next/server';
import { sendToAll, type PushPayload } from '@/lib/push';

/**
 * POST /api/push/notify
 *
 * Internal endpoint — called by the home-control service when a device event
 * should trigger a push notification. Protected by X-HCA-Internal-Key (same
 * key used by the WP revalidation webhook and the auth login proxy).
 *
 * Body: { title?: string; body: string; url?: string }
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-hca-internal-key');
  if (!key || key !== process.env.HCA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json() as Partial<PushPayload>;
  if (!data?.body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 });
  }

  await sendToAll({
    title: data.title ?? 'Home Control',
    body:  data.body,
    url:   data.url  ?? '/',
  });

  return NextResponse.json({ ok: true });
}
