// GET /api/spotify/token — returns a short-lived access token for the Web Playback SDK.
// The SDK runs in the browser and needs a token client-side; this proxies it safely
// without exposing the refresh token or client secret.

import { NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify-token';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accessToken = await getSpotifyToken();
    return NextResponse.json({ accessToken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'token error' },
      { status: 500 },
    );
  }
}
