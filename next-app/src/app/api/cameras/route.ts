import { NextResponse } from 'next/server';
import { getCameras } from '@/lib/unifi-client';
import { getUnifiConfig } from '@/lib/unifi-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getUnifiConfig();
  if (!config) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const cameras = await getCameras();
    return NextResponse.json(cameras);
  } catch (err) {
    console.error('GET /api/cameras error:', err);
    return NextResponse.json({ error: 'Could not reach UniFi controller' }, { status: 502 });
  }
}
