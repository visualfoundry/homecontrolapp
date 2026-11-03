'use client';

// =============================================================================
// Sidebar — vertical navigation for tablet/desktop layouts
//
// Mirrors the TabBar's item list (user tabs + pinned More) but rendered as
// a left-rail sidebar instead of a bottom bar. Shown only at md+ via CSS
// (.hca-sidebar { display: none } → display: flex at 768px+).
// =============================================================================

import React, { useLayoutEffect, useRef, useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { SECTIONS, MAX_TABS, moreOrder } from '@/lib/sections';
import type { IconName } from '@/components/Icon';

interface SidebarProps {
  current: string;
  tabs: string[];
  go: (id: string) => void;
}

export function Sidebar({ current, tabs, go }: SidebarProps) {
  const { sections } = useHC();
  const navRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(0); // rows free for extras (+ More if needed)

  const tabItems = tabs.slice(0, MAX_TABS);
  const overflow = moreOrder(sections, tabItems);

  // Spare height becomes extra rows. Rows are uniform, so measure one and
  // divide what is left after the brand header, the tab items and More.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const row = nav.querySelector('[data-nav-row]');
      const rowH = row ? row.getBoundingClientRect().height : 0;
      if (!rowH) return;
      const cs = getComputedStyle(nav);
      const inner = nav.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const header = headerRef.current
        ? headerRef.current.getBoundingClientRect().height +
          parseFloat(getComputedStyle(headerRef.current).marginBottom)
        : 0;
      const free = inner - header - tabItems.length * rowH;
      setRows(Math.max(0, Math.floor(free / rowH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [tabItems.length, sections]);

  const toItem = (id: string) => ({
    id,
    name: sections[id]?.name ?? SECTIONS[id]?.name ?? id,
    icon: (sections[id]?.icon ?? SECTIONS[id]?.icon ?? 'home') as IconName,
  });

  // More only appears when some pages don't fit; it then takes the last row.
  const showMore = overflow.length > rows;
  const extras = overflow.slice(0, showMore ? Math.max(0, rows - 1) : overflow.length);
  const items = [
    ...tabItems.map(toItem),
    ...extras.map(toItem),
    ...(showMore ? [{ id: 'more', name: 'More', icon: 'grid' as IconName }] : []),
  ];

  const activeTop =
    tabItems.includes(current) || extras.includes(current) ? current : 'more';

  return (
    <nav ref={navRef} className="hca-sidebar" aria-label="Main navigation">
      {/* App brand */}
      <div
        ref={headerRef}
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
        {/* Customize lives in More; when More is hidden this is the way in. */}
        {!showMore && (
          <button
            type="button"
            onClick={() => go('customize')}
            aria-label="Customize tab bar"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text3)',
              padding: 4,
              display: 'flex',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon name="grid" size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      {items.map((item) => {
        const on = activeTop === item.id;
        return (
          <button
            key={item.id}
            data-nav-row
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
