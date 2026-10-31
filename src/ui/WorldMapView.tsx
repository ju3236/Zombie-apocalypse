import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { LOCATION_BY_ID, LOCATIONS } from '../game/data/locations';
import { totalWeight } from '../game/inventory';
import { sessionStore, store, useSession } from '../game/store';
import { canStart, startExpedition } from '../game/systems/expedition';
import { formatDuration, formatTime } from '../game/util';
import { myCharacters, Panel, Stars, StackLabel } from './common';

export function WorldMapView() {
  const s = store.s;
  const [sel, setSel] = useState<string | null>(null);
  const known = LOCATIONS.filter((l) => s.locations[l.id]?.discovered);
  const unknown = LOCATIONS.filter((l) => s.locations[l.id] && !s.locations[l.id].discovered).length;

  return (
    <div className="split">
      <div className="split-left wide">
        <Panel title="🗺️ 월드맵" actions={<span className="muted small">아직 모르는 장소: {unknown}곳 (지역 지도로 발견)</span>}>
          <div className="worldmap">
            <div className="wm-base" style={{ left: '38%', top: '72%' }} title="우리 거점">
              🏠<span>거점</span>
            </div>
            {known.map((l) => {
              const ls = s.locations[l.id];
              const exps = Object.values(s.expeditions).filter((e) => e.locationId === l.id);
              return (
                <button
                  key={l.id}
                  className={`wm-node ${sel === l.id ? 'active' : ''} ${l.temporary ? 'temp' : ''} danger-${l.danger}`}
                  style={{ left: `${l.pos.x}%`, top: `${l.pos.y}%` }}
                  onClick={() => setSel(l.id)}
                >
                  <span className="wm-icon">{l.icon}</span>
                  <span className="wm-name">{l.name}</span>
                  <span className="wm-depl">{depletion(l.id)}%</span>
                  {exps.length > 0 && <span className="wm-exp">🔦{exps.length}</span>}
                  {ls.expiresAt !== undefined && <span className="wm-timer">~{formatTime(ls.expiresAt)}</span>}
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
      <div className="split-right">
        {sel && LOCATION_BY_ID[sel] && s.locations[sel] ? <LocationPanel id={sel} /> : <Panel title="장소를 선택하세요">지도의 장소를 클릭하면 정보와 탐험 준비 화면이 열린다.</Panel>}
      </div>
    </div>
  );
}

/** 남은 물자 비율 */
function depletion(locId: string): number {
  const def = LOCATION_BY_ID[locId];
  const ls = store.s.locations[locId];
  let cap = 0;
  let rem = 0;
  for (const z of def.zones)
    for (const sp of z.spots) {
      cap += sp.capacity;
      rem += ls.zones[z.id]?.spots[sp.id]?.remaining ?? 0;
    }
  return cap ? Math.round((rem / cap) * 100) : 0;
}

function LocationPanel({ id }: { id: string }) {
  const s = store.s;
  const session = useSession();
  const def = LOCATION_BY_ID[id];
  const ls = s.locations[id];
  const mine = myCharacters().filter((c) => c.status === 'base');
  const [charId, setCharId] = useState('');
  const c = s.characters[charId] ?? (session.activeCharacterId && s.characters[session.activeCharacterId]?.status === 'base' ? s.characters[session.activeCharacterId] : mine[0]);
  const [weaponUid, setWeaponUid] = useState<string>('keep');
  const [bagUid, setBagUid] = useState<string>('keep');
  const [take, setTake] = useState<Record<string, number>>({});

  const weapons = s.storage.filter((x) => ITEMS[x.itemId].weapon);
  const bags = s.storage.filter((x) => ITEMS[x.itemId].backpack);
  const supplies = s.storage.filter((x) => ['food', 'drink', 'medical'].includes(ITEMS[x.itemId].category) || ITEMS[x.itemId].tags?.some((t) => ['lockpick', 'light', 'pry'].includes(t)) || x.itemId === 'ammo_9mm' || x.itemId === 'lab_keycard');

  const knownZones = def.zones.filter((z) => !z.secret || ls.zones[z.id]?.secretFound);
  const hiddenZones = def.zones.length - knownZones.length;

  const capacity = c ? 12 + (bagUid === 'keep' ? (c.backpack ? ITEMS[c.backpack.itemId].backpack ?? 0 : 0) : bagUid ? ITEMS[s.storage.find((x) => x.uid === bagUid)?.itemId ?? '']?.backpack ?? 0 : 0) : 12;
  const loadWeight =
    Object.entries(take).reduce((w, [uid, q]) => {
      const st = s.storage.find((x) => x.uid === uid);
      return w + (st ? ITEMS[st.itemId].weight * q : 0);
    }, 0) +
    (weaponUid === 'keep' ? (c?.weapon ? ITEMS[c.weapon.itemId].weight : 0) : weaponUid ? ITEMS[s.storage.find((x) => x.uid === weaponUid)?.itemId ?? '']?.weight ?? 0 : 0) +
    (c ? totalWeight(c.inventory) : 0);

  const err = c ? canStart(c, def) : '거점에 있는 내 캐릭터가 없다.';
  const go = () => {
    if (!c) return;
    if (loadWeight > capacity) return toast('짐이 너무 무겁다!', 'bad');
    const e = startExpedition(c.id, id, {
      weaponUid: weaponUid === 'keep' ? undefined : weaponUid || undefined,
      backpackUid: bagUid === 'keep' ? undefined : bagUid || undefined,
      items: Object.entries(take)
        .filter(([, q]) => q > 0)
        .map(([uid, qty]) => ({ uid, qty })),
    });
    if (e) return toast(e, 'bad');
    sessionStore.update({ activeCharacterId: c.id, tab: 'expedition' });
  };

  return (
    <>
      <Panel title={`${def.icon} ${def.name}`}>
        <p>{def.desc}</p>
        <div className="kv">
          <span>위험도</span>
          <Stars n={def.danger} />
          <span>이동 시간</span>
          <span>편도 {formatDuration(def.travel)}</span>
          <span>남은 물자</span>
          <span>{depletion(id)}%</span>
          <span>방문</span>
          <span>{ls.visits}회</span>
          <span>구역</span>
          <span>
            {knownZones.map((z) => z.name + (ls.zones[z.id]?.unlocked ? '' : '🔒')).join(', ')}
            {hiddenZones > 0 && <span className="muted"> + 미발견 {hiddenZones}곳?</span>}
          </span>
        </div>
        {def.requires && <div className="warn">🔐 {def.requires.text}</div>}
        {ls.notes.length > 0 && (
          <details>
            <summary>탐험 기록 ({ls.notes.length})</summary>
            {ls.notes.map((n, i) => (
              <div key={i} className="small">
                · {n}
              </div>
            ))}
          </details>
        )}
      </Panel>
      <Panel title="🎒 탐험 준비">
        {mine.length === 0 ? (
          <div className="muted">거점에 대기 중인 내 캐릭터가 없다.</div>
        ) : (
          <>
            <label className="field">
              탐험할 캐릭터
              <select value={c?.id ?? ''} onChange={(e) => setCharId(e.target.value)}>
                {mine.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} — 체력 {Math.round(x.health)} / 기력 {Math.round(x.energy)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              무기
              <select value={weaponUid} onChange={(e) => setWeaponUid(e.target.value)}>
                <option value="keep">{c?.weapon ? `현재 장비 유지: ${ITEMS[c.weapon.itemId].name}` : '맨손'}</option>
                {weapons.map((w) => (
                  <option key={w.uid} value={w.uid}>
                    {ITEMS[w.itemId].icon} {ITEMS[w.itemId].name}
                    {w.durability !== undefined ? ` (${Math.round((w.durability / (ITEMS[w.itemId].durability ?? 1)) * 100)}%)` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              가방
              <select value={bagUid} onChange={(e) => setBagUid(e.target.value)}>
                <option value="keep">{c?.backpack ? `현재: ${ITEMS[c.backpack.itemId].name}` : '없음'}</option>
                {bags.map((w) => (
                  <option key={w.uid} value={w.uid}>
                    {ITEMS[w.itemId].name} (+{ITEMS[w.itemId].backpack}kg)
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <div>챙겨갈 물품</div>
              <div className="supply-list">
                {supplies.map((x) => (
                  <div key={x.uid} className="row item-row">
                    <StackLabel s={x} />
                    <span className="stepper">
                      <button className="small" onClick={() => setTake({ ...take, [x.uid]: Math.max(0, (take[x.uid] ?? 0) - 1) })}>
                        −
                      </button>
                      <b>{take[x.uid] ?? 0}</b>
                      <button className="small" onClick={() => setTake({ ...take, [x.uid]: Math.min(x.qty, (take[x.uid] ?? 0) + 1) })}>
                        +
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className={loadWeight > capacity ? 'bad-text' : 'muted'}>
              무게 {Math.round(loadWeight * 10) / 10} / {capacity}kg (남는 공간에 물자를 담아 온다)
            </div>
            {err && <div className="warn">{err}</div>}
            <button className="primary big" disabled={!!err} onClick={go}>
              🚶 출발 (편도 {formatDuration(def.travel)})
            </button>
          </>
        )}
      </Panel>
    </>
  );
}
