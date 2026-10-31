import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import {
  BANDAGE_ITEMS, bandageWound, DISINFECT_ITEMS, disinfectWound, equipCandidates, equipItem, equippedIn, PART_LABEL, partWounds, PARTS,
  protectionFor, SLOT_LABEL, supplyCount, unequipSlot, type EquipSlot,
} from '../game/systems/body';
import { injuryName } from '../game/systems/character';
import type { BodyPart, Character, Injury } from '../game/types';

// 도트 실루엣 (20 x 40 격자). 화면을 바라보는 모습이라 캐릭터의 오른쪽이 왼편에 온다.
const SHAPE: Record<BodyPart, [number, number, number, number]> = {
  head: [7, 0, 6, 6],
  neck: [8, 6, 4, 2],
  torso: [6, 8, 8, 12],
  r_arm: [3, 8, 3, 10],
  l_arm: [14, 8, 3, 10],
  r_hand: [2, 18, 4, 3],
  l_hand: [14, 18, 4, 3],
  r_leg: [6, 20, 4, 15],
  l_leg: [10, 20, 4, 15],
  r_foot: [5, 35, 5, 3],
  l_foot: [10, 35, 5, 3],
};

function partState(ws: Injury[]): 'ok' | 'hurt' | 'bite' | 'bandaged' {
  if (!ws.length) return 'ok';
  if (ws.some((w) => w.type === 'bite')) return 'bite';
  if (ws.every((w) => w.bandaged)) return 'bandaged';
  return 'hurt';
}

/** 작은 몸 그림 (오른쪽 칸 카드용) */
export function MiniBody({ c, size = 60, onClick }: { c: Character; size?: number; onClick?: () => void }) {
  return (
    <svg className={`body-svg mini ${onClick ? 'clickable' : ''}`} viewBox="-1 -1 22 42" width={size / 2} height={size} shapeRendering="crispEdges" onClick={onClick}>
      {PARTS.map((p) => {
        const [x, y, w, h] = SHAPE[p];
        return <rect key={p} x={x} y={y} width={w} height={h} className={`bp ${partState(partWounds(c, p))}`} />;
      })}
    </svg>
  );
}

function healthLabel(c: Character): [string, string] {
  if (c.status === 'dead') return ['사망', 'bad'];
  if (c.health >= 85 && !c.injuries.length) return ['건강함', 'good'];
  if (c.health >= 60) return ['가벼운 부상', 'warn'];
  if (c.health >= 30) return ['중상', 'bad'];
  return ['위독함', 'bad'];
}

