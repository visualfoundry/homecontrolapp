import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';
import { verifySession } from '@/lib/auth';

const INTERNAL_KEY = process.env.HCA_INTERNAL_KEY ?? '';

// Internal agent: connects to 127.0.0.1:443 (Apache VirtualHost for 192.168.1.91 —
// serves WordPress directly, no proxy). rejectUnauthorized: false because the cert
// is for app.dixons.net, not the IP; X-HCA-Internal-Key is the actual auth layer.
const internalAgent = new https.Agent({ rejectUnauthorized: false });

async function wpFetch(path: string, method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: unknown }> {
  const bodyStr = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port: 443,
        path,
        method,
        agent: internalAgent,
        headers: {
          'X-HCA-Internal-Key': INTERNAL_KEY,
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
          let data: unknown = {};
          try { data = JSON.parse(raw); } catch { /* non-JSON body */ }
          resolve({ ok, status: res.statusCode ?? 0, data });
        });
      },
    );
    req.on('error', () => resolve({ ok: false, status: 0, data: {} }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getUserId(req: NextRequest): Promise<number | null> {
  const session = req.cookies.get('hca_session')?.value ?? '';
  if (!session) return null;
  return verifySession(session);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!INTERNAL_KEY) return NextResponse.json({}, { status: 200 });

  const result = await wpFetch(`/wp-json/hca/v1/prefs?userId=${userId}`, 'GET');
  if (!result.ok) return NextResponse.json({}, { status: 200 });
  return NextResponse.json(result.data);
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!INTERNAL_KEY) return NextResponse.json({ ok: true });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const result = await wpFetch('/wp-json/hca/v1/prefs', 'PUT', { userId, ...body });
  if (!result.ok) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
