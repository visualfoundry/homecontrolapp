'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import type { FlagState } from '@/types/state';
import type { SettingItem } from '@/types/config';

function ControlRow({
  item,
  on,
  onToggle,
  icon,
  last,
}: {
  item: SettingItem;
  on: boolean;
  onToggle: () => void;
  icon: string;
  last: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '13px 16px',
      borderBottom: last ? 'none' : '0.5px solid var(--sep)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: on ? 'var(--green)22' : 'var(--icon-bg)',
        color: on ? 'var(--green)' : 'var(--text2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 13, flex: '0 0 auto',
      }}>
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} />
      </div>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>
        {item.name}
      </span>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

export function WhosHomeScreen() {
  const { st, setD, config } = useHC();

  const presence = config.whoIsHome.filter(s => /at home|car at home/i.test(s.name));
  const security = config.whoIsHome.filter(s => !/at home|car at home/i.test(s.name));

  const homeCount = presence.filter(s => (st[s.id] as FlagState | undefined)?.on).length;

  const renderRows = (items: SettingItem[], iconFn: (name: string) => string) =>
    items.map((s, i) => {
      const on = (st[s.id] as FlagState | undefined)?.on ?? false;
      return (
        <ControlRow
          key={s.id}
          item={s}
          on={on}
          onToggle={() => setD(s.id, { on: !on })}
          icon={iconFn(s.name)}
          last={i === items.length - 1}
        />
      );
    });

  const presenceIcon = () => 'person';
  const securityIcon = (name: string) => {
    if (/water/i.test(name)) return 'droplet';
    return 'shield';
  };

  return (
    <div>
      <LargeTitle
        title="Who's Home"
        sub={homeCount === 0
          ? 'Nobody home'
          : `${homeCount} ${homeCount === 1 ? 'person' : 'people'} home`}
      />

      {presence.length > 0 && (
        <>
          <SectionTitle>Presence</SectionTitle>
          <Card pad={false}>{renderRows(presence, presenceIcon)}</Card>
        </>
      )}

      {security.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle>Security</SectionTitle>
          <Card pad={false}>{renderRows(security, securityIcon)}</Card>
        </div>
      )}
    </div>
  );
}
