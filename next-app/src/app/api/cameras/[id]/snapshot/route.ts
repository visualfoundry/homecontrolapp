import { NextRequest, NextResponse } from 'next/server';
import { unifiGetStream } from '@/lib/unifi-client';
import { getUnifiConfig } from '@/lib/unifi-config';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const config = await getUnifiConfig();
  if (!config) {
    return new NextResponse('UniFi not configured', { status: 503 });
  }

  const { id } = await params;

  try {
    const path = config.apiKey
      ? `/proxy/protect/integration/v1/cameras/${id}/snapshot`
      : `/proxy/protect/api/cameras/${id}/snapshot?ts=${Date.now()}`;

    const { status, contentType, stream } = await unifiGetStream(path);

    if (status !== 200) {
      return new NextResponse(null, { status });
    }

    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(`Snapshot error for camera ${id}:`, err);
    return new NextResponse('Snapshot unavailable', { status: 502 });
  }
}
