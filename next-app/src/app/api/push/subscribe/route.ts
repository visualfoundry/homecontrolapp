import { NextRequest, NextResponse } from 'next/server';
import { addSubscription, removeSubscription, type PushSub } from '@/lib/push';

// POST /api/push/subscribe — save a browser push subscription
export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<PushSub>;
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  addSubscription(body as PushSub);
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove a subscription (unsubscribe)
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json() as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
