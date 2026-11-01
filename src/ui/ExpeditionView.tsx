import { useEffect, useRef, useState } from 'react';
import { MerchantPanel } from './MerchantPanel';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { LOCATION_BY_ID } from '../game/data/locations';
import { countItem, hasTag } from '../game/inventory';
import { store } from '../game/store';
import { carriedWeight, carryCapacity } from '../game/systems/character';
import {
  attack, flee, hide, leaveFound, moveZone, recall, returnHome, search, shove, takeFound, unlockZone, waitQuietly, ZOMBIE_ICON, canFishHere, fish, ZOMBIE_NAME,
} from '../game/systems/expedition';
import type { Character, Expedition } from '../game/types';
import { formatTime } from '../game/util';
import { Avatar, Bar, Panel, StackLabel } from './common';

export function ExpeditionScreen({ e, c }: { e: Expedition; c: Character }) {
  if (e.phase !== 'there' || e.mode === 'auto') return <ExpeditionStatus e={e} c={c} />;
  return <ExpeditionField e={e} c={c} />;
}

/** 1초마다 다시 그리기 (남은 시간 표시용) */
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(iv);
  }, [ms]);
  return now;
}

const left = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return h ? `${h}시간 ${m}분` : m ? `${m}분 ${ss.toString().padStart(2, '0')}초` : `${ss}초`;
};

