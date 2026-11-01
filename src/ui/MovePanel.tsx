import { useEffect, useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { canEdit, freeStarters, residentsOf, starterLabel } from '../game/homes';
import { store, useSession } from '../game/store';
import { vehiclesIn } from '../game/systems/expedition';
import { moveTargetName, planErrand, planMove, startErrand, startMove, type MoveTarget } from '../game/systems/move';
import type { Character } from '../game/types';
import { Panel, StackLabel } from './common';
import { partyOf } from '../game/systems/social';

/** 이사하기: 갈 곳 · 가져갈 짐 · 이동수단 */
export function MovePanel({ c }: { c: Character }) {
  const s = store.s;
  const home = s.bases[c.homeId];
  const [target, setTarget] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [vehicleUid, setVehicleUid] = useState('');
  const [withParty, setWithParty] = useState(true);
  if (c.move) return <MovingStatus c={c} />;
  if (!home) return null;

  const others = Object.values(s.bases).filter((b) => b.id !== home.id);
  const free = freeStarters(s);
  const t: MoveTarget | null = target.startsWith('base:')
    ? { kind: 'base', baseId: target.slice(5) }
    : target.startsWith('new:')
      ? { kind: 'starter', starter: Number(target.slice(4)) }
      : null;
  const vehicles = vehiclesIn(home.storage);
  const goods = home.storage.filter((x) => !ITEMS[x.itemId]?.vehicle);
  const pickList = Object.entries(picks)
    .filter(([, q]) => q > 0)
    .map(([uid, qty]) => ({ uid, qty }));
  const plan = t ? planMove(c, t, pickList, vehicleUid || undefined) : null;
  const allIn = () => setPicks(Object.fromEntries(goods.map((x) => [x.uid, x.qty])));
  // 같은 집에 사는 파티원 (거점에 있고 바쁘지 않은)
  const mates = partyOf(c).filter((o) => o.id !== c.id && o.homeId === c.homeId && o.status === 'base' && !o.crafting);

  return (
    <Panel title="📦 이사하기">
      <label className="field">
        갈 곳
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— 고르기 —</option>
          {others.length > 0 && (
            <optgroup label="다른 거점에 들어가 살기">
              {others.map((b) => {
                const who = residentsOf(s, b.id);
                return (
                  <option key={b.id} value={`base:${b.id}`}>
                    ⌂ {b.name} — {who.length ? who.map((x) => x.name).join(', ') : '빈 집'}
                  </option>
                );
              })}
            </optgroup>
          )}
          {free.length > 0 && (
            <optgroup label="빈 집으로 새로 옮기기">
              {free.map((i) => {
                const l = starterLabel(i);
                return (
                  <option key={i} value={`new:${i}`}>
                    {l.area} {l.kind}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
      </label>
      <label className="field">
        이동수단
        <select value={vehicleUid} onChange={(e) => setVehicleUid(e.target.value)}>
          <option value="">🚶 걸어서 (12kg + 가방)</option>
          {vehicles.map((v) => (
            <option key={v.uid} value={v.uid}>
              {ITEMS[v.itemId].icon} {ITEMS[v.itemId].name} (+{ITEMS[v.itemId].vehicle?.carry}kg{ITEMS[v.itemId].vehicle?.fuel ? ', 휘발유 1통' : ''})
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <div className="row item-row">
          <span>가져갈 짐 ({home.name} 창고)</span>
          <span className="row">
            <button className="small" onClick={allIn}>
              전부
            </button>
            <button className="small" onClick={() => setPicks({})}>
              비우기
            </button>
          </span>
        </div>
        <div className="supply-list">
          {goods.map((x) => (
            <div key={x.uid} className="row item-row">
              <StackLabel s={x} />
              <span className="stepper">
                <button className="small" onClick={() => setPicks({ ...picks, [x.uid]: Math.max(0, (picks[x.uid] ?? 0) - 1) })}>
                  −
                </button>
                <b>{picks[x.uid] ?? 0}</b>
                <button className="small" onClick={() => setPicks({ ...picks, [x.uid]: Math.min(x.qty, (picks[x.uid] ?? 0) + 1) })}>
                  +
                </button>
                <button className="small ghost" onClick={() => setPicks({ ...picks, [x.uid]: x.qty })}>
                  모두
                </button>
              </span>
            </div>
          ))}
          {goods.length === 0 && <div className="muted small">창고가 비어 있다.</div>}
        </div>
      </div>
      {plan && (
        <div className="small">
          짐 {plan.weight}kg · 한 번에 {plan.capacity}kg → {plan.trips > 1 ? <b className="bad-text">{plan.trips}번 날라야 함</b> : '한 번에 옮김'} · 걸리는 시간 <b>{plan.minutes}분</b>
        </div>
      )}
      <div className="muted small">가구는 창고에 넣어 둔 것만 가져갈 수 있다. 남긴 물건은 옛 집 창고에 그대로 남는다.</div>
      {mates.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={withParty} onChange={(e) => setWithParty(e.target.checked)} />
          ⚑ 같은 집 파티원도 같이 이사 ({mates.map((m) => m.name).join(', ')}) — 맨몸으로
        </label>
      )}
      {plan?.error && <div className="warn">{plan.error}</div>}
      <button
        className="primary"
        disabled={!t || !!plan?.error}
        onClick={() => {
          if (!t) return;
          if (!confirm(`${c.name}을(를) ${moveTargetName(t)}(으)로 이사시킬까요?`)) return;
          const err = startMove(c, t, pickList, vehicleUid || undefined);
          if (!err && withParty) for (const m of mates) startMove(m, t, []);
          if (err) toast(err, 'bad');
          else {
            toast(`${c.name} 이사 출발!`, 'good');
            setPicks({});
            setTarget('');
          }
        }}
      >
        📦 이사 출발{plan ? ` (${plan.minutes}분)` : ''}
      </button>
    </Panel>
  );
}

/** 이사 중: 어디로, 얼마나 남았는지 */
export function MovingStatus({ c, compact }: { c: Character; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const m = c.move;
  if (!m) return null;
  const total = Math.max(1, m.arriveAt - m.startedAt);
  const pct = Math.min(100, ((now - m.startedAt) / total) * 100);
  const left = Math.max(0, Math.ceil((m.arriveAt - now) / 1000));
  const body = (
    <>
      <div className="row item-row">
        <span>📦 {moveTargetName(m)}(으)로 이사 중</span>
        <b>
          {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}
        </b>
      </div>
      <div className="travel-bar">
        <div className="travel-fill" style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <div className="small">
          {m.items.map((x) => (
            <span key={x.uid} style={{ marginRight: 6 }}>
              <StackLabel s={x} />
            </span>
          ))}
        </div>
      )}
    </>
  );
  return compact ? <div className="craft-job compact">{body}</div> : <Panel title="📦 이사 중">{body}</Panel>;
}

/** 물건 고르기 목록 (− 수량 + 모두) */
function PickList({ list, picks, setPicks, empty }: { list: import('../game/types').ItemStack[]; picks: Record<string, number>; setPicks: (p: Record<string, number>) => void; empty: string }) {
  return (
    <div className="supply-list">
      {list.map((x) => (
        <div key={x.uid} className="row item-row">
          <StackLabel s={x} />
          <span className="stepper">
            <button className="small" onClick={() => setPicks({ ...picks, [x.uid]: Math.max(0, (picks[x.uid] ?? 0) - 1) })}>
              −
            </button>
            <b>{picks[x.uid] ?? 0}</b>
            <button className="small" onClick={() => setPicks({ ...picks, [x.uid]: Math.min(x.qty, (picks[x.uid] ?? 0) + 1) })}>
              +
            </button>
            <button className="small ghost" onClick={() => setPicks({ ...picks, [x.uid]: x.qty })}>
              모두
            </button>
          </span>
        </div>
      ))}
      {list.length === 0 && <div className="muted small">{empty}</div>}
    </div>
  );
}

const toList = (p: Record<string, number>) =>
  Object.entries(p)
    .filter(([, q]) => q > 0)
    .map(([uid, qty]) => ({ uid, qty }));

/** 심부름: 다른 거점에 다녀오며 물건을 가져오거나 갖다준다 */
export function ErrandPanel({ c }: { c: Character }) {
  const s = store.s;
  const session = useSession();
  const home = s.bases[c.homeId];
  const [baseId, setBaseId] = useState('');
  const [give, setGive] = useState<Record<string, number>>({});
  const [take, setTake] = useState<Record<string, number>>({});
  const [vehicleUid, setVehicleUid] = useState('');
  if (c.errand) return <ErrandStatus c={c} />;
  if (!home || c.move) return null;
  const others = Object.values(s.bases).filter((b) => b.id !== home.id);
  if (!others.length) return null;
  const target = s.bases[baseId];
  const mayTake = target ? canEdit(s, target.id, session.player) : false;
  const vehicles = vehiclesIn(home.storage);
  const plan = target ? planErrand(c, target.id, toList(give), mayTake ? toList(take) : [], session.player, vehicleUid || undefined) : null;
  return (
    <Panel title="🚚 심부름 (가져오기 · 갖다주기)">
      <label className="field">
        다녀올 곳
        <select
          value={baseId}
          onChange={(e) => {
            setBaseId(e.target.value);
            setTake({});
          }}
        >
          <option value="">— 고르기 —</option>
          {others.map((b) => {
            const who = residentsOf(s, b.id);
            return (
              <option key={b.id} value={b.id}>
                ⌂ {b.name} — {who.length ? who.map((x) => x.name).join(', ') : '빈 집'}
                {canEdit(s, b.id, session.player) ? '' : ' 🔒'}
              </option>
            );
          })}
        </select>
      </label>
      {target && (
        <>
          <div className="field">
            <div>갖다줄 것 ({home.name} 창고에서)</div>
            <PickList list={home.storage.filter((x) => !ITEMS[x.itemId]?.vehicle)} picks={give} setPicks={setGive} empty="창고가 비어 있다." />
          </div>
          <div className="field">
            <div>가져올 것 ({target.name} 창고에서)</div>
            {mayTake ? (
              <PickList list={target.storage} picks={take} setPicks={setTake} empty="그 집 창고가 비어 있다." />
            ) : (
              <div className="muted small">🔒 다른 사람이 사는 집이라 가져올 수 없다. 갖다주기만 된다.</div>
            )}
          </div>
          <label className="field">
            이동수단
            <select value={vehicleUid} onChange={(e) => setVehicleUid(e.target.value)}>
              <option value="">🚶 걸어서</option>
              {vehicles.map((v) => (
                <option key={v.uid} value={v.uid}>
                  {ITEMS[v.itemId].icon} {ITEMS[v.itemId].name} (+{ITEMS[v.itemId].vehicle?.carry}kg)
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {plan && (
        <div className="small">
          짐 {plan.weight}kg · 한 번에 {plan.capacity}kg → {plan.trips > 1 ? <b className="bad-text">{plan.trips}번 왕복</b> : '한 번에'} · 왕복 <b>{plan.minutes}분</b>
        </div>
      )}
      {plan?.error && <div className="warn">{plan.error}</div>}
      <button
        className="primary"
        disabled={!target || !!plan?.error}
        onClick={() => {
          if (!target) return;
          const err = startErrand(c, target.id, toList(give), mayTake ? toList(take) : [], session.player, vehicleUid || undefined);
          if (err) toast(err, 'bad');
          else {
            toast(`${c.name}이(가) ${target.name}에 다녀온다.`, 'good');
            setGive({});
            setTake({});
          }
        }}
      >
        🚚 다녀오기{plan ? ` (왕복 ${plan.minutes}분)` : ''}
      </button>
    </Panel>
  );
}

/** 심부름 중 */
export function ErrandStatus({ c, compact }: { c: Character; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const e = c.errand;
  if (!e) return null;
  const name = store.s.bases[e.baseId]?.name ?? '다른 거점';
  const goingBack = now >= e.arriveAt;
  const pct = Math.min(100, ((now - e.startedAt) / Math.max(1, e.returnAt - e.startedAt)) * 100);
  const left = Math.max(0, Math.ceil(((goingBack ? e.returnAt : e.arriveAt) - now) / 1000));
  const body = (
    <>
      <div className="row item-row">
        <span>🚚 {goingBack ? `${name}에서 돌아오는 중` : `${name}에 가는 중`}</span>
        <b>
          {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}
        </b>
      </div>
      <div className="travel-bar">
        <div className="travel-fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
  return compact ? <div className="craft-job compact">{body}</div> : <Panel title="🚚 심부름 중">{body}</Panel>;
}
