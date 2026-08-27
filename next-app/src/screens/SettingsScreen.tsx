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

/** The house network, named so the Wi-Fi step can be followed without guessing.
 *  Only used as copy — nothing keys off it. */
const HOUSE_SSID = 'The Dixons Net';

/** One numbered step of the setup walkthrough. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 12, alignItems: 'start' }}>
      <span
        aria-hidden
        style={{
          width: 26, height: 26, borderRadius: 13, background: 'var(--accent)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, marginTop: 1,
        }}
      >
        {n}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 620, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55 }}>{children}</div>
      </div>
    </li>
  );
}

const B = ({ children }: { children: React.ReactNode }) => (
  <strong style={{ color: 'var(--text)' }}>{children}</strong>
);

/**
 * Everything a new phone needs, in the order it has to happen.
 *
 * This used to be two cards — certificate and install — and the two steps that
 * actually cause trouble were in neither. The Wi-Fi address setting is first
 * because it is the one that fails silently: skip it and the phone still works
 * perfectly, but its address rotates within days and presence reports that person
 * away with nothing to show why. The device assignment is last because it can only
 * be done once the phone has joined the network at least once.
 */
function DeviceSetupCard() {
  const [certUrl, setCertUrl] = React.useState('http://app.dixons.net/mkcert-ca.pem');
  const [installed, setInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<Event & { prompt(): Promise<void> } | null>(null);
  const [prompted, setPrompted] = React.useState(false);

  React.useEffect(() => {
    setCertUrl(`http://${window.location.hostname}/mkcert-ca.pem`);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt(): Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <Card>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <Step n={1} title="Turn off the private Wi-Fi address">
          On the phone: <B>Settings → Wi-Fi</B>, tap the <B>ⓘ</B> beside{' '}
          <B>{HOUSE_SSID}</B>, and set <B>Private Wi-Fi Address</B> to <B>Off</B>.
          <div style={{ marginTop: 6 }}>
            This is per-network — every other Wi-Fi network stays private, so nothing
            changes in cafés or hotels. Without it the phone changes address every few
            days and the house stops recognising it. Leave{' '}
            <B>Limit IP Address Tracking</B> switched on; it is unrelated.
          </div>
          <div style={{ marginTop: 6 }}>
            On Android: <B>Wi-Fi → {HOUSE_SSID} → Privacy → Use device MAC</B>.
          </div>
        </Step>

        <Step n={2} title="Install the security certificate">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '8px 0 10px' }}>
            <div style={{ padding: 12, background: '#fff', borderRadius: 10 }}>
              <QRCodeSVG value={certUrl} size={150} />
            </div>
            <a
              href={certUrl}
              style={{ fontSize: 11.5, color: 'var(--accent)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center' }}
            >
              {certUrl}
            </a>
          </div>
          <ol style={{ margin: 0, padding: '0 0 0 17px', lineHeight: 1.65 }}>
            <li>Scan the code with the camera, then open the link in <B>Safari</B>.</li>
            <li>Tap <B>Allow</B> to download the profile.</li>
            <li><B>Settings → General → VPN &amp; Device Management</B>, tap the profile, tap <B>Install</B>.</li>
            <li><B>Settings → General → About → Certificate Trust Settings</B>, and turn on full trust for mkcert.</li>
          </ol>
        </Step>

        <Step n={3} title="Add the app to the home screen">
          {installed ? (
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ Already installed on this device.</span>
          ) : isIos ? (
            <>
              In Safari, tap <B>Share</B> (the box with an arrow), then{' '}
              <B>Add to Home Screen</B>. It opens full-screen with no browser bar, and
              push notifications only work once it is installed.
            </>
          ) : deferredPrompt && !prompted ? (
            <>
              <div style={{ marginBottom: 10 }}>Install Home Control for quick access from the home screen.</div>
              <button
                onClick={() => { deferredPrompt.prompt(); setPrompted(true); }}
                style={{
                  padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Install App
              </button>
            </>
          ) : (
            <>Open this page in the device&rsquo;s browser and use the browser menu to add it to the home screen.</>
          )}
        </Step>

        <Step n={4} title="Sign in and turn on Face ID">
          Open the installed app and sign in with the person&rsquo;s WordPress account.
          It then offers to save a passkey — accept, and from then on it is Face ID
          rather than a password. Passkeys belong to one device, so this happens again
          on each new phone.
        </Step>

        <Step n={5} title="Assign the phone to a person">
          Last, because the phone has to have joined the Wi-Fi at least once to appear.
          In <B>Settings → Presence Links → Wi-Fi presence</B> on an account that can
          reach it, tick the new phone against its owner — and untick the phone it
          replaces, whose address is now dead.
          <div style={{ marginTop: 6 }}>
            Until this is done that person will read as away whenever they are out of
            reach of the geofence, however well the rest of the setup went.
          </div>
        </Step>

      </ol>
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

interface WifiClient { mac: string; name: string; personal: boolean }

/** Assign each person's phone, so Wi-Fi presence knows whose it is. */
function DeviceAssignment({ people }: { people: Array<{ personId: string; name: string }> }) {
  const [clients, setClients] = React.useState<WifiClient[] | null>(null);
  const [assigned, setAssigned] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  // Forty clients, five of which are phones. Showing the TVs, plugs and garage
  // doors by default would bury the ones anybody would ever pick.
  const [showAll, setShowAll] = React.useState(false);

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
      {clients && clients.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button onClick={() => setShowAll(!showAll)}
            style={{ ...smallPill, background: 'var(--icon-bg)', color: 'var(--text)' }}>
            {showAll ? 'Phones only' : `Show all ${clients.length}`}
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>
            {showAll
              ? 'Every wireless client'
              : `${clients.filter(c => c.personal).length} phones and tablets`}
          </span>
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
                {clients.filter(c => showAll || c.personal || macs.includes(c.mac)).map(c => {
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
 *
 * "Allow location" is the one place allowed to re-open the OS prompt. The
 * reporter itself opens it once per install and never again, so this button is
 * the way back from a denial or a dismissed sheet.
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
    setStatus(!r.ok
      ? (r.error ?? 'Could not report')
      : r.unchanged
        // Outside the fence, but by less than the fix's own margin of error.
        ? `Location too rough to judge (${r.distance} m ±${r.accuracy} m) — presence left as it was`
        : `Reported ${r.person ?? ''} ${r.home ? 'home' : 'away'}${r.distance !== undefined ? ` (${r.distance} m)` : ''}`);
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
        This app reports your location while it&apos;s open
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>
        Asked for once, then it keeps presence right for as long as the app is in front
        of you. Arriving and leaving while the app is closed still needs each
        person&apos;s link below in a phone automation.
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
        <SectionTitle>Set Up a New Device</SectionTitle>
        <DeviceSetupCard />
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
