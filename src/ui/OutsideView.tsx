import { travelMinutes } from '../game/systems/expedition';
import { useState } from 'react';
import { LOCATION_BY_ID, LOCATIONS } from '../game/data/locations';
import { DISTRICT_BY_ID } from '../game/world/districts';
import { sessionStore, store, useSession } from '../game/store';
import { fixJosa } from '../game/util';
import { Avatar, Panel } from './common';
import { ExpeditionScreen } from './ExpeditionView';
import { CityMap } from './CityMap';
import { LocationPanel } from './WorldMapView';

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
      <CityMap selected={selected} onSelect={setSel} compact={!!exp} focus={exp?.locationId ?? null} />

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
                <Avatar a={c.appearance} sprite={c.sprite} size={18} /> {c.name} · {LOCATION_BY_ID[e.locationId].name}
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
        <Panel title="가까운 탐험지" actions={<span className="muted small">지도에서 고르거나 아래 목록에서 선택</span>}>
          {active?.status === 'down' && <p className="warn">{fixJosa(`${active.name}은(는)`)} 지금 요양 중이라 나갈 수 없다.</p>}
          <div className="near-list">
            {LOCATIONS.filter((l) => !l.temporary && s.locations[l.id]?.discovered)
              .sort((a, b) => a.travel - b.travel)
              .slice(0, 16)
              .map((l) => (
                <button key={l.id} className="near-item" onClick={() => setSel(l.id)}>
                  <span className="near-icon">{l.icon}</span>
                  <span className="near-text">
                    <span className="near-name">{l.name}</span>
                    <span className="small muted">
                      <span style={{ color: DISTRICT_BY_ID[l.district]?.color }}>{DISTRICT_BY_ID[l.district]?.short}</span> · {'●'.repeat(l.danger)} · {travelMinutes(l)}분 ·{' '}
                      {s.locations[l.id].visits ? `${s.locations[l.id].visits}회 방문` : '미방문'}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
