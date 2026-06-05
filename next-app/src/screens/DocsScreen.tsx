'use client';

import React from 'react';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';

const GENERAL = [
  'Home Climate', 'Music', 'Pet Care', 'Deliveries & Home Services',
  'Swimming Pool', 'General TVs', 'Living Room TV', 'Cinema',
  'Irrigation & Watering', 'Lighting', 'Contacts', 'Security', 'Overview',
];
const FAMILY = ['Manuals', 'Inventory', 'Services & Maintenance'];

function DocList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle>{title}</SectionTitle>
      <Card pad={false}>
        {items.map((d, i) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px',
            borderBottom: i < items.length - 1 ? '0.5px solid var(--sep)' : 'none', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{d}</span>
            <span style={{ color: 'var(--text3)', display: 'flex' }}><Icon name="chevron" size={17} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function DocsScreen() {
  return (
    <div>
      <LargeTitle title="Documentation" />
      <DocList title="General Documents" items={GENERAL} />
      <DocList title="Family Only" items={FAMILY} />
      <div style={{ height: 8 }} />
    </div>
  );
}
