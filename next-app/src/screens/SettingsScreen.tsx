'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useHC, loadNotifPrefs, saveNotifPrefs } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { PushPermission } from '@/components/PushPermission';
import { pillBtn } from '@/lib/styles';
import {
  locationPermission, currentPosition, reportLocation,
  type Permissionish,
} from '@/components/PresenceReporter';
import type { FlagState } from '@/types/state';
import type { SettingItem, UserPrefs, NotificationPrefs } from '@/types/config';

const THEME_OPTIONS = ['Light', 'Dark', 'System'] as const;
const THEME_TO_LABEL: Record<UserPrefs['theme'], string> = {
  light: 'Light', dark: 'Dark', system: 'System',
};
const LABEL_TO_THEME: Record<string, UserPrefs['theme']> = {
  Light: 'light', Dark: 'dark', System: 'system',
};

function NotifRow({
  label,
  description,
  on,
  onChange,
  last,
}: {
  label: string;
  description: string;
  on: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12,
      borderBottom: last ? 'none' : '0.5px solid var(--sep)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{description}</div>
      </div>
      <Toggle on={on} onChange={onChange} size={0.85} />
    </div>
  );
}

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
  const [certUrl, setCertUrl] = React.useState('http://app.dixons.net/mkcert-ca.pem');
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


// ---------------------------------------------------------------------------
// Presence links — the geofence webhook per person
//
// Each person gets one secret URL. Their phone's own automation (iOS Shortcuts:
// Automation → "When I arrive Home" → Get Contents of URL) calls it, and the app
// writes that person's EISY variable — the same variable Locative used to set
// through the ISY Portal, so nothing downstream of it changes.
// ---------------------------------------------------------------------------

/** Two actions have to share a phone-width row with a name and a status line. */
const smallPill: React.CSSProperties = {
  ...pillBtn, flexShrink: 0, fontSize: 13, fontWeight: 620, padding: '7px 12px',
};

interface WifiClient { mac: string; name: string }

