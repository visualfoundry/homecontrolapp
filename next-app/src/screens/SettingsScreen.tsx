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

function InstallAppCard() {
  const [installed, setInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<Event & { prompt(): Promise<void> } | null>(null);
  const [prompted, setPrompted] = React.useState(false);

  React.useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt(): Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>✓</span>
          <span style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.4 }}>
            App is installed and running in standalone mode.
          </span>
        </div>
      </Card>
    );
  }

  if (isIos) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
          In Safari, tap the{' '}
          <strong style={{ color: 'var(--text)' }}>Share</strong> button
          {' '}(the box with an arrow), then choose{' '}
          <strong style={{ color: 'var(--text)' }}>Add to Home Screen</strong>.
          The app will open full-screen without the browser bar.
        </p>
      </Card>
    );
  }

  if (deferredPrompt && !prompted) {
    return (
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
            Install Home Control as an app for quick access from your home screen.
          </p>
          <button
            onClick={() => {
              deferredPrompt.prompt();
              setPrompted(true);
            }}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'center',
            }}
          >
            Install App
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
        Open this page in your device&apos;s browser and use the browser menu to add it to your home screen.
      </p>
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
        <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, alignSelf: 'stretch' }}>
          <li>Scan the QR code with your camera, then tap the link to open it in <strong style={{ color: 'var(--text)' }}>Safari</strong>.</li>
          <li>Tap <strong style={{ color: 'var(--text)' }}>Allow</strong> when prompted to download the profile.</li>
          <li>Go to <strong style={{ color: 'var(--text)' }}>Settings → General → VPN &amp; Device Management</strong>, tap the profile, then tap <strong style={{ color: 'var(--text)' }}>Install</strong>.</li>
          <li>Go to <strong style={{ color: 'var(--text)' }}>Settings → General → About → Certificate Trust Settings</strong> and enable full trust for the mkcert certificate.</li>
        </ol>
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
        <SectionTitle>Install App</SectionTitle>
        <InstallAppCard />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Install Certificate</SectionTitle>
        <CertInstallCard />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Account</SectionTitle>
        <Card pad={false}>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.reload();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 16px',
              textAlign: 'left',
              fontSize: 16,
              fontWeight: 520,
              color: 'var(--red)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Sign Out
          </button>
        </Card>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
