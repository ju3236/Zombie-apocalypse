import { useState } from 'react';
import { toast } from '../game/bus';
import { askDesktopPermission, desktopPermission, desktopSupported } from '../game/notify';
import { ITEMS } from '../game/data/items';
import { LOCATION_BY_ID } from '../game/data/locations';
import { DISTRICT_BY_ID } from '../game/world/districts';
import { totalWeight } from '../game/inventory';
import { sessionStore, store, useSession } from '../game/store';
import { AUTO_HOURS, canStart, fuelProblem, startExpedition, travelMinutes, vehiclesIn } from '../game/systems/expedition';
import { myCharacters, Panel, Stars, StackLabel } from './common';

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

export function LocationPanel({ id }: { id: string }) {
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
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [perm, setPerm] = useState(desktopPermission());
  const [hours, setHours] = useState(3);
  const [vehicleUid, setVehicleUid] = useState('');
  const vehicles = vehiclesIn(s.storage);
  const vehicle = vehicles.find((v) => v.uid === vehicleUid) ?? null;
  const trunk = vehicle ? (ITEMS[vehicle.itemId].vehicle?.carry ?? 0) : 0;
  const walkMin = travelMinutes(def);
  const goMin = travelMinutes(def, vehicle?.itemId);

  const weapons = s.storage.filter((x) => ITEMS[x.itemId].weapon);
  const bags = s.storage.filter((x) => ITEMS[x.itemId].backpack);
  const supplies = s.storage.filter((x) => ['food', 'drink', 'medical'].includes(ITEMS[x.itemId].category) || ITEMS[x.itemId].tags?.some((t) => ['lockpick', 'light', 'pry'].includes(t)) || x.itemId === 'ammo_9mm' || x.itemId === 'lab_keycard');

  const knownZones = def.zones.filter((z) => !z.secret || ls.zones[z.id]?.secretFound);
  const hiddenZones = def.zones.length - knownZones.length;

  const capacity = trunk + (c ? 12 + (bagUid === 'keep' ? (c.backpack ? ITEMS[c.backpack.itemId].backpack ?? 0 : 0) : bagUid ? ITEMS[s.storage.find((x) => x.uid === bagUid)?.itemId ?? '']?.backpack ?? 0 : 0) : 12);
  const loadWeight =
    Object.entries(take).reduce((w, [uid, q]) => {
      const st = s.storage.find((x) => x.uid === uid);
      return w + (st ? ITEMS[st.itemId].weight * q : 0);
    }, 0) +
    (weaponUid === 'keep' ? (c?.weapon ? ITEMS[c.weapon.itemId].weight : 0) : weaponUid ? ITEMS[s.storage.find((x) => x.uid === weaponUid)?.itemId ?? '']?.weight ?? 0 : 0) +
    (c ? totalWeight(c.inventory) : 0);

  const err = c ? (canStart(c, def) ?? fuelProblem(c, vehicle?.itemId)) : '거점에 있는 내 캐릭터가 없다.';
  const go = () => {
    if (!c) return;
    if (loadWeight > capacity) return toast('짐이 너무 무겁다!', 'bad');
    const e = startExpedition(c.id, id, {
      weaponUid: weaponUid === 'keep' ? undefined : weaponUid || undefined,
      backpackUid: bagUid === 'keep' ? undefined : bagUid || undefined,
      items: Object.entries(take)
        .filter(([, q]) => q > 0)
        .map(([uid, qty]) => ({ uid, qty })),
    }, { mode, hours, vehicleUid: vehicle?.uid });
    if (e) return toast(e, 'bad');
    sessionStore.update({ activeCharacterId: c.id, tab: 'main', mainView: 'outside' });
  };

  return (
    <>
      <Panel title={`${def.icon} ${def.name}`}>
        <div className="loc-district" style={{ color: DISTRICT_BY_ID[def.district]?.color }}>
          {def.area} · {DISTRICT_BY_ID[def.district]?.name}
        </div>
        <p>{def.desc}</p>
        <div className="kv">
          <span>주요 물자</span>
          <span>{DISTRICT_BY_ID[def.district]?.loot}</span>
          <span>위험도</span>
          <Stars n={def.danger} />
          <span>이동 시간</span>
          <span>
            걸어서 편도 {walkMin}분
            {vehicles.length > 0 && <span className="muted"> · {vehicles.map((v) => `${ITEMS[v.itemId].icon} ${travelMinutes(def, v.itemId)}분`).join(' · ')}</span>}
          </span>
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
            <div className="field">
              <div>탐사 방식</div>
              <div className="seg">
                <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
                  🔦 직접 탐사
                </button>
                <button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>
                  ⏳ 장기 탐사
                </button>
              </div>
              <div className="muted small">
                {mode === 'manual'
                  ? '도착하면 구역을 옮기고 수색하고 싸우는 걸 직접 고른다. 돌아올 때도 직접 귀환을 누른다.'
                  : '정한 시간 동안 알아서 수색하고, 좀비를 만나면 숨거나 싸운다. 짐이 차거나 몸이 위험하면 일찍 돌아온다. 자리를 비워도 진행된다.'}
              </div>
              {mode === 'auto' && (
                <div className="seg">
                  {AUTO_HOURS.map((h) => (
                    <button key={h} className={hours === h ? 'active' : ''} onClick={() => setHours(h)}>
                      {h}시간
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="field">
              이동수단
              <select value={vehicleUid} onChange={(e) => setVehicleUid(e.target.value)}>
                <option value="">🚶 걸어서 (편도 {walkMin}분)</option>
                {vehicles.map((v) => {
                  const vd = ITEMS[v.itemId].vehicle!;
                  return (
                    <option key={v.uid} value={v.uid}>
                      {ITEMS[v.itemId].icon} {ITEMS[v.itemId].name} (편도 {travelMinutes(def, v.itemId)}분 · 짐 +{vd.carry}kg{vd.fuel ? ` · 휘발유 ${vd.fuel}통` : ''}
                      {vd.noise ? ' · 시끄러움' : ''})
                    </option>
                  );
                })}
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
            {desktopSupported() && perm === 'default' && (
              <button className="ghost small" onClick={() => void askDesktopPermission().then(setPerm)}>
                🔔 다른 탭에 있어도 도착·귀환 알림 받기
              </button>
            )}
            <button className="primary big" disabled={!!err} onClick={go}>
              {vehicle ? ITEMS[vehicle.itemId].icon : '🚶'} {mode === 'auto' ? `장기 탐사 출발 (${hours}시간 + 왕복 ${goMin * 2}분)` : `출발 (편도 ${goMin}분)`}
            </button>
          </>
        )}
      </Panel>
    </>
  );
}
