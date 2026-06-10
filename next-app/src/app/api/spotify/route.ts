// GET  /api/spotify  — current Spotify playback state
// POST /api/spotify  — send a playback command { action: 'play'|'pause'|'next'|'prev'|'seek'|'volume'|'play_context', value?: number, context_uri?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify-token';

export const dynamic = 'force-dynamic';

const API = 'https://api.spotify.com/v1/me/player';

async function spotifyFetch(path: string, method: string, body?: object) {
  const token = await getSpotifyToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  return res;
}

export async function GET() {
  try {
    const res = await spotifyFetch('', 'GET');
    // 204 = nothing playing
    if (res.status === 204) {
      return NextResponse.json({ isPlaying: false, track: null });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Spotify ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const item = data.item;
    return NextResponse.json({
      isPlaying: data.is_playing as boolean,
      progressMs: data.progress_ms as number,
      track: item ? {
        id: item.id as string,
        name: item.name as string,
        artist: (item.artists as { name: string }[]).map(a => a.name).join(', '),
        album: item.album.name as string,
        durationMs: item.duration_ms as number,
        artUrl: (item.album.images as { url: string }[])[0]?.url ?? null,
      } : null,
      device: data.device ? {
        name: data.device.name as string,
        volumePct: data.device.volume_percent as number,
      } : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'spotify error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: string; value?: number; context_uri?: string; device_id?: string };
    const { action, value, context_uri, device_id } = body;
    // Append device_id to target a specific player (e.g. the in-browser Web Playback SDK)
    const dq = device_id ? `?device_id=${encodeURIComponent(device_id)}` : '';
    let res: Response;

    switch (action) {
      case 'play':
        res = await spotifyFetch(`/play${dq}`, 'PUT');
        break;
      case 'pause':
        res = await spotifyFetch(`/pause${dq}`, 'PUT');
        break;
      case 'next':
        res = await spotifyFetch('/next', 'POST');
        break;
      case 'prev':
        res = await spotifyFetch('/previous', 'POST');
        break;
      case 'seek':
        res = await spotifyFetch(`/seek?position_ms=${Math.round(value ?? 0)}${device_id ? `&device_id=${encodeURIComponent(device_id)}` : ''}`, 'PUT');
        break;
      case 'volume':
        res = await spotifyFetch(`/volume?volume_percent=${Math.round(value ?? 0)}${device_id ? `&device_id=${encodeURIComponent(device_id)}` : ''}`, 'PUT');
        break;
      case 'play_context':
        res = await spotifyFetch(`/play${dq}`, 'PUT', context_uri ? { context_uri } : undefined);
        break;
      default:
        return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }

    // Spotify returns 204 on success for these commands
    if (res.status === 204 || res.ok) {
      return NextResponse.json({ ok: true });
    }
    // 404/403 = no active device — not a server error, just nothing to control
    if (res.status === 404 || res.status === 403) {
      return NextResponse.json({ ok: false, reason: 'no_active_device' });
    }
    const text = await res.text();
    return NextResponse.json({ error: `Spotify ${res.status}: ${text}` }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'spotify command error' },
      { status: 500 },
    );
  }
}
