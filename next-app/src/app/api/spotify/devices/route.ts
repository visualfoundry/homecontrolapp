// GET /api/spotify/devices — list available Spotify Connect devices

import { NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify-token';

export const dynamic = 'force-dynamic';

export interface SpotifyDeviceRaw {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export async function GET() {
  try {
    const token = await getSpotifyToken();
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Spotify ${res.status}` }, { status: 502 });
    }
    const { devices } = await res.json() as { devices: SpotifyDeviceRaw[] };
    return NextResponse.json({
      devices: devices.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        volumePct: d.volume_percent,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'devices error' },
      { status: 500 },
    );
  }
}
