import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

const WP_BASE = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
const INTERNAL_KEY = process.env.HCA_INTERNAL_KEY ?? '';

async function getUserId(req: NextRequest): Promise<number | null> {
  const session = req.cookies.get('hca_session')?.value ?? '';
  if (!session) return null;
  return verifySession(session);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!WP_BASE || !INTERNAL_KEY) {
    return NextResponse.json({}, { status: 200 });
  }

  try {
    const res = await fetch(`${WP_BASE}/wp-json/hca/v1/prefs?userId=${userId}`, {
      headers: { 'X-HCA-Internal-Key': INTERNAL_KEY },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({}, { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!WP_BASE || !INTERNAL_KEY) {
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const res = await fetch(`${WP_BASE}/wp-json/hca/v1/prefs`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-HCA-Internal-Key': INTERNAL_KEY,
      },
      body: JSON.stringify({ userId, ...body }),
    });
    if (!res.ok) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not reach WP' }, { status: 503 });
  }
}
