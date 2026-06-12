'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSpotifyPlayer, useSpotify } from '@/hooks/useSpotify';
import type { SpotifySDKState, SpotifyState, SpotifyTrack } from '@/hooks/useSpotify';

interface SpotifyPlayerCtx {
  deviceId: string | null;
  ready: boolean;
  sdkState: SpotifySDKState | null;
  sdkError: string | null;
}

type SpotifyWithCommand = SpotifyState & {
  command: (action: string, value?: number, context_uri?: string) => Promise<void>;
};

interface SpotifyCtxValue {
  sdkPlayer: SpotifyPlayerCtx;
  spotify: SpotifyWithCommand;
  /** true when the user has stopped playback — MiniPlayer hides until a new track starts */
  miniDismissed: boolean;
  dismissMini: () => void;
}

const SpotifyCtx = createContext<SpotifyCtxValue | null>(null);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const sdkPlayer = useSpotifyPlayer();
  const spotify = useSpotify(sdkPlayer.deviceId);
  const [miniDismissed, setMiniDismissed] = useState(false);

  // Auto un-dismiss when a new track id appears
  const trackId = sdkPlayer.sdkState?.track_window.current_track?.id ?? spotify.track?.id ?? null;
  const prevTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackId && trackId !== prevTrackIdRef.current) {
      setMiniDismissed(false);
    }
    prevTrackIdRef.current = trackId;
  }, [trackId]);

  const dismissMini = () => setMiniDismissed(true);

  return (
    <SpotifyCtx.Provider value={{ sdkPlayer, spotify, miniDismissed, dismissMini }}>
      {children}
    </SpotifyCtx.Provider>
  );
}

export function useSpotifyContext(): SpotifyCtxValue {
  const ctx = useContext(SpotifyCtx);
  if (!ctx) throw new Error('useSpotifyContext must be inside SpotifyProvider');
  return ctx;
}

// Re-export for convenience
export type { SpotifyTrack, SpotifySDKState, SpotifyState };
