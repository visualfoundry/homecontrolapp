'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LargeTitle } from '@/components/LargeTitle';
import { Icon } from '@/components/Icon';
import { useHC } from '@/lib/store';
import { CATEGORY_SCREEN, type InAppNotification } from '@/types/config';

const DELETE_W = 72;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

/** Destination screen for a notification, or undefined if it isn't actionable. */
function destinationOf(n: InAppNotification): string | undefined {
  return n.screen ?? (n.category ? CATEGORY_SCREEN[n.category] : undefined);
}

function SwipeRow({
  notif,
  onDelete,
  onOpen,
}: {
  notif: InAppNotification;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const drag = useRef({ active: false, startX: 0, startY: 0, dir: null as 'h' | 'v' | null, base: 0 });

  function settle(to: number) {
    drag.current.base = to;
    setAnimating(true);
    setOffset(to);
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, dir: null, base: offset };
    setAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.dir) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (d.dir === 'h') (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (d.dir !== 'h') return;
    e.preventDefault();
    setOffset(Math.max(-DELETE_W, Math.min(0, d.base + dx)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    // No axis locked in = the pointer barely moved, so treat it as a tap.
    // A tap on a row that's swiped open just closes it.
    if (!d.dir) {
      if (d.base !== 0) settle(0);
      else onOpen?.();
      return;
    }
    if (d.dir !== 'h') return;
    const dx = e.clientX - d.startX;
    settle(d.base + dx < -DELETE_W * 0.4 ? -DELETE_W : 0);
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete zone — white trash on red */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_W,
        background: 'var(--red)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button
          onClick={onDelete}
          style={{
            width: '100%', height: '100%', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}
        >
          <Icon name="trash" size={22} strokeWidth={1.8} />
        </button>
      </div>

      {/* Sliding row */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current.active = false; settle(0); }}
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--card)',
          transform: `translateX(${offset}px)`,
          transition: animating ? 'transform 0.22s ease' : 'none',
          padding: '13px 16px 13px 22px',
          touchAction: 'pan-y',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          cursor: onOpen ? 'pointer' : 'default',
        }}
      >
        {/* Unread dot */}
        {!notif.read && (
          <div style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 15,
                fontWeight: notif.read ? 500 : 660,
                color: 'var(--text)',
                flex: 1, minWidth: 0,
              }}>
                {notif.title}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
                {relativeTime(notif.timestamp)}
              </span>
            </div>

            <p style={{
              margin: '2px 0 0',
              fontSize: 13.5, lineHeight: 1.4,
              color: 'var(--text2)',
              fontWeight: notif.read ? 400 : 480,
            }}>
              {notif.body}
            </p>
          </div>

          {/* Affordance for rows that navigate somewhere */}
          {onOpen && (
            <span style={{ color: 'var(--text3)', flexShrink: 0, display: 'inline-flex' }}>
              <Icon name="chevron" size={16} strokeWidth={2} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const { notifications, deleteNotification, markRead, markAllRead, unreadCount, go } = useHC();

  // Mark all as read when the user navigates away.
  const markAllReadRef = useRef(markAllRead);
  useEffect(() => { markAllReadRef.current = markAllRead; }, [markAllRead]);
  useEffect(() => () => { markAllReadRef.current(); }, []);

  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      <LargeTitle
        title="Notifications"
        action={unreadCount > 0 ? 'Mark All Read' : undefined}
        onAction={unreadCount > 0 ? markAllRead : undefined}
      />

      {sorted.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, marginTop: 64, color: 'var(--text3)',
        }}>
          <Icon name="bell" size={48} strokeWidth={1.3} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>No notifications</p>
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          {sorted.map((n, i) => {
            const dest = destinationOf(n);
            return (
              <React.Fragment key={n.id}>
                {i > 0 && <div style={{ height: '0.5px', background: 'var(--sep)', marginLeft: 22 }} />}
                <SwipeRow
                  notif={n}
                  onDelete={() => deleteNotification(n.id)}
                  onOpen={dest ? () => { markRead(n.id); go(dest); } : undefined}
                />
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
