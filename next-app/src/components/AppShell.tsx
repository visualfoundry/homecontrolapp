'use client';

// =============================================================================
// AppShell — top-level app container
//
// Responsibilities:
//   - Wraps everything in HCProvider (store + nav + prefs)
//   - Applies data-theme, dynamic CSS var overrides (done in store)
//   - Renders the correct screen from the nav stack
//   - Renders the TabBar
//   - Shows BackButton on secondary screens
//   - Provides the overlay host ref for bottom-sheet portals
//
// Screen map: populated with real screens as each milestone lands.
// Currently renders a placeholder for all screen ids.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { HCProvider, useHC } from '@/lib/store';
import { SpotifyProvider } from '@/lib/spotify-context';
import { MiniPlayer } from '@/components/MiniPlayer';
import { TabBar } from '@/components/TabBar';
import { Sidebar } from '@/components/Sidebar';
import { BackButton } from '@/components/BackButton';
import { isTabSlot } from '@/lib/sections';
import type { AppConfig } from '@/types/config';
import { HomeScreen } from '@/screens/HomeScreen';
import { LightsScreen } from '@/screens/LightsScreen';
import { DoorsScreen } from '@/screens/DoorsScreen';
import { GarageScreen } from '@/screens/GarageScreen';
import { ClimateScreen } from '@/screens/ClimateScreen';
import { PoolScreen } from '@/screens/PoolScreen';
import { MusicScreen } from '@/screens/MusicScreen';
import { FansScreen } from '@/screens/FansScreen';
import { IrrigationScreen } from '@/screens/IrrigationScreen';
import { LeakScreen } from '@/screens/LeakScreen';
import { MotionScreen } from '@/screens/MotionScreen';
import { OutdoorsScreen } from '@/screens/OutdoorsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import { CustomizeScreen } from '@/screens/CustomizeScreen';
import { ScenesScreen } from '@/screens/ScenesScreen';
import { EditFavoritesScreen } from '@/screens/EditFavoritesScreen';
import { EditScenesScreen } from '@/screens/EditScenesScreen';
import { DocsScreen } from '@/screens/DocsScreen';
import { CinemaScreen } from '@/screens/CinemaScreen';
import { WhosHomeScreen } from '@/screens/WhosHomeScreen';
import { TVScreen } from '@/screens/TVScreen';
import { CamerasScreen } from '@/screens/CamerasScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { RoomScreen } from '@/screens/RoomScreen';

// ---------------------------------------------------------------------------
// Placeholder screen — removed when real screens land in Milestone 4
// ---------------------------------------------------------------------------

function PlaceholderScreen({ id }: { id: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        padding: 'var(--screen-px)',
      }}
    >
      <p style={{ fontSize: 20, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.4 }}>
        {id.charAt(0).toUpperCase() + id.slice(1)}
      </p>
      <p style={{ fontSize: 14, color: 'var(--text2)' }}>Screen coming in Milestone 4</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen registry — import and register real screens here as they're built
// ---------------------------------------------------------------------------

const SCREEN_COMPONENTS: Record<string, React.FC> = {
  home:       HomeScreen,
  lights:     LightsScreen,
  doors:      DoorsScreen,
  garage:     GarageScreen,
  climate:    ClimateScreen,
  pool:       PoolScreen,
  music:      MusicScreen,
  fans:       FansScreen,
  tv:         TVScreen,
  irrigation: IrrigationScreen,
  leak:       LeakScreen,
  motion:     MotionScreen,
  outdoors:   OutdoorsScreen,
  cinema:     CinemaScreen,
  whoshome:   WhosHomeScreen,
  settings:   SettingsScreen,
  more:       MoreScreen,
  customize:  CustomizeScreen,
  scenes:     ScenesScreen,
  editfav:    EditFavoritesScreen,
  editscenes: EditScenesScreen,
  docs:          DocsScreen,
  cameras:       CamerasScreen,
  notifications: NotificationsScreen,
};

function ScreenRenderer({ id }: { id: string }) {
  // Per-place room pages: "room:<place>". Garage keeps its bespoke page.
  if (id.startsWith('room:')) {
    const place = id.slice(5);
    return place === 'Garage' ? <GarageScreen /> : <RoomScreen place={place} />;
  }
  const Screen = SCREEN_COMPONENTS[id];
  if (Screen) return <Screen />;
  return <PlaceholderScreen id={id} />;
}

// ---------------------------------------------------------------------------
// Inner shell — consumes the store (must be inside HCProvider)
// ---------------------------------------------------------------------------

function Shell() {
  const { stack, prefs, go, overlayRef } = useHC();
  const current = stack[stack.length - 1];
  const showBack = !isTabSlot(current, prefs.tabs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top on screen change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [current]);

  const dark = prefs.theme === 'dark';

  return (
    <div className="hca-shell">
      {/* Sidebar — hidden on phone, visible on tablet via CSS */}
      <Sidebar current={current} tabs={prefs.tabs} go={go} dark={dark} />

      {/* Main content column */}
      <div className="hca-shell-main">
        {/* Back button for secondary screens */}
        {showBack && <BackButton />}

        {/* Scrollable screen content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingTop: showBack ? 90 : 56,
            paddingBottom: 24,
            paddingLeft: 'var(--screen-px)',
            paddingRight: 'var(--screen-px)',
            scrollbarWidth: 'none',
          }}
        >
          <ScreenRenderer id={current} />
        </div>

        {/* Mini player — hidden on Music screen; MiniPlayer handles its own null state */}
        {current !== 'music' && <MiniPlayer />}

        {/* Tab bar — hidden on tablet via CSS (.hca-tab-bar-phone) */}
        <div className="hca-tab-bar-phone">
          <TabBar
            current={current}
            tabs={prefs.tabs}
            go={go}
            dark={dark}
          />
        </div>

        {/* Overlay host — portal target for bottom sheets (z-index 90) */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 90,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — wraps Shell in HCProvider
// ---------------------------------------------------------------------------

export function AppShell({ config }: { config: AppConfig }) {
  return (
    <HCProvider config={config}>
      <SpotifyProvider>
        <Shell />
      </SpotifyProvider>
    </HCProvider>
  );
}
