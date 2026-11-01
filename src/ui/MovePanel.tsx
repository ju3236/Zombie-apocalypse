import { useEffect, useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { freeStarters, residentsOf, starterLabel } from '../game/homes';
import { store } from '../game/store';
import { vehiclesIn } from '../game/systems/expedition';
import { moveTargetName, planMove, startMove, type MoveTarget } from '../game/systems/move';
import type { Character } from '../game/types';
import { Panel, StackLabel } from './common';

/** 이사하기: 갈 곳 · 가져갈 짐 · 이동수단 */
export function MovePanel({ c }: { c: Character }) {
  const s = store.s;
  const home = s.bases[c.homeId];
  const [target, setTarget] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [vehicleUid, setVehicleUid] = useState('');
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
      {plan?.error && <div className="warn">{plan.error}</div>}
      <button
        className="primary"
        disabled={!t || !!plan?.error}
        onClick={() => {
          if (!t) return;
          if (!confirm(`${c.name}을(를) ${moveTargetName(t)}(으)로 이사시킬까요?`)) return;
          const err = startMove(c, t, pickList, vehicleUid || undefined);
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