/** Assign each person's phone, so Wi-Fi presence knows whose it is. */
function DeviceAssignment({ people }: { people: Array<{ personId: string; name: string }> }) {
  const [clients, setClients] = React.useState<WifiClient[] | null>(null);
  const [assigned, setAssigned] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch('/api/presence/clients')
      .then(r => r.json())
      .then((d: { clients: WifiClient[]; assigned: Record<string, string[]>; error: string | null }) => {
        setClients(d.clients ?? []);
        setAssigned(d.assigned ?? {});
        setError(d.error);
      })
      .catch(() => setError('Could not read the client list'));
  }, []);
  React.useEffect(load, [load]);

  async function toggleMac(personId: string, mac: string) {
    const current = assigned[personId] ?? [];
    const next = current.includes(mac) ? current.filter(m => m !== mac) : [...current, mac];
    setAssigned({ ...assigned, [personId]: next });
    await fetch('/api/presence/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, macs: next }),
    }).catch(() => {});
    load();
  }

  if (clients === null && !error) return null;

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Wi-Fi presence</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>
        A phone on the house Wi-Fi counts as home, with the app closed and nothing set
        up on the phone. Assign each person&apos;s device below.
      </div>
      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 8, lineHeight: 1.45 }}>
          {error}
        </div>
      )}
      {clients && clients.length > 0 && people.map(p => {
        const macs = assigned[p.personId] ?? [];
        return (
          <div key={p.personId} style={{ marginTop: 12 }}>
            <button onClick={() => setOpen(open === p.personId ? null : p.personId)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {p.name}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                {macs.length ? `${macs.length} device${macs.length > 1 ? 's' : ''}` : 'none'}
              </span>
              <Icon name={open === p.personId ? 'chevDown' : 'chevron'} size={16} />
            </button>
            {open === p.personId && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {clients.map(c => {
                  const on = macs.includes(c.mac);
                  return (
                    <button key={c.mac} onClick={() => toggleMac(p.personId, c.mac)}
                      aria-pressed={on}
                      style={{
                        ...smallPill,
                        background: on ? 'var(--accent)' : 'var(--icon-bg)',
                        color: on ? '#fff' : 'var(--text)',
                      }}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

interface PresenceRow {
  personId: string;
  name: string;
  token: string | null;
  last: { home: boolean; source: string; at: number; distance?: number } | null;
}

function ago(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/**
 * The app's own half of presence. No switch: reporting is always on, and the
 * browser's location permission is the only thing that decides whether it can
 * happen — so this shows that state and offers the two actions that need a
 * deliberate tap (granting, and defining where home is).
 */
function PresenceFromApp({ hasHome, onChange }: { hasHome: boolean; onChange: () => void }) {
  const [perm, setPerm] = React.useState<Permissionish>('unknown');
  const [status, setStatus] = React.useState('');

  const refresh = React.useCallback(() => { void locationPermission().then(setPerm); }, []);
  React.useEffect(refresh, [refresh]);

  async function allow() {
    setStatus('Asking…');
    const r = await reportLocation();
    refresh();
    setStatus(r.ok
      ? `Reported ${r.person ?? ''} ${r.home ? 'home' : 'away'}${r.distance !== undefined ? ` (${r.distance} m)` : ''}`
      : (r.error ?? 'Could not report'));
    setTimeout(() => setStatus(''), 4_000);
    onChange();
  }

  async function setHome() {
    setStatus('Reading location…');
    const position = await currentPosition(true);
    if (!position) { setStatus('Location unavailable'); refresh(); return; }
    const res = await fetch('/api/presence/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        setHome: true,
      }),
    }).catch(() => null);
    setStatus(res?.ok ? 'Home location saved' : 'Could not save');
    setTimeout(() => setStatus(''), 4_000);
    refresh();
    onChange();
  }

  const permLabel = perm === 'granted' ? 'Location allowed'
    : perm === 'denied' ? 'Location denied — enable it for this app in Settings'
    : 'Location not granted yet';

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
        This app reports your location when you open it
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>
        Corrects presence every time the app is opened. Arriving and leaving while the
        app is closed still needs each person&apos;s link below in a phone automation.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {perm !== 'granted' && (
          <button onClick={allow} style={smallPill}>Allow location</button>
        )}
        <button onClick={setHome} style={{ ...smallPill, background: 'var(--icon-bg)', color: 'var(--text)' }}>
          Set home to here
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
          {status || `${permLabel} · ${hasHome ? 'home location set' : 'no home location yet'}`}
        </span>
      </div>
    </Card>
  );
}

function PresenceLinks() {
  const [rows, setRows] = React.useState<PresenceRow[] | null>(null);
  const [hasHome, setHasHome] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch('/api/presence')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d: { people: PresenceRow[]; home: { radius: number } | null }) => {
        setRows(d.people);
        setHasHome(d.home !== null);
      })
      .catch(() => setRows([]));
  }, []);
  React.useEffect(load, [load]);

  async function mint(personId: string) {
    setBusy(personId);
    await fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId }),
    }).catch(() => {});
    setBusy(null);
    load();
  }

  async function revoke(personId: string) {
    setBusy(personId);
    await fetch('/api/presence', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId }),
    }).catch(() => {});
    setBusy(null);
    load();
  }

  function copy(token: string, personId: string) {
    // Two URLs — arriving and leaving — since that is what a Shortcut needs.
    const base = `${window.location.origin}/api/presence/${token}`;
    const text = `Arrive: ${base}?home=1\nLeave:  ${base}?home=0`;
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(personId); setTimeout(() => setCopied(null), 2_500); },
      () => {},
    );
  }

  if (rows === null) {
    return <Card><span style={{ fontSize: 14, color: 'var(--text2)' }}>Loading…</span></Card>;
  }
  if (rows.length === 0) {
    return <Card><span style={{ fontSize: 14, color: 'var(--text2)' }}>No people configured.</span></Card>;
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <PresenceFromApp hasHome={hasHome} onChange={load} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <DeviceAssignment people={rows.map(r => ({ personId: r.personId, name: r.name }))} />
      </div>
    <Card pad={false}>
      {rows.map((r, i) => (
        <div key={r.personId} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          borderTop: i === 0 ? 'none' : '0.5px solid var(--sep)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
              {r.last
                ? `${r.last.home ? 'Home' : 'Away'} · ${r.last.source} · ${ago(r.last.at)}`
                : r.token ? 'Link ready — no report yet' : 'No link'}
            </div>
          </div>
          {r.token ? (
            <>
              <button onClick={() => copy(r.token!, r.personId)} style={smallPill}>
                {copied === r.personId ? 'Copied' : 'Copy links'}
              </button>
              <button onClick={() => revoke(r.personId)} disabled={busy === r.personId}
                style={{ ...smallPill, background: 'var(--icon-bg)', color: 'var(--red)' }}>
                Revoke
              </button>
            </>
          ) : (
            <button onClick={() => mint(r.personId)} disabled={busy === r.personId}
              style={smallPill}>
              {busy === r.personId ? '…' : 'Create link'}
            </button>
          )}
        </div>
      ))}
      </Card>
    </>
  );
}

