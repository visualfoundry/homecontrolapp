'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  artUrl: string | null;
}

export interface SpotifyState {
  isPlaying: boolean;
  progressMs: number;
  track: SpotifyTrack | null;
  device: { name: string; volumePct: number } | null;
  loading: boolean;
  error: string | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
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

// Minimal Spotify Web Playback SDK types
interface SDKTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
}

export interface SpotifySDKState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SDKTrack };
}

interface SDKPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: never) => void): void;
}

declare global {
  interface Window {
    Spotify: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SDKPlayer };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

// ── useSpotifyPlayer ─────────────────────────────────────────────────────────
// Loads the Web Playback SDK, registers the browser as a Spotify device, and
// streams real-time playback state without polling.

export function useSpotifyPlayer() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sdkState, setSdkState] = useState<SpotifySDKState | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const playerRef = useRef<SDKPlayer | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: 'Home Control',
        getOAuthToken: (cb) => {
          fetch('/api/spotify/token')
            .then(r => r.json())
            .then(({ accessToken }: { accessToken: string }) => cb(accessToken))
            .catch(() => setSdkError('Token fetch failed'));
        },
        volume: 0.5,
      });

      player.addListener('ready', (({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setReady(true);
      }) as never);

      player.addListener('not_ready', ((() => {
        setReady(false);
      }) as never));

      player.addListener('player_state_changed', ((state: SpotifySDKState | null) => {
        setSdkState(state);
      }) as never);

      player.addListener('initialization_error', (({ message }: { message: string }) => setSdkError(message)) as never);
      player.addListener('authentication_error',  (({ message }: { message: string }) => setSdkError(message)) as never);
      player.addListener('account_error',         (({ message }: { message: string }) => setSdkError(message)) as never);

      player.connect();
      playerRef.current = player;
    };

    if (typeof window !== 'undefined') {
      if (window.Spotify) {
        initPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
        const existing = document.querySelector('script[src*="spotify-player"]');
        if (!existing) {
          const script = document.createElement('script');
          script.src = 'https://sdk.scdn.co/spotify-player.js';
          script.async = true;
          document.body.appendChild(script);
        }
      }
    }

    return () => { playerRef.current?.disconnect(); };
  }, []);

  return { deviceId, ready, sdkState, sdkError };
}

// ── useSpotify ───────────────────────────────────────────────────────────────
// REST polling + commands. Pass deviceId from useSpotifyPlayer to target the
// in-browser player for commands.

const POLL_MS = 5000;

export function useSpotify(deviceId?: string | null) {
  const [state, setState] = useState<SpotifyState>({
    isPlaying: false, progressMs: 0, track: null, device: null, loading: true, error: null,
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const startTicker = () => {
    stopTicker();
    tickRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.isPlaying || !prev.track) return prev;
        return { ...prev, progressMs: Math.min(prev.progressMs + 1000, prev.track.durationMs) };
      });
    }, 1000);
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify', { cache: 'no-store' });
      if (!res.ok) {
        const { error } = await res.json();
        setState(prev => ({ ...prev, loading: false, error: error ?? 'Spotify error' }));
        return;
      }
      const data = await res.json();
      setState({ isPlaying: data.isPlaying, progressMs: data.progressMs ?? 0, track: data.track, device: data.device, loading: false, error: null });
      if (data.isPlaying) startTicker(); else stopTicker();
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'fetch error' }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { clearInterval(interval); stopTicker(); };
  }, [poll]);

  const command = useCallback(async (action: string, value?: number, context_uri?: string) => {
    if (action === 'play' || action === 'play_context') setState(prev => ({ ...prev, isPlaying: true }));
    if (action === 'pause') setState(prev => ({ ...prev, isPlaying: false }));

    await fetch('/api/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value, context_uri, ...(deviceId ? { device_id: deviceId } : {}) }),
    });
    setTimeout(poll, 600);
  }, [poll, deviceId]);

  return { ...state, command };
}

// ── useSpotifyLibrary ────────────────────────────────────────────────────────

export function useSpotifyLibrary() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/spotify/library', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setPlaylists(data.playlists ?? []);
          setArtists(data.artists ?? []);
        }
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  return { playlists, artists, loading, error };
}
