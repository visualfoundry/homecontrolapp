'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { LargeTitle } from '@/components/LargeTitle';
import type { FlagState } from '@/types/state';
import type { SettingItem } from '@/types/config';

function ToggleList({ items }: { items: SettingItem[] }) {
  const { st, setD } = useHC();
  return (
    <Card pad={false}>
      {items.map((it, i) => {
        const s = st[it.id] as FlagState | undefined;
        return (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
            borderBottom: i < items.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{it.name}</span>
            <Toggle on={s?.on ?? false} onChange={(v) => setD(it.id, { on: v })} size={0.85} />
          </div>
        );
      })}
    </Card>
  );
}

export function SettingsScreen() {
  const { prefs, setPrefs, config } = useHC();

  return (
    <div>
      <LargeTitle title="Settings" />

      <SectionTitle>Appearance</SectionTitle>
      <Card pad={false}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
            <Icon name="moon" size={19} />
          </div>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>Dark Mode</span>
          <Toggle
            on={prefs.theme === 'dark'}
            onChange={(v) => setPrefs({ theme: v ? 'dark' : 'light' })}
            size={0.85}
          />
        </div>
      </Card>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Security</SectionTitle>
        <ToggleList items={config.settingsSecurity} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Environment</SectionTitle>
        <ToggleList items={config.settingsEnvironment} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Schedules</SectionTitle>
        <ToggleList items={config.settingsSchedules} />
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