export function BodyPanel({ c, editable }: { c: Character; editable: boolean }) {
  const [sel, setSel] = useState<BodyPart | null>(null);
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [label, cls] = healthLabel(c);
  const hurtParts = PARTS.filter((p) => partWounds(c, p).length);
  const listParts = showAll ? PARTS : hurtParts;
  const canAct = editable && c.status !== 'dead';

  const slotBox = (s: EquipSlot) => {
    const st = equippedIn(c, s);
    const it = st ? ITEMS[st.itemId] : null;
    const label = s === 'weapon' ? '무기' : s === 'backpack' ? '가방' : SLOT_LABEL[s];
    return (
      <button key={s} className={`eq-slot ${slot === s ? 'sel' : ''} ${st ? '' : 'empty'}`} onClick={() => setSlot(slot === s ? null : s)} title={it ? `${it.name}\n${it.desc}` : `${label} 비어 있음`}>
        <span className="eq-icon">{it ? it.icon : '·'}</span>
        <span className="eq-label">{label}</span>
        {st?.durability !== undefined && it?.durability && (
          <span className="eq-dur">
            <i style={{ width: `${(st.durability / it.durability) * 100}%` }} />
          </span>
        )}
      </button>
    );
  };

  const cands = slot ? equipCandidates(c, slot) : [];
  const cur = slot ? equippedIn(c, slot) : null;

  return (
    <div className="body-panel">
      <div className="bp-figure">
        <div className="eq-col">{(['hat', 'top', 'gloves', 'weapon'] as EquipSlot[]).map(slotBox)}</div>
        <svg className="body-svg" viewBox="-1 -1 22 42" width={110} height={220} shapeRendering="crispEdges">
          {PARTS.map((p) => {
            const [x, y, w, h] = SHAPE[p];
            return (
              <rect key={p} x={x} y={y} width={w} height={h} className={`bp ${partState(partWounds(c, p))} ${sel === p ? 'sel' : ''}`} onClick={() => setSel(sel === p ? null : p)}>
                <title>{PART_LABEL[p]}</title>
              </rect>
            );
          })}
        </svg>
        <div className="eq-col">{(['bottom', 'shoes', 'backpack'] as EquipSlot[]).map(slotBox)}</div>

        {slot && (
          <div className="eq-menu">
            <div className="small muted">{slot === 'weapon' ? '무기' : slot === 'backpack' ? '가방' : SLOT_LABEL[slot]}</div>
            {cur && (
              <div className="row item-row">
                <span>
                  {ITEMS[cur.itemId].icon} {ITEMS[cur.itemId].name}
                  {ITEMS[cur.itemId].wear && <span className="muted small"> · 방어 {Math.round((ITEMS[cur.itemId].wear?.protect ?? 0) * 100)}%</span>}
                </span>
                {canAct && (
                  <button className="small" onClick={() => unequipSlot(c, slot)}>
                    벗기
                  </button>
                )}
              </div>
            )}
            {canAct &&
              cands.map(({ st, from }) => (
                <button
                  key={st.uid}
                  className="eq-cand"
                  onClick={() => {
                    const err = equipItem(c, from, st.uid);
                    if (err) toast(err, 'bad');
                  }}
                >
                  {ITEMS[st.itemId].icon} {ITEMS[st.itemId].name}
                  <span className="muted small">
                    {' '}
                    {ITEMS[st.itemId].wear ? `방어 ${Math.round(ITEMS[st.itemId].wear!.protect * 100)}% · ` : ''}
                    {from === 'inv' ? '소지품' : '창고'}
                  </span>
                </button>
              ))}
            {canAct && !cands.length && <div className="muted small">장착할 수 있는 물건이 없다.</div>}
          </div>
        )}
      </div>

      <div className="bp-list">
        <div className="bp-head">
          <span className="muted small">[전체 몸 상태]</span>
          <b className={`hl-${cls}`}>
            [{Math.round(c.health)}%] {label}
          </b>
          {c.infection > 0 && <span className="bad-text small">감염 {Math.round(c.infection)}%{c.infection >= 30 ? ' — 악화 중' : ''}</span>}
        </div>
        {!hurtParts.length && !showAll && <div className="muted small">다친 곳이 없다.</div>}
        {listParts.map((p) => {
          const ws = partWounds(c, p);
          const prot = protectionFor(c, p);
          return (
            <div key={p} className={`bp-part ${sel === p ? 'sel' : ''} ${ws.length ? 'hurt' : ''}`} onClick={() => setSel(sel === p ? null : p)}>
              <div className="bp-part-head">
                <span>{PART_LABEL[p]}</span>
                <span className="muted small">{prot.stack ? `${ITEMS[prot.stack.itemId].name} ${Math.round(prot.protect * 100)}%` : '맨살'}</span>
              </div>
              {ws.map((w) => (
                <div key={w.id} className="bp-wound">
                  <span className={w.type === 'bite' ? 'bite' : 'cut'}>- {injuryName(w.type)}</span>
                  {!w.bandaged && <span className="tag bad">출혈</span>}
                  {w.bandaged && <span className={`tag ${w.dirtyBandage ? 'warn' : ''}`}>{w.dirtyBandage ? '천 붕대' : '붕대'}</span>}
                  {w.disinfected && <span className="tag ok">소독</span>}
                  {!w.disinfected && <span className="tag dim">감염 위험</span>}
                  {w.bandaged && <span className="muted small">{Math.ceil(w.healHours)}시간 후 회복</span>}
                </div>
              ))}
              {sel === p && canAct && ws.length > 0 && (
                <div className="bp-actions" onClick={(e) => e.stopPropagation()}>
                  {ws.map((w) => (
                    <div key={w.id} className="row wrap">
                      <span className="small muted">{injuryName(w.type)}:</span>
                      {(!w.bandaged || w.dirtyBandage) &&
                        BANDAGE_ITEMS.map((id) => (
                          <button key={id} className="small" disabled={supplyCount(c, id) === 0} onClick={() => toast(bandageWound(c, w.id, id))}>
                            🩹 {ITEMS[id].name} 감기 ({supplyCount(c, id)})
                          </button>
                        ))}
                      {!w.disinfected &&
                        DISINFECT_ITEMS.map((id) => (
                          <button key={id} className="small" disabled={supplyCount(c, id) === 0} onClick={() => toast(disinfectWound(c, w.id, id))}>
                            🧴 {ITEMS[id].name} 소독 ({supplyCount(c, id)})
                          </button>
                        ))}
                    </div>
                  ))}
                  <div className="muted small">{c.status === 'expedition' ? '탐험 중에는 소지품만 쓸 수 있다.' : '소지품과 거점 창고의 물건을 쓴다.'}</div>
                </div>
              )}
            </div>
          );
        })}
        <button className="ghost small" onClick={() => setShowAll(!showAll)}>
          {showAll ? '다친 부위만 보기' : '모든 부위 보기'}
        </button>
        <div className="muted small">부위를 눌러 치료 · 장비 칸을 눌러 착용/교체</div>
      </div>
    </div>
  );
}

