import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { SKILL_IDS, SKILL_LABEL, skillLevel } from '../game/data/jobs';
import { TRAIT_BY_ID, TRAITS } from '../game/data/traits';
import { store, useSession } from '../game/store';
import { EVENTS, forceEvent } from '../game/systems/events';
import { FACTIONS, FACTION_IDS } from '../game/systems/factions';
import {
  announce, cancelRaid, discoverAll, giveItem, gmAddRep, gmDismissMerchant, gmSpawnMerchant, gmSpawnNpc, healFull, isGm, restockAll, sendHome,
  setFaction, setGms, setSkill, setTraits, setVitals, setWeather, skipHours, startRaid, takeItem, type GiveTarget,
} from '../game/systems/gm';
import { WEATHER } from '../game/systems/weather';
import type { WeatherKind } from '../game/types';
import { Panel } from './common';

/** GM(운영자) 메뉴 */
export function GmView() {
  const session = useSession();
  const s = store.s;
  if (!isGm(s, session.player)) return <Panel title="🛠️ GM">GM만 볼 수 있다.</Panel>;
  return (
    <div className="gm-view">
      <div className="muted small gm-note">🛠️ GM 메뉴 — 여기서 한 일은 모두 거점 소식에 「🛠️ GM」으로 남는다.</div>
      <div className="gm-grid">
        <GmItems />
        <GmCharacter />
        <GmWorld />
        <GmEvents />
        <GmAdmin />
      </div>
    </div>
  );
}

