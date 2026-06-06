'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn, reorderBtn } from '@/lib/styles';
import type { FavsState } from '@/types/state';
import type { FavItem } from '@/types/config';

export function EditFavoritesScreen() {
  const { st, setD, back, config } = useHC();
  const ids = (st['_favs'] as FavsState).ids;

  // Build lookup from catalog
  const lookup: Record<string, FavItem & { group: string }> = {};
  config.favCatalog.forEach(g => g.items.forEach(it => { lookup[it.id] = { ...it, group: g.group }; }));

  const setIds = (next: string[]) => setD('_favs', { ids: next });
  const remove = (id: string) => setIds(ids.filter(x => x !== id));
  const add = (id: string) => setIds([...ids, id]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  const circleBtn = (color: string, name: IconName, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 26, height: 26, borderRadius: 13, border: 'none', flex: '0 0 auto',
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: disabled ? 'var(--switch-off)' : color, color: '#fff',
      opacity: disabled ? 0.4 : 1, WebkitTapHighlightColor: 'transparent',
    }}>
      <Icon name={name} size={16} strokeWidth={2.6} />
    </button>
  );

  return (
    <div>
      <LargeTitle title="Favorites" sub="Pinned to your Home dashboard"
        right={<button onClick={back} style={pillBtn}>Done</button>} />

      <SectionTitle>On Home · {ids.length}</SectionTitle>
      {ids.length === 0 ? (
        <Card>
          <div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--text2)', textAlign: 'center' }}>
            No favorites yet — add some below.
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          {ids.map((id, i) => {
            const it = lookup[id] ?? { icon: 'bulb', label: id };
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < ids.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--red)', 'minus', () => remove(id))}
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--icon-bg)', color: 'var(--text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <Icon name={it.icon as IconName} size={18} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{it.label}</span>
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

      {config.favCatalog.map(g => {
        const avail = g.items.filter(it => !ids.includes(it.id));
        if (avail.length === 0) return null;
        const hasPlaces = avail.some(it => it.place);

        // Group items by place for sub-headings (only when place is present)
        const sections: { place: string | undefined; items: typeof avail }[] = [];
        if (hasPlaces) {
          let cur: string | undefined;
          for (const it of avail) {
            if (it.place !== cur) { cur = it.place; sections.push({ place: cur, items: [] }); }
            sections[sections.length - 1].items.push(it);
          }
        } else {
          sections.push({ place: undefined, items: avail });
        }

        return (
          <div key={g.group} style={{ marginTop: 22 }}>
            <SectionTitle>{g.group}</SectionTitle>
            <Card pad={false}>
              {sections.map((sec, si) => (
                <div key={sec.place ?? 'all'}>
                  {sec.place && (
                    <div style={{
                      padding: '8px 14px 4px',
                      fontSize: 12, fontWeight: 640, letterSpacing: 0.4,
                      color: 'var(--text3)', textTransform: 'uppercase',
                      borderTop: si > 0 ? '0.5px solid var(--sep)' : 'none',
                    }}>
                      {sec.place}
                    </div>
                  )}
                  {sec.items.map((it, i) => {
                    const isLastInGroup = si === sections.length - 1 && i === sec.items.length - 1;
                    const isLastInSection = i === sec.items.length - 1;
                    return (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                        borderBottom: (!isLastInGroup && isLastInSection) || (!isLastInGroup && !isLastInSection) ? '0.5px solid var(--sep)' : 'none' }}>
                        {circleBtn('var(--green)', 'plus', () => add(it.id))}
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--icon-bg)', color: 'var(--text2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                          <Icon name={it.icon as IconName} size={18} />
                        </div>
                        <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{it.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </Card>
          </div>
        );
      })}

      <div style={{ height: 8 }} />
    </div>
  );
}
