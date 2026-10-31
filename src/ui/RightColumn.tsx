import { useEffect, useState } from 'react';
import { bus } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { JOB_BY_ID } from '../game/data/jobs';
import { LOCATION_BY_ID } from '../game/data/locations';
import { sessionStore, store, useSession } from '../game/store';
import { carriedWeight, carryCapacity, injuryName, moodText } from '../game/systems/character';
import { activeCharacter, Avatar, myCharacters, STATUS_LABEL, Vitals } from './common';
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
            <Avatar a={c.appearance} size={52} />
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
