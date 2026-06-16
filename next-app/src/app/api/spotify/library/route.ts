// GET /api/spotify/library — returns the current user's playlists and followed artists

import { NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify-token';

export const dynamic = 'force-dynamic';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  artUrl: string | null;
  owner: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  artUrl: string | null;
  genres: string[];
}

export async function GET() {
  try {
    const token = await getSpotifyToken();

    const [playlistsRes, artistsRes] = await Promise.all([
      fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch('https://api.spotify.com/v1/me/following?type=artist&limit=50', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
    ]);

    // Playlists
    let playlists: SpotifyPlaylist[] = [];
    if (playlistsRes.ok) {
      const data = await playlistsRes.json();
      playlists = (data.items as Record<string, unknown>[])
        .filter(Boolean)
        .filter((p) => p.id && p.name && p.uri)
        .map((p) => ({
          id: p.id as string,
          name: p.name as string,
          uri: p.uri as string,
          artUrl: ((p.images as { url: string }[] | null) ?? [])[0]?.url ?? null,
          owner: (p.owner as { display_name?: string; id: string } | null)?.display_name
            ?? (p.owner as { id: string } | null)?.id
            ?? '',
          trackCount: (p.tracks as { total?: number } | null)?.total ?? 0,
        }));
    }

    // Followed artists (requires user-follow-read scope)
    let artists: SpotifyArtist[] = [];
    if (artistsRes.ok) {
      const data = await artistsRes.json();
      artists = ((data.artists?.items ?? []) as Record<string, unknown>[])
        .filter(Boolean)
        .map((a) => ({
          id: a.id as string,
          name: a.name as string,
          uri: a.uri as string,
          artUrl: ((a.images as { url: string }[] | null) ?? [])[0]?.url ?? null,
          genres: (a.genres as string[] | null) ?? [],
        }));
    }

    return NextResponse.json({ playlists, artists });
  } catch (err) {

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'library error' },
      { status: 500 },
    );
  }
}
