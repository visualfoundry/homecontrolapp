'use client';

import React, { createContext, useContext } from 'react';
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
}

const SpotifyCtx = createContext<SpotifyCtxValue | null>(null);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const sdkPlayer = useSpotifyPlayer();
  const spotify = useSpotify(sdkPlayer.deviceId);
  return (
    <SpotifyCtx.Provider value={{ sdkPlayer, spotify }}>
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
