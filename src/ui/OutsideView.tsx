import { useState } from 'react';
import { LOCATION_BY_ID } from '../game/data/locations';
import { sessionStore, store, useSession } from '../game/store';
import { fixJosa } from '../game/util';
import { Avatar, Panel } from './common';
import { ExpeditionScreen } from './ExpeditionView';
import { LocationPanel, WorldMapBoard } from './WorldMapView';

/** 지도·탐험: 위에는 지도, 아래에는 장소 준비 화면 또는 진행 중인 탐험 */
export function OutsideView() {
  const s = store.s;
  const session = useSession();
  const active = session.activeCharacterId ? s.characters[session.activeCharacterId] : null;
  const exp = active ? s.expeditions[active.id] : null;
  const [sel, setSel] = useState<string | null>(null);
  const selected = exp ? exp.locationId : sel && LOCATION_BY_ID[sel] && s.locations[sel] ? sel : null;
  const others = Object.values(s.expeditions).filter((e) => e.characterId !== active?.id);

  return (
    <div className="outside">
      <WorldMapBoard selected={selected} onSelect={setSel} compact={!!exp} />

      {others.length > 0 && (
        <div className="exp-strip">
          <span className="muted small">다른 탐험</span>
          {others.map((e) => {
            const c = s.characters[e.characterId];
            const mine = c.owner === session.player;
            return (
              <button
                key={e.characterId}
                className="exp-chip"
                disabled={!mine}
                title={mine ? '이 캐릭터로 전환' : `${c.owner}의 캐릭터`}
                onClick={() => sessionStore.update({ activeCharacterId: c.id })}
              >
                <Avatar a={c.appearance} size={18} /> {c.name} · {LOCATION_BY_ID[e.locationId].name}
              </button>
            );
          })}
        </div>
      )}

      {exp && active ? (
        <ExpeditionScreen e={exp} c={active} />
      ) : selected ? (
        <div className="loc-grid">
          <LocationPanel id={selected} />
        </div>
      ) : (
        <Panel title="어디로 갈까">
          <p className="muted">
            지도에서 장소를 고르면 정보와 탐험 준비가 여기 열린다.
            {active?.status === 'down' && ` ${fixJosa(`${active.name}은(는)`)} 지금 요양 중이라 나갈 수 없다.`}
          </p>
        </Panel>
      )}
    </div>
  );
}