function GmItems() {
  const s = store.s;
  const chars = s.characterOrder.map((id) => s.characters[id]).filter(Boolean);
  const [target, setTarget] = useState<string>(chars[0] ? `char:${chars[0].id}` : `base:${Object.keys(s.bases)[0]}`);
  const [q, setQ] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(1);
  const t: GiveTarget = { kind: target.startsWith('char:') ? 'char' : 'base', id: target.slice(5) };
  const inv = t.kind === 'char' ? s.characters[t.id]?.inventory : s.bases[t.id]?.storage;
  const list = Object.values(ITEMS)
    .filter((d) => !q.trim() || d.name.includes(q.trim()) || d.id.includes(q.trim()))
    .slice(0, 40);
  return (
    <Panel title="🎁 아이템 지급 · 회수">
      <label className="field">
        받을 곳
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <optgroup label="캐릭터 소지품">
            {chars.map((c) => (
              <option key={c.id} value={`char:${c.id}`}>
                {c.name} ({c.npc ? 'NPC' : c.owner})
              </option>
            ))}
          </optgroup>
          <optgroup label="거점 창고">
            {Object.values(s.bases).map((b) => (
              <option key={b.id} value={`base:${b.id}`}>
                ⌂ {b.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`아이템 검색 (${Object.keys(ITEMS).length}종)`} />
      <div className="gm-itemlist">
        {list.map((d) => (
          <button key={d.id} className={`small ${itemId === d.id ? 'active' : ''}`} onClick={() => setItemId(d.id)} title={d.desc}>
            {d.icon} {d.name}
          </button>
        ))}
      </div>
      <div className="row">
        <input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 80 }} />
        <button
          className="primary"
          disabled={!itemId}
          onClick={() => {
            const err = giveItem(t, itemId, qty);
            toast(err ?? `${ITEMS[itemId].name} ${qty}개 지급`, err ? 'bad' : 'good');
          }}
        >
          {itemId ? `${ITEMS[itemId].icon} ${ITEMS[itemId].name} ×${qty} 지급` : '아이템을 고르세요'}
        </button>
      </div>
      <details>
        <summary className="small">지금 들어 있는 것 ({inv?.length ?? 0}칸) — 눌러서 회수</summary>
        <div className="gm-itemlist">
          {(inv ?? []).map((st) => (
            <button key={st.uid} className="small ghost" onClick={() => confirm(`${ITEMS[st.itemId]?.name} ${st.qty}개를 회수할까요?`) && takeItem(t, st.uid)}>
              {ITEMS[st.itemId]?.icon} {ITEMS[st.itemId]?.name} ×{st.qty} ✕
            </button>
          ))}
        </div>
      </details>
    </Panel>
  );
}

function GmCharacter() {
  const s = store.s;
  const chars = s.characterOrder.map((id) => s.characters[id]).filter(Boolean);
  const [id, setId] = useState(chars[0]?.id ?? '');
  const [addTrait, setAddTrait] = useState('');
  const c = s.characters[id];
  return (
    <Panel title="🧍 캐릭터">
      <select value={id} onChange={(e) => setId(e.target.value)}>
        {chars.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} ({x.npc ? 'NPC' : x.owner}) · {x.status}
          </option>
        ))}
      </select>
      {c && (
        <>
          <div className="gm-vitals">
            {(['health', 'hunger', 'thirst', 'energy', 'infection'] as const).map((k) => (
              <label key={k} className="gm-slider">
                <span>{{ health: '체력', hunger: '포만', thirst: '수분', energy: '기력', infection: '감염' }[k]}</span>
                <input type="range" min={0} max={100} value={Math.round(c[k])} onChange={(e) => setVitals(c, { [k]: Number(e.target.value) })} />
                <b>{Math.round(c[k])}</b>
              </label>
            ))}
          </div>
          <div className="row wrap">
            <button className="primary" onClick={() => healFull(c)}>
              💖 완전 회복 (상처·감염 제거, 쓰러짐·사망 해제)
            </button>
            <button onClick={() => sendHome(c)} disabled={c.status === 'base'}>
              🏠 바로 거점으로
            </button>
          </div>
          <details>
            <summary className="small">숙련 레벨</summary>
            <div className="gm-skills">
              {SKILL_IDS.map((sk) => (
                <label key={sk} className="small">
                  {SKILL_LABEL[sk]}
                  <input type="number" min={0} max={10} value={skillLevel(c.skills[sk])} onChange={(e) => setSkill(c, sk, Number(e.target.value))} style={{ width: 52 }} />
                </label>
              ))}
            </div>
          </details>
          <details>
            <summary className="small">특성 ({c.traits?.length ?? 0})</summary>
            <div className="chips">
              {(c.traits ?? []).map((tid) => (
                <button key={tid} className={`trait-chip ${TRAIT_BY_ID[tid]?.kind} on`} onClick={() => setTraits(c, (c.traits ?? []).filter((x) => x !== tid))}>
                  {TRAIT_BY_ID[tid]?.name ?? tid} ✕
                </button>
              ))}
            </div>
            <div className="row">
              <select value={addTrait} onChange={(e) => setAddTrait(e.target.value)}>
                <option value="">+ 특성 추가…</option>
                {TRAITS.filter((t) => !(c.traits ?? []).includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.kind === 'pos' ? '👍' : t.kind === 'neg' ? '👎' : '🏅'} {t.name}
                  </option>
                ))}
              </select>
              <button disabled={!addTrait} onClick={() => (setTraits(c, [...(c.traits ?? []), addTrait]), setAddTrait(''))}>
                추가
              </button>
            </div>
          </details>
        </>
      )}
    </Panel>
  );
}

