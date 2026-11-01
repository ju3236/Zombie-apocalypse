import { useEffect, useRef, useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { notify } from '../game/notify';
import { store, useSession } from '../game/store';
import { fixJosa } from '../game/util';
import {
  acceptRequest, declineRequest, finishRequest, leaveParty, nearby, partyOf, readyTrade, REQUEST_LABEL, sendRequest, setOffer, tradeSources, type TradeItem,
} from '../game/systems/social';
import { moodText } from '../game/systems/character';
import { JOB_BY_ID } from '../game/data/jobs';
import type { Character, SocialRequest } from '../game/types';
import { BodyPanel } from './BodyPanel';
import { Avatar, StackLabel, STATUS_LABEL } from './common';
import { EffectChips } from './Effects';

/** 근처 사람 + 파티 (오른쪽 캐릭터 카드 아래) */
export function NearbyPanel({ c }: { c: Character }) {
  const session = useSession();
  const [sel, setSel] = useState<string | null>(null);
  const near = nearby(c);
  const party = partyOf(c).filter((o) => o.id !== c.id);
  const o = near.find((x) => x.id === sel);
  const send = (kind: 'trade' | 'heal' | 'party', to: Character) => {
    const err = sendRequest(kind, c, to, session.player);
    if (err) toast(err, 'bad');
  };
  return (
    <div className="nearby">
      <div className="col-title">
        <span>👥 근처 사람 {near.length}</span>
      </div>
      {near.length === 0 && <div className="muted small">같은 곳에 있는 사람이 없다.</div>}
      <div className="nearby-list">
        {near.map((x) => (
          <button key={x.id} className={`nearby-item ${sel === x.id ? 'sel' : ''}`} onClick={() => setSel(sel === x.id ? null : x.id)}>
            <Avatar a={x.appearance} sprite={x.sprite} size={22} />
            <span className="nearby-name">
              {x.name}
              {x.partyId && x.partyId === c.partyId && <span className="tag">파티</span>}
            </span>
            <span className="muted small">{x.owner}</span>
          </button>
        ))}
      </div>
      {o && (
        <div className="nearby-card">
          <div className="row">
            <Avatar a={o.appearance} sprite={o.sprite} size={44} />
            <div>
              <b>{o.name}</b> <span className="muted small">{o.age}</span>
              <div className="muted small">
                {JOB_BY_ID[o.job]?.name} · {STATUS_LABEL[o.status]} · {moodText(o)} · 오너 {o.owner}
              </div>
              <EffectChips c={o} iconsOnly />
            </div>
          </div>
          {o.bio && <div className="small nearby-bio">{o.bio}</div>}
          <div className="row wrap">
            <button className="small" onClick={() => send('trade', o)}>
              🤝 교환
            </button>
            <button className="small" disabled={!o.injuries.length} onClick={() => send('heal', o)} title={o.injuries.length ? '' : '다친 곳이 없다'}>
              🩹 치료해 주기{o.injuries.length ? ` (${o.injuries.length})` : ''}
            </button>
            {!(c.partyId && c.partyId === o.partyId) && (
              <button className="small" onClick={() => send('party', o)}>
                👥 파티 초대
              </button>
            )}
          </div>
        </div>
      )}
      {c.partyId && (
        <div className="party-box">
          <div className="col-title">
            <span>⚑ 파티 {party.length + 1}명</span>
            <button className="ghost small" onClick={() => leaveParty(c)}>
              나가기
            </button>
          </div>
          <div className="small">
            {[c, ...party].map((m) => (
              <span key={m.id} className="chip">
                {m.name} · {STATUS_LABEL[m.status]}
              </span>
            ))}
          </div>
          <div className="muted small">탐험을 떠날 때 같은 거점에 있는 파티원과 같이 갈 수 있다.</div>
        </div>
      )}
    </div>
  );
}

/** 요청 알림 · 교환 창 · 치료 창 (화면 전체에 한 번) */
export function RequestCenter() {
  const session = useSession();
  const s = store.s;
  const me = session.player;
  const reqs = Object.values(s.requests ?? {});
  const mine = (id: string) => s.characters[id]?.owner === me;
  const seen = useRef<Map<string, SocialRequest['status']>>(new Map());

  // 새로 온 요청 · 내가 보낸 요청의 대답 알림
  useEffect(() => {
    for (const r of reqs) {
      const before = seen.current.get(r.id);
      if (before === r.status) continue;
      const from = s.characters[r.from];
      const to = s.characters[r.to];
      if (before !== undefined || r.status !== 'pending' || !mine(r.to) || mine(r.from)) {
        if (before === 'pending' && mine(r.from) && !mine(r.to)) {
          if (r.status === 'accepted' || r.status === 'done') toast(`${to?.name}이(가) ${REQUEST_LABEL[r.kind]} 요청을 받아들였다.`, 'good');
          if (r.status === 'declined') toast(`${to?.name}이(가) ${REQUEST_LABEL[r.kind]} 요청을 거절했다.`, 'info');
        }
      } else if (from && to) notify(`📨 ${REQUEST_LABEL[r.kind]} 요청`, fixJosa(`${from.name}(${from.owner})이(가) ${to.name}에게 ${REQUEST_LABEL[r.kind]}을(를) 청했다.`), 'info');
      seen.current.set(r.id, r.status);
    }
  });

  const incoming = reqs.filter((r) => r.status === 'pending' && mine(r.to));
  const trades = reqs.filter((r) => r.kind === 'trade' && r.status === 'accepted' && (mine(r.from) || mine(r.to)));
  const heals = reqs.filter((r) => r.kind === 'heal' && r.status === 'accepted' && (mine(r.from) || mine(r.to)));
  if (!incoming.length && !trades.length && !heals.length) return null;
  return (
    <div className="social-layer">
      {incoming.map((r) => {
        const from = s.characters[r.from];
        const to = s.characters[r.to];
        if (!from || !to) return null;
        return (
          <div key={r.id} className="req-card">
            <div className="row">
              <Avatar a={from.appearance} sprite={from.sprite} size={32} />
              <div>
                <b>{from.name}</b> <span className="muted small">({from.owner})</span>
                <div className="small">
                  → {to.name}에게 <b>{REQUEST_LABEL[r.kind]}</b>
                  {r.kind === 'heal' ? '해 주겠다고 한다' : r.kind === 'party' ? '를 했다' : '을 하자고 한다'}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="primary small" onClick={() => acceptRequest(r.id)}>
                수락
              </button>
              <button className="small" onClick={() => declineRequest(r.id)}>
                거절
              </button>
            </div>
          </div>
        );
      })}
      {trades.map((r) => (
        <TradeWindow key={r.id} r={r} />
      ))}
      {heals.map((r) => (
        <HealWindow key={r.id} r={r} />
      ))}
    </div>
  );
}

/** 교환 창: 서로 물건을 올리고, 둘 다 확정하면 바뀐다 */
function TradeWindow({ r }: { r: SocialRequest }) {
  const session = useSession();
  const s = store.s;
  const a = s.characters[r.from];
  const b = s.characters[r.to];
  if (!a || !b) return null;
  // 내 쪽 (둘 다 내 캐릭터면 보낸 쪽을 내 쪽으로)
  const meC = a.owner === session.player ? a : b;
  const other = meC === a ? b : a;
  const both = a.owner === b.owner;
  return (
    <div className="social-modal trade">
      <div className="sm-head">
        <b>🤝 교환 — {a.name} ↔ {b.name}</b>
        <button className="ghost" onClick={() => declineRequest(r.id)}>
          취소
        </button>
      </div>
      <div className="trade-cols">
        <OfferSide c={meC} editable />
        <OfferSide c={other} editable={both} />
      </div>
      <div className="muted small">둘 다 확정하면 물건이 바뀐다. 올린 물건을 바꾸면 확정이 풀린다.</div>
    </div>
  );
}

function OfferSide({ c, editable }: { c: Character; editable: boolean }) {
  const offer = c.offer;
  const [open, setOpen] = useState(false);
  if (!offer) return <div className="offer-side muted">…</div>;
  const key = (x: TradeItem) => `${x.src}:${x.uid}`;
  const qty = (src: 'inv' | 'storage', uid: string) => offer.items.find((x) => x.src === src && x.uid === uid)?.qty ?? 0;
  const change = (src: 'inv' | 'storage', uid: string, max: number, d: number) => {
    const map = new Map(offer.items.map((x) => [key(x), x]));
    const cur = map.get(`${src}:${uid}`);
    const q = Math.max(0, Math.min(max, (cur?.qty ?? 0) + d));
    map.set(`${src}:${uid}`, { src, uid, qty: q });
    setOffer(c, [...map.values()]);
  };
  const srcs = tradeSources(c);
  const find = (x: TradeItem) => srcs.find((g) => g.src === x.src)?.list.find((st) => st.uid === x.uid);
  return (
    <div className={`offer-side ${offer.ready ? 'ready' : ''}`}>
      <div className="row item-row">
        <span className="row">
          <Avatar a={c.appearance} sprite={c.sprite} size={22} /> <b>{c.name}</b>
        </span>
        {offer.ready ? <span className="tag ok">확정</span> : <span className="tag dim">고르는 중</span>}
      </div>
      <div className="offer-items">
        {offer.items.length === 0 && <div className="muted small">올린 물건 없음</div>}
        {offer.items.map((x) => {
          const st = find(x);
          return (
            <div key={key(x)} className="small">
              {st ? `${ITEMS[st.itemId].icon} ${ITEMS[st.itemId].name} ×${x.qty}` : '(사라진 물건)'} <span className="muted">{x.src === 'storage' ? '창고' : '소지품'}</span>
            </div>
          );
        })}
      </div>
      {editable && (
        <>
          <button className="small" onClick={() => setOpen(!open)}>
            {open ? '닫기' : '+ 물건 올리기'}
          </button>
          {open && (
            <div className="supply-list">
              {srcs.map((g) =>
                g.list
                  .filter((st) => !ITEMS[st.itemId]?.vehicle)
                  .map((st) => (
                    <div key={`${g.src}:${st.uid}`} className="row item-row">
                      <span>
                        <StackLabel s={st} /> <span className="muted small">{g.src === 'storage' ? '창고' : '소지품'}</span>
                      </span>
                      <span className="stepper">
                        <button className="small" onClick={() => change(g.src, st.uid, st.qty, -1)}>
                          −
                        </button>
                        <b>{qty(g.src, st.uid)}</b>
                        <button className="small" onClick={() => change(g.src, st.uid, st.qty, 1)}>
                          +
                        </button>
                      </span>
                    </div>
                  )),
              )}
            </div>
          )}
          <button
            className="primary"
            disabled={offer.ready}
            onClick={() => {
              const err = readyTrade(c);
              if (err) toast(err, 'bad');
            }}
          >
            {offer.ready ? '상대 확정 기다리는 중…' : '✔ 확정'}
          </button>
        </>
      )}
    </div>
  );
}

/** 치료 창: 치료하는 사람 쪽에는 상대의 몸 상태 창, 치료받는 쪽에는 안내 */
function HealWindow({ r }: { r: SocialRequest }) {
  const session = useSession();
  const s = store.s;
  const healer = s.characters[r.from];
  const patient = s.characters[r.to];
  if (!healer || !patient) return null;
  if (healer.owner !== session.player)
    return (
      <div className="req-card">
        {fixJosa(`🩹 ${healer.name}이(가) ${patient.name}을(를) 치료해 주고 있다…`)}
      </div>
    );
  return (
    <div className="social-modal heal">
      <div className="sm-head">
        <b>
          🩹 {healer.name} → {patient.name} 치료
        </b>
        <button className="primary small" onClick={() => finishRequest(r.id)}>
          치료 끝
        </button>
      </div>
      <div className="muted small">다친 부위를 눌러 치료한다. 붕대·소독약은 {healer.name}의 것을 쓴다.</div>
      <BodyPanel c={patient} editable={false} healer={healer} />
    </div>
  );
}
