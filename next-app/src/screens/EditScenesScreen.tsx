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

export function EditScenesScreen() {
  const { st, setD, back, config } = useHC();
  const ids = (st['_scenes'] as ScenesListState).ids;

  const byId: Record<string, SceneConfig> = {};
  config.scenes.forEach(s => { byId[s.id] = s; });

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

  const avail = config.scenes.filter(sc => !ids.includes(sc.id));

  return (
    <div>
      <LargeTitle title="Scenes" sub="Pinned to your Home dashboard"
        right={<button onClick={back} style={pillBtn}>Done</button>} />

      <SectionTitle>On Home · {ids.length}</SectionTitle>
      {ids.length === 0 ? (
        <Card>
          <div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--text2)', textAlign: 'center' }}>
            No scenes yet — add some below.
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          {ids.map((id, i) => {
            const sc = byId[id];
            if (!sc) return null;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < ids.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--red)', 'minus', () => remove(id))}
                {sceneChip(sc)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{sc.name}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                    <Icon name="chevDown" size={18} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === ids.length - 1}
                    style={{ ...reorderBtn, opacity: i === ids.length - 1 ? 0.3 : 1, cursor: i === ids.length - 1 ? 'default' : 'pointer' }}>
                    <Icon name="chevDown" size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {avail.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle>Add a Scene</SectionTitle>
          <Card pad={false}>
            {avail.map((sc, i) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < avail.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--green)', 'plus', () => add(sc.id))}
                {sceneChip(sc)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{sc.name}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}
