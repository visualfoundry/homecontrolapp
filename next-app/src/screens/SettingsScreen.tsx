'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import type { FlagState } from '@/types/state';
import type { SettingItem, UserPrefs } from '@/types/config';

const THEME_OPTIONS = ['Light', 'Dark', 'System'] as const;
const THEME_TO_LABEL: Record<UserPrefs['theme'], string> = {
  light: 'Light', dark: 'Dark', system: 'System',
};
const LABEL_TO_THEME: Record<string, UserPrefs['theme']> = {
  Light: 'light', Dark: 'dark', System: 'system',
};

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

function CertInstallCard() {
  const [certUrl, setCertUrl] = React.useState('http://192.168.1.91/mkcert-ca.pem');
  React.useEffect(() => {
    setCertUrl(`http://${window.location.hostname}/mkcert-ca.pem`);
  }, []);

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }}>
          To use this app on an iOS device, install the security certificate once in Safari.
        </p>
        <div style={{ padding: 12, background: '#fff', borderRadius: 10 }}>
          <QRCodeSVG value={certUrl} size={160} />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }}>
          Scan with your iPhone or iPad camera, then open in Safari.
          Follow the prompts to download and install the profile, then
          enable full trust in{' '}
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
            Settings → General → About → Certificate Trust Settings
          </strong>.
        </p>
        <a
          href={certUrl}
          style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}
        >
          {certUrl}
        </a>
      </div>
    </Card>
  );
}

export function SettingsScreen() {
  const { prefs, setPrefs, config } = useHC();

  return (
    <div>
      <LargeTitle title="Settings" />

      <SectionTitle>Security</SectionTitle>
      <ToggleList items={config.settingsSecurity} />

      <div style={{ marginTop: 22 }}>
        <SectionTitle>House Settings</SectionTitle>
        <ToggleList items={config.settingsHouse} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Environment</SectionTitle>
        <ToggleList items={config.settingsEnvironment} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Schedules</SectionTitle>
        <ToggleList items={config.settingsSchedules} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Appearance</SectionTitle>
        <Card pad={false}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 13 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: 'var(--text2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="moon" size={19} />
            </div>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>Theme</span>
            <div style={{ width: 200, flexShrink: 0 }}>
              <Segmented
                aria-label="Theme"
                options={[...THEME_OPTIONS]}
                value={THEME_TO_LABEL[prefs.theme]}
                onChange={(label) => setPrefs({ theme: LABEL_TO_THEME[label] })}
              />
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Install Certificate</SectionTitle>
        <CertInstallCard />
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
