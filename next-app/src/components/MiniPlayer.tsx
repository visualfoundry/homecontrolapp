'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { useSpotifyContext } from '@/lib/spotify-context';
import type { SpotifyTrack } from '@/hooks/useSpotify';

export const MINI_HEIGHT = 56;

export function MiniPlayer() {
  const { go } = useHC();
  const { sdkPlayer, spotify } = useSpotifyContext();

  // Prefer SDK state (in-browser player), fall back to REST-polled state
  const sdkTrack = sdkPlayer.sdkState?.track_window.current_track;
  const track: SpotifyTrack | null = sdkTrack
    ? {
        id: sdkTrack.id,
        name: sdkTrack.name,
        artist: sdkTrack.artists.map(a => a.name).join(', '),
        album: sdkTrack.album.name,
        durationMs: sdkTrack.duration_ms,
        artUrl: sdkTrack.album.images[0]?.url ?? null,
      }
    : spotify.track;

  const isPlaying = sdkPlayer.sdkState ? !sdkPlayer.sdkState.paused : spotify.isPlaying;
  const progressMs = sdkPlayer.sdkState ? sdkPlayer.sdkState.position : spotify.progressMs;
  const progress = track && track.durationMs > 0 ? progressMs / track.durationMs : 0;

  if (!track) return null;

  return (
    <div
      onClick={() => go('music')}
      style={{
        height: MINI_HEIGHT,
        background: 'var(--card)',
        borderTop: '0.5px solid var(--separator)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Progress bar — hairline at top edge */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--separator)' }}>
        <div style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: 'var(--accent)',
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Album art */}
      {track.artUrl ? (
        <img
          src={track.artUrl}
          alt={track.album}
          style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 6,
          background: 'var(--icon-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text2)', flexShrink: 0,
        }}>
          <Icon name="speaker" size={18} />
        </div>
      )}

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 620, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {track.name}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text2)', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {track.artist}
        </div>
      </div>

      {/* Play/pause — the only interactive button; outer div handles navigation */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          void spotify.command(isPlaying ? 'pause' : 'play');
        }}
        style={{
          width: 36, height: 36, borderRadius: 18,
          border: 'none', cursor: 'pointer',
          background: 'var(--icon-bg)',
          color: 'var(--text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
      </button>
    </div>
  );
}
