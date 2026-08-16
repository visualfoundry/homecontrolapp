'use client';

import React from 'react';
import { LargeTitle } from '@/components/LargeTitle';
import { Icon } from '@/components/Icon';

export function NotificationsScreen() {
  return (
    <div>
      <LargeTitle title="Notifications" />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, marginTop: 64, color: 'var(--text3)',
      }}>
        <Icon name="bell" size={48} strokeWidth={1.3} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text2)' }}>
          No notifications yet
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
          Alert preferences have moved to Settings.
        </p>
      </div>
    </div>
  );
}