/** 이동 중 · 장기 탐사 중 화면 */
function ExpeditionStatus({ e, c }: { e: Expedition; c: Character }) {
  const now = useNow();
  const loc = LOCATION_BY_ID[e.locationId];
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [e.log.length]);
  const v = e.vehicle ? ITEMS[e.vehicle.itemId] : null;
  const how = v ? `${v.icon} ${v.name}` : '🚶 걸어서';
  let title = '';
  let total = 1;
  if (e.phase === 'going') {
    title = `${how} ${loc.name}(으)로 가는 중`;
    total = e.travelMs;
  } else if (e.phase === 'returning') {
    title = `${how} 거점으로 돌아오는 중`;
    total = e.travelMs;
  } else {
    title = `⏳ ${loc.name} 장기 탐사 중`;
    total = (e.autoHours ?? 3) * 3600000;
  }
  const remain = Math.max(0, e.phaseEnds - now);
  const pct = Math.min(100, Math.max(0, ((total - remain) / total) * 100));
  const cap = carryCapacity(c);
  const weight = carriedWeight(c);
  return (
    <div className="expedition">
      <div className="exp-head">
        <div className="row">
          <Avatar a={c.appearance} sprite={c.sprite} size={40} />
          <div>
            <h2>
              {loc.icon} {loc.name}
              {e.mode === 'auto' && <span className="zone-name"> · 장기 탐사 {e.autoHours}시간</span>}
            </h2>
            <div className="muted small">
              {c.name} · 무기: {c.weapon ? <StackLabel s={c.weapon} /> : '맨손'} · 짐 {Math.round(weight * 10) / 10}/{cap}kg
            </div>
          </div>
        </div>
      </div>
      <div className="exp-grid">
        <Panel title={title}>
          <div className="travel-bar">
            <div className="travel-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="row item-row">
            <span className="muted small">{e.phase === 'there' ? '돌아오기까지' : '도착까지'}</span>
            <b>{remain > 0 ? left(remain) : '곧 도착'}</b>
          </div>
          <div className="vitals-mini">
            <Bar value={c.health} color="#c0392b" label="체력" small />
            <Bar value={c.energy} color="#27ae60" label="기력" small />
            <Bar value={c.hunger} color="#d68910" label="포만" small />
            <Bar value={c.thirst} color="#2e86c1" label="수분" small />
          </div>
          {c.inventory.length > 0 && (
            <div className="small">
              <div className="muted">가진 물건</div>
              {c.inventory.map((x) => (
                <div key={x.uid}>
                  <StackLabel s={x} />
                </div>
              ))}
            </div>
          )}
          {e.phase !== 'returning' && (
            <button className="primary" onClick={() => recall(c.id)}>
              📻 {e.phase === 'going' ? '되돌아오기' : '지금 돌아오기'}
            </button>
          )}
          <div className="muted small">
            {e.mode === 'auto'
              ? '알아서 수색하고 있다. 창을 닫아도 계속 진행된다.'
              : e.phase === 'going'
                ? '도착하면 직접 탐사를 시작할 수 있다.'
                : '도착하면 짐이 창고에 정리된다.'}
          </div>
        </Panel>
        <div className="exp-center">
          <Panel title="📜 탐험 기록" className="exp-log-panel">
            <div className="exp-log" ref={logRef}>
              {e.log.map((l, i) => (
                <div key={i} className={`log-line ${l.kind ?? ''}`}>
                  <span className="rp-time">{formatTime(l.t).split(' ')[1]}</span> {l.text}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ExpeditionField({ e, c }: { e: Expedition; c: Character }) {
  const s = store.s;
  const loc = LOCATION_BY_ID[e.locationId];
  const ls = s.locations[e.locationId];
  const zone = loc.zones.find((z) => z.id === e.zoneId)!;
  const zs = ls.zones[zone.id];
  const enc = e.encounter;
  const engaged = !!enc?.engaged;
  const busy = !!enc || !!e.found;
  const [target, setTarget] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [e.log.length]);

  const gear = [...c.inventory, ...(c.weapon ? [c.weapon] : [])];
  const tgt = enc?.zombies.find((z) => z.id === target) ?? enc?.zombies[0];
  const cap = carryCapacity(c);
  const weight = carriedWeight(c);

  const amount = (rem: number, capa: number) => (rem <= 0 ? '텅 빔' : rem / capa > 0.6 ? '많음' : rem / capa > 0.3 ? '조금' : '거의 없음');

  return (
    <div className="expedition">
      <div className="exp-head">
        <div className="row">
          <Avatar a={c.appearance} sprite={c.sprite} size={40} />
          <div>
            <h2>
              {loc.icon} {loc.name} · <span className="zone-name">{zone.name}</span>
            </h2>
            <div className="muted small">
              {formatTime(s.time)} · {c.name} · 무기: {c.weapon ? <StackLabel s={c.weapon} /> : '맨손'}
            </div>
          </div>
        </div>
        <div className="noise">
          <span>소음</span>
          <Bar value={e.noise} color={e.noise > 60 ? '#e74c3c' : e.noise > 30 ? '#f39c12' : '#95a5a6'} small />
        </div>
      </div>

      <div className="exp-grid">
        <Panel title="구역">
          {loc.zones.map((z) => {
            const st = ls.zones[z.id];
            if (z.secret && !st.secretFound) return null;
            const here = z.id === e.zoneId;
            return (
              <div key={z.id} className={`zone ${here ? 'here' : ''}`}>
                <div className="row item-row">
                  <span>
                    {here ? '📍' : st.unlocked ? '🚪' : '🔒'} {z.name}
                    {z.secret && <span className="tag">숨은 공간</span>}
                    {z.toxic && <span className="tag bad" title="방독면이 없으면 행동할 때마다 다친다">☣️ 오염{c.inventory.some((x) => x.itemId === 'gas_mask') ? ' · 😷' : ''}</span>}
                    {z.boss && !st.bossDown && <span className="tag bad">👹 거구</span>}
                  </span>
                  {!here && st.unlocked && (
                    <button className="small" disabled={engaged} onClick={() => moveZone(c.id, z.id)}>
                      이동
                    </button>
                  )}
                </div>
                {!st.unlocked && z.locked && (
                  <div className="locked">
                    <div className="small muted">{z.locked.text}</div>
                    <div className="row wrap">
                      {z.locked.pry && (
                        <button className="small" disabled={busy || !hasTag(gear, 'pry')} onClick={() => unlockZone(c.id, z.id, 'pry')} title="확실하지만 매우 시끄럽다">
                          쇠지렛대로 부수기 (소음↑↑)
                        </button>
                      )}
                      {z.locked.lockpick && (
                        <button className="small" disabled={busy || countItem(c.inventory, 'lockpick') === 0} onClick={() => unlockZone(c.id, z.id, 'lockpick')} title="조용하지만 실패할 수 있다">
                          자물쇠 따기 ({countItem(c.inventory, 'lockpick')})
                        </button>
                      )}
                      {z.locked.key && (
                        <button className="small" disabled={busy || countItem(c.inventory, z.locked.key) === 0} onClick={() => unlockZone(c.id, z.id, 'key')}>
                          {ITEMS[z.locked.key].name} 사용
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="divider small" />
          {canFishHere(e) && (
            <div className="fishing-box">
              <div className="small">
                🌊 <b>물가</b> — 낚싯대 {c.inventory.some((x) => x.itemId === 'fishing_rod') ? `✓ (내구 ${c.inventory.find((x) => x.itemId === 'fishing_rod')?.durability ?? 30})` : '없음'} · 미끼 {countItem(c.inventory, 'bait')}
              </div>
              <button disabled={busy || !c.inventory.some((x) => x.itemId === 'fishing_rod')} onClick={() => fish(c.id)} title="30분. 미끼가 있으면 더 잘 잡히고 큰 놈이 문다. 물에서 좀비가 올라올 수도 있다.">
                🎣 낚시하기
              </button>
            </div>
          )}
          <button disabled={busy} onClick={() => waitQuietly(c.id)} title="소음 감소">
            🤫 숨죽이고 기다리기
          </button>
          <button className="primary" disabled={engaged} onClick={() => returnHome(c.id)}>
            🏠 거점으로 귀환 ({Math.round(e.travelMs / 60000)}분)
          </button>
        </Panel>

        <div className="exp-center">
          {!enc && <MerchantPanel c={c} />}
          {enc ? (
            <Panel title={engaged ? '⚔️ 전투' : '👀 좀비 발견'} className="encounter">
              <div className="zombies">
                {enc.zombies.map((z) => (
                  <button key={z.id} className={`zombie ${tgt?.id === z.id ? 'target' : ''} ${z.staggered ? 'stagger' : ''}`} onClick={() => setTarget(z.id)}>
                    <span className="z-icon">{ZOMBIE_ICON[z.kind]}</span>
                    <span className="small">{ZOMBIE_NAME[z.kind]}</span>
                    {z.maxHp <= 8 ? (
                      <span className="z-hp" title={`체력 ${z.hp}/${z.maxHp}`}>
                        {Array.from({ length: z.maxHp }, (_, i) => (
                          <i key={i} className={i < z.hp ? 'full' : ''} />
                        ))}
                      </span>
                    ) : (
                      <div className="progress tiny red" style={{ width: '100%' }}>
                        <div style={{ width: `${(z.hp / z.maxHp) * 100}%` }} />
                      </div>
                    )}
                    <span className={`z-hp-num ${z.hp / z.maxHp <= 0.34 ? 'low' : ''}`}>
                      체력 {z.hp}/{z.maxHp}
                    </span>
                    {z.staggered && <span className="tag">넘어짐</span>}
                  </button>
                ))}
              </div>
              <div className="row wrap combat-actions">
                <button className="primary" onClick={() => tgt && attack(c.id, tgt.id)}>
                  {engaged ? '🗡️ 공격' : '🗡️ 기습 공격'}
                </button>
                <button onClick={() => tgt && shove(c.id, tgt.id)} title="넘어뜨리면 다음 공격을 막고 추가 피해">
                  ✋ 밀치기
                </button>
                {!engaged && (
                  <button onClick={() => hide(c.id)} title="은신 숙련도에 따라 성공">
                    🤫 숨기
                  </button>
                )}
                <button className="danger" onClick={() => flee(c.id)}>
                  🏃 도주
                </button>
              </div>
              <div className="muted small">
                좀비가 많을수록 도주가 어렵고, 큰 소음은 더 많은 좀비를 부른다. 때로는 싸우지 않는 것이 답이다.
              </div>
            </Panel>
          ) : e.found ? (
            <Panel title="🎁 발견한 물건" actions={<span className="muted small">가방 {weight}/{cap}kg</span>}>
              {e.found.items.map((it) => (
                <label key={it.uid} className="row item-row check">
                  <input
                    type="checkbox"
                    checked={picked.includes(it.uid)}
                    onChange={(ev) => setPicked(ev.target.checked ? [...picked, it.uid] : picked.filter((x) => x !== it.uid))}
                  />
                  <StackLabel s={it} />
                  <span className="muted small">{Math.round(ITEMS[it.itemId].weight * it.qty * 10) / 10}kg</span>
                </label>
              ))}
              <div className="row wrap">
                <button
                  className="primary"
                  onClick={() => {
                    const err = takeFound(c.id, 'all');
                    if (err) toast(err, 'bad');
                    setPicked([]);
                  }}
                >
                  모두 가져가기
                </button>
                <button
                  disabled={!picked.length}
                  onClick={() => {
                    const err = takeFound(c.id, picked);
                    if (err) toast(err, 'bad');
                    setPicked([]);
                  }}
                >
                  선택한 것만
                </button>
                <button className="ghost" onClick={() => leaveFound(c.id)}>
                  두고 가기
                </button>
              </div>
            </Panel>
          ) : (
            <Panel title={`🔍 ${zone.name} 수색`}>
              <p className="muted">{zone.desc}</p>
              <div className="spots">
                {zone.spots.map((sp) => {
                  const st = zs.spots[sp.id];
                  return (
                    <div key={sp.id} className={`spot ${st.remaining <= 0 ? 'empty' : ''}`}>
                      <div>
                        <b>{sp.name}</b> {sp.dark && <span title="어두운 곳">🌑</span>}
                      </div>
                      <div className="small muted">
                        남은 물자: {amount(st.remaining, sp.capacity)} · 수색 {st.searched}회
                      </div>
                      <div className="row">
                        <button className="small" onClick={() => search(c.id, sp.id, 'careful')} title="조용히 꼼꼼하게 (기력 소모 큼)">
                          꼼꼼히
                        </button>
                        <button className="small" onClick={() => search(c.id, sp.id, 'quick')} title="빠르지만 시끄럽고 놓치는 게 많다">
                          빠르게
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
          <Panel title="📜 탐험 기록" className="exp-log-panel">
            <div className="exp-log" ref={logRef}>
              {e.log.map((l, i) => (
                <div key={i} className={`log-line ${l.kind ?? ''}`}>
                  <span className="rp-time">{formatTime(l.t).split(' ')[1]}</span> {l.text}
                </div>
              ))}
            </div>
          </Panel>
        </div>

      </div>
    </div>
  );
}
