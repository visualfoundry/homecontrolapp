'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';

export function CustomizeScreen() {
  const { prefs, setPrefs, sections, maxTabs } = useHC();
  const tabs = prefs.tabs;
  const more = Object.keys(sections).filter(id => !tabs.includes(id));
  const full = tabs.length >= maxTabs;

  const add = (id: string) => { if (!full) setPrefs({ tabs: [...tabs, id] }); };
  const remove = (id: string) => { if (tabs.length > 1) setPrefs({ tabs: tabs.filter(x => x !== id) }); };
  const move = (id: string, dir: -1 | 1) => {
    const i = tabs.indexOf(id), j = i + dir;
    if (j < 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    setPrefs({ tabs: next });
  };

  const iconChip = (id: string) => {
    const it = sections[id];
    return (
      <div style={{ width: 38, height: 38, borderRadius: 11, background: it.tint + '22', color: it.tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={it.icon as IconName} size={21} />
      </div>
    );
  };

  const roundBtn = (
    children: React.ReactNode,
    onClick: () => void,
    disabled: boolean,
    color?: string,
  ) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 16, border: 'none', flexShrink: 0,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'var(--icon-bg)' : (color ?? 'var(--icon-bg)'),
      color: disabled ? 'var(--text3)' : (color ? '#fff' : 'var(--text)'),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.45 : 1, WebkitTapHighlightColor: 'transparent',
    }}>{children}</button>
  );

  return (
    <div>
      <LargeTitle title="Customize"
        sub={`Up to ${maxTabs} shortcuts on the bar · More is always last`} />

      <SectionTitle>On the Tab Bar</SectionTitle>
      <Card pad={false}>
        {tabs.map((id, i) => {
          const it = sections[id];
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '0.5px solid var(--sep)' }}>
              {iconChip(id)}
              <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>{it.name}</span>
              <div style={{ display: 'flex', gap: 6, marginRight: 4 }}>
                {roundBtn(
                  <Icon name="chevDown" size={17} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} />,
                  () => move(id, -1), i === 0,
                )}
                {roundBtn(
                  <Icon name="chevDown" size={17} strokeWidth={2.4} />,
                  () => move(id, 1), i === tabs.length - 1,
                )}
              </div>
              {roundBtn(
                <Icon name="minus" size={18} strokeWidth={2.6} />,
                () => remove(id), tabs.length <= 1, 'var(--red)',
              )}
            </div>
          );
        })}
        {/* More — pinned, not removable */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', opacity: 0.6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--icon-bg)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="grid" size={21} />
          </div>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>More</span>
          <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--text3)', marginRight: 6 }}>Pinned</span>
        </div>
      </Card>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>{full ? 'In More · bar is full' : 'In More · tap + to add'}</SectionTitle>
        <Card pad={false}>
          {more.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 15 }}>
              Everything is on the tab bar.
            </div>
          )}
          {more.map((id, i) => {
            const it = sections[id];
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < more.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {iconChip(id)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>{it.name}</span>
                {roundBtn(
                  <Icon name="plus" size={18} strokeWidth={2.6} />,
                  () => add(id), full, full ? undefined : 'var(--green)',
                )}
              </div>
            );
          })}
        </Card>
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}
