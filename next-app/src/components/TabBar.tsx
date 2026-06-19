'use client';

// =============================================================================
// TabBar — bottom navigation bar
// Source: .claude/Claude Design/design_handoff_home_control/app.jsx
//
// Up to MAX_TABS user-chosen sections + pinned More (5 slots total).
// Frosted glass, safe-area bottom padding.
// Active: accent color, strokeWidth 2.1, weight 680.
// Inactive: --text3, strokeWidth 1.8, weight 560.
// =============================================================================

import React from 'react';
import { Icon } from '@/components/Icon';
import { SECTIONS, MAX_TABS } from '@/lib/sections';
import type { IconName } from '@/components/Icon';

interface TabBarProps {
  current: string;
  tabs: string[];       // the user's chosen tab ids (up to MAX_TABS)
  go: (id: string) => void;
}

export function TabBar({ current, tabs, go }: TabBarProps) {
  // Build the visible items: user tabs + pinned More
  const items = [
    ...tabs.slice(0, MAX_TABS).map((id) => ({
      id,
      name: SECTIONS[id]?.name ?? id,
      icon: (SECTIONS[id]?.icon ?? 'home') as IconName,
    })),
    { id: 'more', name: 'More', icon: 'grid' as IconName },
  ];

  // The "active" top-level tab: if current screen is a tab slot, highlight it;
  // otherwise highlight More.
  const activeTop = tabs.includes(current) ? current : 'more';

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        paddingTop: 9,
        paddingLeft: 6,
        paddingRight: 6,
        display: 'flex',
        justifyContent: 'space-around',
        background: 'var(--chrome-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '0.5px solid var(--chrome-border)',
      }}
    >
      {items.map((item) => {
        const on = activeTop === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            aria-label={item.name}
            aria-current={on ? 'page' : undefined}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '4px 0',
              color: on ? 'var(--accent)' : 'var(--text3)',
              WebkitTapHighlightColor: 'transparent',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <Icon name={item.icon} size={24} strokeWidth={on ? 2.1 : 1.8} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: on ? 680 : 560,
                letterSpacing: 0.1,
                lineHeight: 1,
              }}
            >
              {item.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