function GmWorld() {
  const s = store.s;
  const bases = Object.values(s.bases);
  const [baseId, setBaseId] = useState(bases[0]?.id ?? '');
  const [weather, setW] = useState<WeatherKind>('clear');
  const [raidSize, setRaidSize] = useState(8);
  return (
    <Panel title="🌍 세계">
      <div className="row wrap">
        <span className="small">⏩ 시간</span>
        {[1, 6, 24].map((h) => (
          <button key={h} className="small" onClick={() => skipHours(h)}>
            +{h}시간
          </button>
        ))}
      </div>
      <div className="row wrap">
        <select value={weather} onChange={(e) => setW(e.target.value as WeatherKind)}>
          {Object.entries(WEATHER).map(([k, w]) => (
            <option key={k} value={k}>
              {w.icon} {w.name}
            </option>
          ))}
        </select>
        <button className="small" onClick={() => setWeather(weather, 6)}>
          날씨 바꾸기 (6시간)
        </button>
      </div>
      <label className="field">
        거점
        <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              ⌂ {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row wrap">
        <input type="number" min={1} max={40} value={raidSize} onChange={(e) => setRaidSize(Number(e.target.value))} style={{ width: 60 }} />
        <button className="small danger" onClick={() => startRaid(baseId, raidSize)}>
          🧟 습격 보내기
        </button>
        <button className="small" disabled={!s.raid} onClick={cancelRaid}>
          습격 취소
        </button>
      </div>
      <div className="row wrap">
        <button className="small" onClick={() => toast(gmSpawnNpc(baseId) ?? 'NPC가 합류했다.', 'info')}>
          🤝 NPC 생존자 합류
        </button>
        <button className="small" onClick={() => gmAddRep(baseId, 10)}>
          평판 +10
        </button>
        <button className="small" onClick={() => gmAddRep(baseId, -10)}>
          평판 −10
        </button>
      </div>
      <div className="row wrap">
        <button className="small" onClick={gmSpawnMerchant}>
          🧳 유랑 상인 소환
        </button>
        <button className="small" disabled={!s.merchant} onClick={gmDismissMerchant}>
          상인 떠나보내기
        </button>
      </div>
      <div className="row wrap">
        <button className="small" onClick={() => confirm('숨은 장소를 모두 공개할까요?') && discoverAll()}>
          🗺️ 숨은 장소 모두 공개
        </button>
        <button className="small" onClick={() => confirm('모든 탐험지의 물자를 다시 채울까요?') && restockAll()}>
          📦 탐험지 물자 다시 채우기
        </button>
      </div>
      <details>
        <summary className="small">세력 태도</summary>
        {FACTION_IDS.map((fid) => (
          <label key={fid} className="gm-slider">
            <span>
              {FACTIONS[fid].icon} {FACTIONS[fid].name}
            </span>
            <input type="range" min={-100} max={100} value={s.factions[fid] ?? 0} onChange={(e) => setFaction(fid, Number(e.target.value))} />
            <b>{s.factions[fid] ?? 0}</b>
          </label>
        ))}
      </details>
    </Panel>
  );
}

function GmEvents() {
  const s = store.s;
  const bases = Object.values(s.bases);
  const [kind, setKind] = useState(Object.keys(EVENTS)[0]);
  const [baseId, setBaseId] = useState(bases[0]?.id ?? '');
  const [text, setText] = useState('');
  return (
    <Panel title="🎲 사건 · 공지">
      <label className="field">
        사건
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(EVENTS).map(([k, d]) => (
            <option key={k} value={k}>
              {d.icon} {d.title}
              {d.season ? ' (명절)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              ⌂ {b.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          onClick={() => {
            const err = forceEvent(kind, baseId);
            toast(err ?? '사건을 일으켰다. 모두에게 투표 창이 뜬다.', err ? 'bad' : 'good');
          }}
        >
          일으키기
        </button>
      </div>
      <div className="divider small">📢 공지 (채팅에 크게)</div>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="모두에게 알릴 말" />
      <button
        disabled={!text.trim()}
        onClick={() => {
          announce(text);
          setText('');
        }}
      >
        공지 보내기
      </button>
    </Panel>
  );
}

function GmAdmin() {
  const s = store.s;
  const gms = s.settings.gms ?? [];
  return (
    <Panel title="👑 GM 관리">
      <div className="small">지금 GM: {gms.join(', ') || '없음'}</div>
      <div className="chips">
        {s.players.map((p) => (
          <label key={p} className="check small">
            <input
              type="checkbox"
              checked={gms.includes(p)}
              onChange={(e) => {
                const next = e.target.checked ? [...gms, p] : gms.filter((x) => x !== p);
                if (!next.length) return toast('GM은 한 명 이상 있어야 한다.', 'bad');
                setGms(next);
              }}
            />
            {p}
          </label>
        ))}
      </div>
      <div className="muted small">GM으로 체크한 플레이어만 위쪽에 🛠️ GM 탭이 보인다.</div>
    </Panel>
  );
}
