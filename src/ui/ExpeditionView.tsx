import { useEffect, useRef, useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { LOCATION_BY_ID } from '../game/data/locations';
import { countItem, hasTag } from '../game/inventory';
import { store } from '../game/store';
import { carriedWeight, carryCapacity, injuryName } from '../game/systems/character';
import {
  attack, dropItem, flee, hide, leaveFound, moveZone, returnHome, search, shove, takeFound, unlockZone, consumeInField, waitQuietly, ZOMBIE_NAME,
} from '../game/systems/expedition';
import type { Character, Expedition } from '../game/types';
import { formatTime } from '../game/util';
import { Avatar, Bar, ItemName, Panel, StackLabel } from './common';

export function ExpeditionScreen({ e, c }: { e: Expedition; c: Character }) {
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
          <Avatar a={c.appearance} size={40} />
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
          <button disabled={busy} onClick={() => waitQuietly(c.id)} title="20분 소모, 소음 감소">
            🤫 숨죽이고 기다리기
          </button>
          <button className="primary" disabled={engaged} onClick={() => returnHome(c.id)}>
            🏠 거점으로 귀환 ({loc.travel}분)
          </button>
        </Panel>

        <div className="exp-center">
          {enc ? (
            <Panel title={engaged ? '⚔️ 전투' : '👀 좀비 발견'} className="encounter">
              <div className="zombies">
                {enc.zombies.map((z) => (
                  <button key={z.id} className={`zombie ${tgt?.id === z.id ? 'target' : ''} ${z.staggered ? 'stagger' : ''}`} onClick={() => setTarget(z.id)}>
                    <span className="z-icon">{z.kind === 'bloated' ? '🧟‍♂️' : z.kind === 'runner' ? '🏃' : '🧟'}</span>
                    <span className="small">{ZOMBIE_NAME[z.kind]}</span>
                    <div className="progress tiny red">
                      <div style={{ width: `${(z.hp / z.maxHp) * 100}%` }} />
                    </div>
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
            <Panel title="🎁 발견한 물건">
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
                        <button className="small" onClick={() => search(c.id, sp.id, 'careful')} title="30분, 조용히 꼼꼼하게">
                          꼼꼼히 (30분)
                        </button>
                        <button className="small" onClick={() => search(c.id, sp.id, 'quick')} title="10분, 시끄럽고 놓치는 게 많다">
                          빠르게 (10분)
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

        <Panel title={`🎒 소지품 ${weight}/${cap}kg`}>
          <div className="progress">
            <div style={{ width: `${Math.min(100, (weight / cap) * 100)}%`, background: weight > cap * 0.9 ? '#e74c3c' : undefined }} />
          </div>
          {c.injuries.length > 0 && (
            <div className="injuries small">
              {c.injuries.map((i) => (
                <span key={i.id} className={`chip ${i.bandaged ? 'ok' : 'bad'}`}>
                  {injuryName(i.type)}
                  {i.bandaged ? '(붕대)' : '(출혈)'}
                </span>
              ))}
            </div>
          )}
          {c.inventory.map((x) => {
            const d = ITEMS[x.itemId];
            return (
              <div key={x.uid} className="row item-row">
                <ItemName id={x.itemId} qty={x.qty} dur={x.durability} />
                <span className="row">
                  {(d.consume || d.treat) && (
                    <button className="small" onClick={() => consumeInField(c.id, x.itemId)}>
                      사용
                    </button>
                  )}
                  <button className="small ghost" disabled={engaged} onClick={() => dropItem(c.id, x.uid)}>
                    버리기
                  </button>
                </span>
              </div>
            );
          })}
          {c.inventory.length === 0 && <div className="muted small">비어 있음</div>}
        </Panel>
      </div>
    </div>
  );
}
