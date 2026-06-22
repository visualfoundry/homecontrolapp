'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn, reorderBtn } from '@/lib/styles';
import type { ScenesListState } from '@/types/state';
import type { SceneConfig } from '@/types/config';

function envIcon(name: string): { icon: IconName; tint: string } {
  const n = name.toLowerCase();
  if (n.includes('temp'))       return { icon: 'thermo',     tint: '#E07B53' };
  if (n.includes('humid'))      return { icon: 'droplet',    tint: '#5B7FE0' };
  if (n.includes('holiday'))    return { icon: 'calendar',   tint: '#9B6AB0' };
  if (n.includes('security'))   return { icon: 'shield',     tint: '#E0483D' };
  if (n.includes('away'))       return { icon: 'away',       tint: '#F0A500' };
  if (n.includes('movie'))      return { icon: 'film',       tint: '#6C5CE7' };
  if (n.includes('pool party')) return { icon: 'poolParty',  tint: '#00AAFF' };
  return { icon: 'bolt', tint: '#2bb3a3' };
}

export function EditScenesScreen() {
  const { st, setD, back, config } = useHC();
  const ids = (st['_scenes'] as ScenesListState).ids;

  const sceneById: Record<string, SceneConfig> = {};
  config.scenes.forEach(s => { sceneById[s.id] = s; });

  const envById: Record<string, { id: string; name: string }> = {};
  config.environmentalControls.forEach(e => { envById[e.id] = e; });

  const setIds = (next: string[]) => setD('_scenes', { ids: next });
  const remove = (id: string) => setIds(ids.filter(x => x !== id));
  const add = (id: string) => setIds([...ids, id]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  const circleBtn = (color: string, name: IconName, onClick: () => void) => (
    <button onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 13, border: 'none', flex: '0 0 auto',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: color, color: '#fff', WebkitTapHighlightColor: 'transparent',
    }}>
      <Icon name={name} size={16} strokeWidth={2.6} />
    </button>
  );

  const sceneChip = (sc: SceneConfig) => (
    <div style={{ width: 30, height: 30, borderRadius: 9, background: sc.tint + '1f', color: sc.tint,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <Icon name={sc.icon as IconName} size={18} />
    </div>
  );

  const envChip = (name: string) => {
    const { icon, tint } = envIcon(name);
    return (
      <div style={{ width: 30, height: 30, borderRadius: 9, background: tint + '1f', color: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={18} />
      </div>
    );
  };

  const availScenes = config.scenes.filter(sc => !ids.includes(sc.id));
  const availEnv    = config.environmentalControls.filter(e => !ids.includes(e.id));

  const activeItems = ids.map(id => ({
    id,
    label: sceneById[id]?.name ?? envById[id]?.name ?? id,
    chip: sceneById[id] ? sceneChip(sceneById[id]) : envChip(envById[id]?.name ?? id),
  })).filter(it => sceneById[it.id] || envById[it.id]);

  return (
    <div>
      <LargeTitle title="Environments" sub="Pinned to your Home dashboard"
        right={<button onClick={back} style={pillBtn}>Done</button>} />

      <SectionTitle>On Home · {activeItems.length}</SectionTitle>
      {activeItems.length === 0 ? (
        <Card>
          <div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--text2)', textAlign: 'center' }}>
            Nothing pinned yet — add some below.
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          {activeItems.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              borderBottom: i < activeItems.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              {circleBtn('var(--red)', 'minus', () => remove(it.id))}
              {it.chip}
              <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{it.label}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                  <Icon name="chevDown" size={18} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === activeItems.length - 1}
                  style={{ ...reorderBtn, opacity: i === activeItems.length - 1 ? 0.3 : 1, cursor: i === activeItems.length - 1 ? 'default' : 'pointer' }}>
                  <Icon name="chevDown" size={18} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {availScenes.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle>Add a Scene</SectionTitle>
          <Card pad={false}>
            {availScenes.map((sc, i) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < availScenes.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--green)', 'plus', () => add(sc.id))}
                {sceneChip(sc)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{sc.name}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {availEnv.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle>Add an Environmental Control</SectionTitle>
          <Card pad={false}>
            {availEnv.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < availEnv.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--green)', 'plus', () => add(e.id))}
                {envChip(e.name)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{e.name}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}
