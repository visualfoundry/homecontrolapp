'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHC } from '@/lib/store';
import { LargeTitle } from '@/components/LargeTitle';
import { Icon } from '@/components/Icon';

interface Camera {
  id: string;
  name: string;
  state: 'CONNECTED' | 'DISCONNECTED';
}

export function CamerasScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewingCamera, setViewingCamera] = useState<Camera | null>(null);

  useEffect(() => {
    fetch('/api/cameras')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<Camera[]>;
      })
      .then(data => { setCameras(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const connected = cameras.filter(c => c.state === 'CONNECTED').length;
  const sub = loading ? 'Loading…'
    : error ? 'Unavailable'
    : cameras.length === 0 ? 'No cameras'
    : `${connected} of ${cameras.length} online`;

  return (
    <div>
      <LargeTitle title="Cameras" sub={sub} />

      {error && (
        <p style={{ padding: 'var(--screen-px)', color: 'var(--text2)', fontSize: 14 }}>
          Could not reach the UniFi controller. Check the host, username, and password in WP Admin → HCA Settings.
        </p>
      )}

      {!error && !loading && cameras.length === 0 && (
        <p style={{ padding: 'var(--screen-px)', color: 'var(--text2)', fontSize: 14 }}>
          No cameras found. Enter the UniFi controller URL, username, and password in WP Admin → HCA Settings.
        </p>
      )}

      {!error && cameras.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
            padding: 'var(--screen-px)',
          }}
        >
          {cameras.map((cam, idx) => (
            <CameraCard key={cam.id} camera={cam} index={idx} onOpen={() => setViewingCamera(cam)} />
          ))}
        </div>
      )}

      {viewingCamera && (
        <CameraViewer camera={viewingCamera} onClose={() => setViewingCamera(null)} />
      )}
    </div>
  );
}

function CameraViewer({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const { overlayRef } = useHC();
  const [tick, setTick] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const offline = camera.state === 'DISCONNECTED';

  useEffect(() => {
    if (offline) return;
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [offline]);

  if (!overlayRef.current) return null;

  return createPortal(
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'all',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 12px 8px',
        gap: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 16,
            border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name="close" size={16} />
        </button>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{camera.name}</span>
        {offline && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Offline</span>
        )}
      </div>

      {/* Image area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {offline ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            <Icon name="camera" size={48} />
            <div style={{ fontSize: 14, marginTop: 10 }}>Camera offline</div>
          </div>
        ) : (
          <div style={{ width: '100%', position: 'relative' }}>
            {!imgLoaded && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 48, color: 'rgba(255,255,255,0.25)',
              }}>
                <Icon name="camera" size={48} />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/cameras/${camera.id}/snapshot?t=${tick}`}
              alt={camera.name}
              style={{
                width: '100%',
                display: imgLoaded ? 'block' : 'none',
                objectFit: 'contain',
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
            />
          </div>
        )}
      </div>
    </div>,
    overlayRef.current,
  );
}

function CameraCard({ camera, index, onOpen }: { camera: Camera; index: number; onOpen: () => void }) {
  const [tick, setTick] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const offline = camera.state === 'DISCONNECTED';

  useEffect(() => {
    if (offline) return;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      setTick(1);
      interval = setInterval(() => setTick(t => t + 1), 30_000);
    }, index * 200);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [offline, index]);

  return (
    <div
      onClick={onOpen}
      style={{
        borderRadius: 'var(--radius-l)',
        overflow: 'hidden',
        background: 'var(--card)',
        position: 'relative',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* 16:9 aspect ratio container */}
      <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
        {(offline || tick === 0) ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'var(--card)',
              color: 'var(--text2)',
            }}
          >
            <Icon name="camera" size={28} style={offline ? {} : { color: 'var(--text3)' } as React.CSSProperties} />
            {offline && <span style={{ fontSize: 12 }}>Offline</span>}
          </div>
        ) : (
          <>
            {!imgLoaded && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="camera" size={28} style={{ color: 'var(--text3)' } as React.CSSProperties} />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/cameras/${camera.id}/snapshot?t=${tick}`}
              alt={camera.name}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: imgLoaded ? 'block' : 'none',
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
            />
          </>
        )}
      </div>

      {/* Name label */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: -0.2,
        }}
      >
        {camera.name}
      </div>
    </div>
  );
}