export function SettingsScreen() {
  const { prefs, setPrefs, config } = useHC();
  const [notifPrefs, setNotifPrefsState] = React.useState<NotificationPrefs>(loadNotifPrefs);

  function setNotifPref<K extends keyof NotificationPrefs>(key: K, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefsState(updated);
    saveNotifPrefs(updated);
  }

  const hasLeak   = config.leakSensors.length > 0;
  const hasMotion = config.motionSensors.length > 0;
  const hasDoors  = config.doorsExterior.length > 0 || config.doorsInterior.length > 0;

  const safetyRows = [
    hasLeak   && { key: 'leak'   as const, label: 'Water Leaks',     desc: 'Alert when a sensor detects water' },
    hasMotion && { key: 'motion' as const, label: 'Motion Detected',  desc: 'Alert when a motion sensor activates' },
    hasDoors  && { key: 'doors'  as const, label: 'Doors & Locks',    desc: 'Alert when a door opens, closes, or lock state changes' },
  ].filter(Boolean) as { key: keyof NotificationPrefs; label: string; desc: string }[];

  const statusRows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: 'houseSecurity', label: 'House Security', desc: 'Alert when House Security is armed or disarmed' },
    { key: 'whoIsHome',     label: "Who's Home",     desc: "Alert when someone's presence status changes" },
    { key: 'houseMode',     label: 'House Mode',     desc: 'Alert when the time-of-day mode changes (Morning, Day, Evening, Night)' },
  ];

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
        <SectionTitle>Presence Links</SectionTitle>
        <PresenceLinks />
      </div>

      {safetyRows.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle>Notifications — Safety</SectionTitle>
          <Card pad={false}>
            {safetyRows.map((row, i) => (
              <NotifRow
                key={row.key}
                label={row.label}
                description={row.desc}
                on={notifPrefs[row.key]}
                onChange={(v) => setNotifPref(row.key, v)}
                last={i === safetyRows.length - 1}
              />
            ))}
          </Card>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Notifications — Status &amp; Presence</SectionTitle>
        <Card pad={false}>
          {statusRows.map((row, i) => (
            <NotifRow
              key={row.key}
              label={row.label}
              description={row.desc}
              on={notifPrefs[row.key]}
              onChange={(v) => setNotifPref(row.key, v)}
              last={i === statusRows.length - 1}
            />
          ))}
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Notifications — Device Alerts</SectionTitle>
        <Card pad={false}>
          <PushPermission last />
        </Card>
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
