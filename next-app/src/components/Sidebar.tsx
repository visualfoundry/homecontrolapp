'use client';

// =============================================================================
// Sidebar — vertical navigation for tablet/desktop layouts
//
// Mirrors the TabBar's item list (user tabs + pinned More) but rendered as
// a left-rail sidebar instead of a bottom bar. Shown only at md+ via CSS
// (.hca-sidebar { display: none } → display: flex at 768px+).
// =============================================================================

import React from 'react';
import { Icon } from '@/components/Icon';
import { SECTIONS, MAX_TABS } from '@/lib/sections';
import type { IconName } from '@/components/Icon';

interface SidebarProps {
  current: string;
  tabs: string[];
  go: (id: string) => void;
}

export function Sidebar({ current, tabs, go }: SidebarProps) {
  const items = [
    ...tabs.slice(0, MAX_TABS).map((id) => ({
      id,
      name: SECTIONS[id]?.name ?? id,
      icon: (SECTIONS[id]?.icon ?? 'home') as IconName,
    })),
    { id: 'more', name: 'More', icon: 'grid' as IconName },
  ];

  const activeTop = tabs.includes(current) ? current : 'more';

  return (
    <nav className="hca-sidebar" aria-label="Main navigation">
      {/* App brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 8px 18px',
          marginBottom: 6,
          borderBottom: '0.5px solid var(--sep)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <Icon name="home" size={17} strokeWidth={2.1} />
        </div>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: -0.3,
            lineHeight: 1.2,
          }}
        >
          Home Control
        </span>
      </div>

      {/* Nav items */}
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
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '10px 12px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              background: on ? 'var(--sep)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text2)',
              fontFamily: 'var(--font)',
              transition: 'background 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon name={item.icon} size={20} strokeWidth={on ? 2.1 : 1.8} />
            <span
              style={{
                fontSize: 14.5,
                fontWeight: on ? 650 : 500,
                letterSpacing: -0.2,
              }}
            >
              {item.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
