import { useState, type ReactNode } from 'react';
import { bus, toast } from '../game/bus';
import { FURNITURE } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import { TASK_LABEL } from '../game/data/jobs';
import { countItem, totalWeight } from '../game/inventory';
import { sessionStore, store, useSession } from '../game/store';
import { collectProduction, pickupFurniture, plant, removeProp, rotateFurniture, setOwner } from '../game/systems/base';
import { moodText } from '../game/systems/character';
import { giftFromPersonal, postRp, sitTogether, support, treat } from '../game/systems/rp';
import type { RpMessage } from '../game/types';
import { fixJosa, formatTime } from '../game/util';
import { toolStore } from '../phaser/tool';
import { activeCharacter, allCharacters, Avatar, ItemName, Panel, StackLabel, STATUS_LABEL, Vitals } from './common';

export function FurniturePanel({ uid, onClose }: { uid: string; onClose: () => void }) {
  const s = store.s;
  const f = s.base.furniture.find((x) => x.uid === uid);
  if (!f) return null;
  const def = FURNITURE[f.itemId];
  const item = ITEMS[f.itemId];
  const prod = def?.production;
  const chars = allCharacters().filter((c) => c.status !== 'dead');
  const propsInStorage = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'prop');

  return (
    <Panel
      title={
        <>
          {item.icon} {item.name}
        </>
      }
      actions={
        <button className="ghost" onClick={onClose}>
          ✕
        </button>
      }
    >
      <p className="muted">{item.desc}</p>
      {def?.container && (
        <button className="primary" style={{ width: '100%', marginBottom: 6 }} onClick={() => bus.emit('openContainer', { uid: f.uid })}>
          📦 열기 ({totalWeight(f.items ?? [])}/{def.container}kg · {(f.items ?? []).reduce((n, x) => n + x.qty, 0)}개)
        </button>
      )}
      <div className="row wrap">
        <button onClick={() => toolStore.set({ kind: 'move', uid: f.uid, itemId: f.itemId, rot: f.rot })}>옮기기</button>
        <button onClick={() => !rotateFurniture(f.uid) && toast('회전할 공간이 없다.', 'bad')}>회전</button>
        <button
          onClick={() => {
            pickupFurniture(f.uid);
            onClose();
          }}
        >
          회수 (창고로)
        </button>
      </div>
      <label className="field">
        소유자 (개인 가구)
        <select value={f.ownerId ?? ''} onChange={(e) => setOwner(f.uid, e.target.value)}>
          <option value="">공용</option>
          {chars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {def?.surface && (
        <div className="field">
          <div>
            올려둔 소품 ({f.props.length}/{def.surface})
          </div>
          <div className="chips">
            {f.props.map((p, i) => (
              <button key={i} className="chip" title="클릭하면 창고로 회수" onClick={() => removeProp(f.uid, i)}>
                {ITEMS[p].icon} {ITEMS[p].name} ✕
              </button>
            ))}
          </div>
          {f.props.length < def.surface && propsInStorage.length > 0 && (
            <select value="" onChange={(e) => e.target.value && toolStore.set({ kind: 'prop', propId: e.target.value })}>
              <option value="">+ 소품 올리기…</option>
              {propsInStorage.map((x) => (
                <option key={x.uid} value={x.itemId}>
                  {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {prod && f.prod && (
        <div className="field prod">
          <div>
            생산: <ItemName id={prod.output} /> · 보관 {f.prod.stored}/{prod.cap}
          </div>
          {prod.needsSeed && !f.prod.planted && f.prod.stored === 0 ? (
            <div className="row">
              <span className="muted">비어 있음</span>
              <button
                disabled={countItem(s.storage, prod.needsSeed) === 0}
                onClick={() => {
                  const err = plant(f.uid);
                  toast(err ?? '씨앗을 심었다. (실시간으로 자란다)', err ? 'bad' : 'good');
                }}
              >
                🌱 씨앗 심기 (보유 {countItem(s.storage, prod.needsSeed)})
              </button>
            </div>
          ) : (
            <div className="progress">
              <div style={{ width: `${Math.round((f.prod.stored >= prod.cap ? 1 : f.prod.progress) * 100)}%` }} />
            </div>
          )}
          <div className="muted small">
            1회 {prod.minutes}분(실제 시간) · 접속하지 않아도 진행됩니다
          </div>
          <button disabled={f.prod.stored <= 0} onClick={() => toast(`${collectProduction(f.uid)}개 수확!`, 'good')}>
            🧺 수확하기
          </button>
        </div>
      )}
      {def?.station && <div className="muted small">제작 시설: 이 가구가 있으면 관련 제작법을 사용할 수 있다.</div>}
    </Panel>
  );
}

export function CharacterQuickPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const s = store.s;
  const session = useSession();
  const c = s.characters[id];
  const me = activeCharacter();
  const [giftUid, setGiftUid] = useState('');
  if (!c) return null;
  const isMine = c.owner === session.player;
  // 치료(창고 붕대 사용)·함께 앉기 등은 내 캐릭터도 거점에 있어야 한다
  const other = me && me.id !== c.id && me.status === 'base';

  return (
    <Panel
      title={
        <span className="row">
          <Avatar a={c.appearance} size={28} /> {c.name}
        </span>
      }
      actions={
        <button className="ghost" onClick={onClose}>
          ✕
        </button>
      }
    >
      <div className="muted small">
        오너 {c.owner} · {STATUS_LABEL[c.status]} · {moodText(c)} · 작업: {TASK_LABEL[c.task]}
      </div>
      <Vitals c={c} compact />
      <div className="row wrap">
        {isMine && session.activeCharacterId !== c.id && <button onClick={() => sessionStore.update({ activeCharacterId: c.id })}>🎮 조종하기</button>}
        <button onClick={() => sessionStore.update({ tab: 'characters', viewCharId: c.id })}>상세 보기</button>
      </div>
      {other && (
        <>
          <div className="divider small">{me.name}(으)로 상호작용</div>
          <div className="row wrap">
            <button onClick={() => toast(treat(me.id, c.id), 'info')}>🩹 치료하기</button>
            <button onClick={() => sitTogether(me.id, c.id)}>🛋️ 함께 앉기</button>
            <button onClick={() => support(me.id, c.id)}>🤝 부축하기</button>
          </div>
          {me.inventory.length > 0 && (
            <div className="row">
              <select value={giftUid} onChange={(e) => setGiftUid(e.target.value)}>
                <option value="">🎁 {me.name}의 소지품에서 선물…</option>
                {me.inventory.map((x) => (
                  <option key={x.uid} value={x.uid}>
                    {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name} x{x.qty}
                  </option>
                ))}
              </select>
              <button
                disabled={!giftUid}
                onClick={() => {
                  giftFromPersonal(me.id, c.id, giftUid);
                  setGiftUid('');
                }}
              >
                주기
              </button>
            </div>
          )}
        </>
      )}
      {c.inventory.length > 0 && (
        <div className="small">
          소지품: {c.inventory.map((x) => <StackLabel key={x.uid} s={x} />).reduce<ReactNode[]>((a, b, i) => (i ? [...a, ', ', b] : [b]), [])}
        </div>
      )}
    </Panel>
  );
}

/** 채팅 입력창: 지금 조종 중인 캐릭터로 말한다 */
export function ChatInput({ multiline }: { multiline?: boolean }) {
  const me = activeCharacter();
  const [text, setText] = useState('');
  const canTalk = !!me && me.status !== 'dead';

  const send = () => {
    if (!text.trim() || !me) return;
    postRp('say', text, me.id);
    setText('');
  };
  const props = {
    value: text,
    disabled: !canTalk,
    placeholder: canTalk ? `${me.name}(으)로 채팅…` : '조종할 캐릭터를 먼저 선택하세요',
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
  };

  return (
    <div className="row chat-input">
      {multiline ? (
        <textarea
          rows={2}
          {...props}
          placeholder={fixJosa(props.placeholder) + (canTalk ? ' (Enter 전송 · Shift+Enter 줄바꿈)' : '')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
      ) : (
        <input {...props} placeholder={fixJosa(props.placeholder)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()} />
      )}
      <button className="primary" onClick={send} disabled={!canTalk || !text.trim()}>
        전송
      </button>
    </div>
  );
}

export function RpQuick() {
  const s = store.s;
  const recent = s.rpLog.slice(-14);
  return (
    <Panel
      title="💬 채팅"
      className="rp-quick"
      actions={
        <button className="ghost small" onClick={() => sessionStore.update({ tab: 'chat' })}>
          전체 보기 ▸
        </button>
      }
    >
      <div className="rp-feed">
        {recent.length === 0 && <div className="muted small">아직 대화가 없다. 첫 마디를 남겨보자.</div>}
        {recent.map((m) => (
          <RpLine key={m.id} m={m} />
        ))}
      </div>
      <ChatInput />
    </Panel>
  );
}

export function RpLine({ m }: { m: RpMessage }) {
  const s = store.s;
  const c = m.characterId ? s.characters[m.characterId] : null;
  const t = m.targetId ? s.characters[m.targetId] : null;
  return (
    <div className={`rp-line rp-${m.kind}`}>
      <span className="rp-time">{formatTime(m.t)}</span>
      {m.kind === 'system' ? (
        <span className="sys">{m.text}</span>
      ) : m.kind === 'letter' ? (
        <span className="letter">
          ✉️ <b>{c?.name}</b> → <b>{t?.name}</b>: {m.text}
        </span>
      ) : (
        <>
          {/* 예전 대사/지문/오너 기록도 모두 같은 채팅으로 보여준다 */}
          <b className="chat-name" style={{ color: c?.appearance.shirt }}>
            {c?.name ?? m.owner}
          </b>{' '}
          <span className="chat-text">{m.text}</span>
        </>
      )}
    </div>
  );
}

export function NewsFeed() {
  const s = store.s;
  return (
    <Panel title="📰 거점 소식" className="news">
      {s.news.slice(0, 20).map((n, i) => (
        <div key={i} className={`news-line ${n.kind ?? ''}`}>
          <span className="rp-time">{formatTime(n.t)}</span> {n.text}
        </div>
      ))}
    </Panel>
  );
}

