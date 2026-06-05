'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import type { IconName } from '@/components/Icon';

export function MoreScreen() {
  const { go, prefs, sections } = useHC();
  const ids = Object.keys(sections).filter(id => !prefs.tabs.includes(id));

  return (
    <div>
      <LargeTitle title="More"
        right={
          <button onClick={() => go('customize')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent)', fontSize: 16, fontWeight: 620, padding: 0,
          }}>Edit</button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ids.map(id => {
          const it = sections[id];
          return (
            <Card key={id} onClick={() => go(id)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '17px 16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: it.tint + '22', color: it.tint,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={it.icon as IconName} size={23} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 620, color: 'var(--text)' }}>{it.name}</span>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={() => go('customize')} style={{
          width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          color: 'var(--accent)', fontSize: 15.5, fontWeight: 620,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <Icon name="grid" size={20} /> Customize Tab Bar
        </button>
      </div>
    </div>
  );
}
