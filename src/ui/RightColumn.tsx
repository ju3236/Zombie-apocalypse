import { useEffect, useState } from 'react';
import { bus, toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { JOB_BY_ID } from '../game/data/jobs';
import { LOCATION_BY_ID } from '../game/data/locations';
import { sessionStore, store, useSession } from '../game/store';
import { carriedWeight, carryCapacity, consumeFrom, goToSleep, injuryName, isAsleep, moodText, unequip, wakeUp } from '../game/systems/character';
import { consumeInField, dropItem } from '../game/systems/expedition';
import { addStack, takeStack } from '../game/inventory';
import type { ItemStack } from '../game/types';
import { activeCharacter, Avatar, myCharacters, STATUS_LABEL, Vitals } from './common';
import { equipItem, slotOfItem } from '../game/systems/body';
import { CharacterQuickPanel, FurniturePanel, NewsFeed, RpQuick } from './panels';

export function RightColumn() {
  const session = useSession();
  const [selF, setSelF] = useState<string | null>(null);
  const [selC, setSelC] = useState<string | null>(null);

  useEffect(() => {
    const a = bus.on('selectFurniture', ({ uid }) => {
      setSelF(uid);
      if (uid) setSelC(null);
    });
    const b = bus.on('selectCharacter', ({ characterId }) => {
      setSelC(characterId);
      setSelF(null);
      bus.emit('selectFurniture', { uid: null });
    });
    return () => {
      a();
      b();
    };
  }, []);

  const onBase = session.tab === 'main' && session.mainView === 'base';

  return (
    <aside className="col-right">
      <ActiveCard />
      <PocketPanel />
      {onBase && selF && store.s.base.furniture.some((f) => f.uid === selF) && (
        <FurniturePanel uid={selF} onClose={() => bus.emit('selectFurniture', { uid: null })} />
      )}
      {onBase && selC && store.s.characters[selC] && <CharacterQuickPanel id={selC} onClose={() => setSelC(null)} />}
      <RpQuick />
      <NewsFeed />
    </aside>
  );
}

function ActiveCard() {
  const session = useSession();
  const mine = myCharacters();
  const c = activeCharacter();
  const exp = c ? store.s.expeditions[c.id] : null;
  return (
    <div className="active-card">
      <div className="col-title">
        조종 중
        <select value={session.activeCharacterId ?? ''} onChange={(e) => sessionStore.update({ activeCharacterId: e.target.value || null })}>
          <option value="">— 선택 —</option>
          {mine.map((x) => (
            <option key={x.id} value={x.id} disabled={x.status === 'dead'}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      {c ? (
        <>
          <div className="ac-head">
            <Avatar a={c.appearance} sprite={c.sprite} size={52} />
            <div>
              <div className="ac-name">{c.name}</div>
              <div className="muted small">
                {JOB_BY_ID[c.job]?.name} · {STATUS_LABEL[c.status]}
              </div>
              <div className={`ac-mood mood-${moodText(c) === '양호' ? 'ok' : 'bad'}`}>{moodText(c)}</div>
            </div>
          </div>
          {exp && (
            <button className="ac-exp" onClick={() => sessionStore.update({ tab: 'main', mainView: 'outside' })}>
              ☠ {LOCATION_BY_ID[exp.locationId].name} 탐험 중 · 소음 {Math.round(exp.noise)}
              {exp.encounter && <b> · 좀비 {exp.encounter.zombies.length}!</b>} ▸
            </button>
          )}
          <Vitals c={c} compact />
          {c.status === 'base' && <SleepControl c={c} />}
          <div className="ac-gear small">
            <span>⚔ {c.weapon ? ITEMS[c.weapon.itemId].name : '맨손'}</span>
            <span>
              ▣ {carriedWeight(c)}/{carryCapacity(c)}kg
            </span>
          </div>
          {c.injuries.length > 0 && (
            <div className="small">
              {c.injuries.map((i) => (
                <span key={i.id} className={`chip ${i.bandaged ? 'ok' : 'bad'}`}>
                  {injuryName(i.type)}
                  {i.bandaged ? '' : ' 출혈'}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="muted small">왼쪽 명단에서 생존자를 등록하거나 선택하세요.</div>
      )}
    </div>
  );
}

/** 간단한 소지품 슬롯 (자세한 내용은 생존자 프로필) */
function PocketPanel() {
  const s = store.s;
  const c = activeCharacter();
  const [sel, setSel] = useState<string | null>(null);
  if (!c || c.status === 'dead') return null;
  const exp = s.expeditions[c.id];
  const engaged = !!exp?.encounter?.engaged;
  const atBase = c.status === 'base' || c.status === 'down';
  const slots: { st: ItemStack; eq?: string }[] = [
    ...(c.weapon ? [{ st: c.weapon, eq: '무기' }] : []),
    ...(c.backpack ? [{ st: c.backpack, eq: '가방' }] : []),
    ...c.inventory.map((st) => ({ st })),
  ];
  const cur = slots.find((x) => x.st.uid === sel);
  const d = cur ? ITEMS[cur.st.itemId] : null;
  const cap = carryCapacity(c);
  const w = carriedWeight(c);

  return (
    <div className="pocket">
      <div className="col-title">
        소지품 {w}/{cap}kg
        <button className="ghost small" onClick={() => sessionStore.update({ tab: 'characters', viewCharId: c.id })}>
          자세히 ▸
        </button>
      </div>
      <div className="progress tiny">
        <div style={{ width: `${Math.min(100, (w / cap) * 100)}%`, background: w > cap * 0.9 ? '#c23a2c' : undefined }} />
      </div>
      <div className="slots">
        {slots.map(({ st, eq }) => {
          const it = ITEMS[st.itemId];
          return (
            <button key={st.uid} className={`slot ${sel === st.uid ? 'sel' : ''} ${eq ? 'eq' : ''}`} title={`${it.name}${eq ? ` (${eq})` : ''}`} onClick={() => setSel(sel === st.uid ? null : st.uid)}>
              <span className="slot-icon">{it.icon}</span>
              {st.qty > 1 && <span className="slot-qty">{st.qty}</span>}
              {st.durability !== undefined && it.durability && (
                <span className="slot-dur">
                  <i style={{ width: `${(st.durability / it.durability) * 100}%` }} />
                </span>
              )}
            </button>
          );
        })}
        {Array.from({ length: Math.max(0, 10 - slots.length) }).map((_, i) => (
          <span key={i} className="slot empty" />
        ))}
      </div>
      {cur && d && (
        <div className="slot-info">
          <div>
            <b>{d.name}</b> {cur.eq && <span className="tag">{cur.eq}</span>} <span className="muted small">{Math.round(d.weight * cur.st.qty * 10) / 10}kg</span>
          </div>
          <div className="muted small">{d.desc}</div>
          <div className="row wrap">
            {!cur.eq && (d.consume || d.treat) && (
              <button
                className="small primary"
                onClick={() => {
                  if (exp) consumeInField(c.id, d.id);
                  else {
                    const msg = consumeFrom(c.inventory, c, d.id);
                    if (msg) toast(msg);
                    store.commit();
                  }
                }}
              >
                사용
              </button>
            )}
            {!cur.eq && slotOfItem(cur.st.itemId) && (
              <button
                className="small"
                onClick={() => {
                  const err = equipItem(c, 'inv', cur.st.uid);
                  if (err) toast(err, 'bad');
                  setSel(null);
                }}
              >
                장착
              </button>
            )}
            {atBase && !cur.eq && (
              <button
                className="small"
                onClick={() => {
                  const st = takeStack(c.inventory, cur.st.uid);
                  if (st) addStack(s.storage, st);
                  setSel(null);
                  store.commit();
                }}
              >
                창고로
              </button>
            )}
            {atBase && cur.eq && (
              <button className="small" onClick={() => (unequip(c, cur.eq === '무기' ? 'weapon' : 'backpack'), setSel(null))}>
                해제
              </button>
            )}
            {exp && !cur.eq && (
              <button className="small ghost" disabled={engaged} onClick={() => (dropItem(c.id, cur.st.uid), setSel(null))}>
                버리기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 직접 재우기: 원하는 만큼 자고, 시간이 되면 일어난다 */
function SleepControl({ c }: { c: import('../game/types').Character }) {
  const s = store.s;
  if (isAsleep(c)) {
    const left = Math.max(0, Math.round((c.sleepUntil ?? 0) - s.time));
    const h = Math.floor(left / 60);
    const m = left % 60;
    return (
      <div className="sleep-ctl">
        <span>💤 자는 중 · {h ? `${h}시간 ` : ''}{m}분 남음</span>
        <button className="small" onClick={() => wakeUp(c)}>
          깨우기
        </button>
      </div>
    );
  }
  return (
    <div className="sleep-ctl">
      <span>💤 재우기</span>
      {[1, 2, 4, 6, 8].map((h) => (
        <button key={h} className="small" onClick={() => {
          const err = goToSleep(c, h);
          if (err) toast(err, 'bad');
        }}>
          {h}h
        </button>
      ))}
    </div>
  );
}
