import { useEffect, useState } from 'react';
import { BodyPanel } from './BodyPanel';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { LOCATION_BY_ID } from '../game/data/locations';
import { JOB_BY_ID, JOBS, SKILL_IDS, SKILL_LABEL, skillLevel, TASK_DESC, TASK_LABEL, xpForLevel } from '../game/data/jobs';
import { addStack, takeStack } from '../game/inventory';
import { addNews, sessionStore, store, useSession } from '../game/store';
import { carriedWeight, carryCapacity, createCharacter, equipFromStorage, giveToCharacter, injuryName, moodText, unequip, consumeFrom } from '../game/systems/character';
import { postRp } from '../game/systems/rp';
import type { Appearance, BaseTask, Character } from '../game/types';
import { Avatar, Panel, StackLabel, STATUS_LABEL, Vitals } from './common';
import { prepareSprite } from '../game/spriteImage';
import { RpLine } from './panels';

const SKINS = ['#f3d2b3', '#e8b98f', '#c98e62', '#8d5a3b', '#5c3a24'];
const DEFAULT_APP: Appearance = { skin: '#f3d2b3', hair: '#2b1d14', shirt: '#4a7bb7', pants: '#3b3f4a' };

export function CharactersView() {
  const s = store.s;
  const session = useSession();
  const creating = session.viewCharId === '__new__' || s.characterOrder.length === 0;
  const c = session.viewCharId ? s.characters[session.viewCharId] : null;

  return (
    <div className="char-view">
      {creating ? (
        <CreateForm onDone={(newId) => sessionStore.update({ viewCharId: newId })} />
      ) : c ? (
        <CharacterDetail key={c.id} c={c} />
      ) : (
        <Overview />
      )}
    </div>
  );
}

/** 하루 소모량 기준으로 창고 식량·물이 며칠 버틸지 */
function supplyDays(): { food: number; water: number } {
  const s = store.s;
  const eaters = s.characterOrder.map((id) => s.characters[id]).filter((c) => c && c.status !== 'dead').length;
  if (!eaters) return { food: Infinity, water: Infinity };
  let food = 0;
  let water = 0;
  for (const st of s.storage) {
    const e = ITEMS[st.itemId]?.consume;
    if (!e || e.sick) continue;
    if (e.hunger && e.hunger > 0) food += e.hunger * st.qty;
    if (e.thirst && e.thirst > 0 && !e.sick) water += e.thirst * st.qty;
  }
  return { food: food / (eaters * 2.2 * 24 * 0.85), water: water / (eaters * 3.2 * 24 * 0.85) };
}

function Overview() {
  const s = store.s;
  const session = useSession();
  const list = s.characterOrder.map((id) => s.characters[id]).filter(Boolean);
  const alive = list.filter((c) => c.status !== 'dead');
  const days = supplyDays();
  const fmt = (d: number) => (d === Infinity ? '—' : d < 1 ? '1일 미만' : `약 ${Math.floor(d)}일`);
  const count = (st: Character['status']) => list.filter((c) => c.status === st).length;

  return (
    <>
      <div className="summary">
        <div className="sum-box">
          <span className="sum-label">생존자</span>
          <b>{alive.length}</b>
        </div>
        <div className="sum-box">
          <span className="sum-label">거점</span>
          <b>{count('base')}</b>
        </div>
        <div className="sum-box">
          <span className="sum-label">탐험 중</span>
          <b>{count('expedition')}</b>
        </div>
        <div className={`sum-box ${count('down') ? 'bad' : ''}`}>
          <span className="sum-label">요양 중</span>
          <b>{count('down')}</b>
        </div>
        <div className={`sum-box ${days.food < 2 ? 'bad' : ''}`}>
          <span className="sum-label">식량</span>
          <b>{fmt(days.food)}</b>
        </div>
        <div className={`sum-box ${days.water < 2 ? 'bad' : ''}`}>
          <span className="sum-label">식수</span>
          <b>{fmt(days.water)}</b>
        </div>
      </div>

      <Panel
        title="생존자 명단"
        actions={
          <button className="primary" onClick={() => sessionStore.update({ viewCharId: '__new__' })}>
            + 새 생존자 등록
          </button>
        }
      >
        <table className="item-table roster-table">
          <thead>
            <tr>
              <th>생존자</th>
              <th>위치</th>
              <th>상태</th>
              <th style={{ width: 210 }}>체력 · 포만 · 수분 · 기력</th>
              <th>거점 작업</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const mine = c.owner === session.player;
              const exp = s.expeditions[c.id];
              return (
                <tr key={c.id} className={c.status === 'dead' ? 'dead-row' : ''}>
                  <td>
                    <button className="name-btn" onClick={() => sessionStore.update({ viewCharId: c.id })}>
                      <Avatar a={c.appearance} sprite={c.sprite} size={30} />
                      <span>
                        <b>{c.name}</b>
                        <span className="muted small">
                          {' '}
                          {JOB_BY_ID[c.job]?.name} · {c.owner}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td>{exp ? `☠ ${LOCATION_BY_ID[exp.locationId].name}` : STATUS_LABEL[c.status]}</td>
                  <td className={moodText(c) === '양호' ? 'good-text' : 'bad-text'}>
                    {moodText(c)}
                    {c.injuries.some((i) => !i.bandaged) && ' 🩸'}
                  </td>
                  <td>
                    <div className="mini-bars">
                      <i style={{ width: `${c.health}%`, background: '#c23a2c' }} />
                      <i style={{ width: `${c.hunger}%`, background: '#c08a2e' }} />
                      <i style={{ width: `${c.thirst}%`, background: '#4a86b0' }} />
                      <i style={{ width: `${c.energy}%`, background: '#6f9a3c' }} />
                    </div>
                  </td>
                  <td>
                    <select
                      value={c.task}
                      disabled={!mine || c.status === 'dead'}
                      title={TASK_DESC[c.task]}
                      onChange={(e) => {
                        c.task = e.target.value as BaseTask;
                        store.commit();
                      }}
                    >
                      {(Object.keys(TASK_LABEL) as BaseTask[]).map((t) => (
                        <option key={t} value={t}>
                          {TASK_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="actions">
                    {mine && c.status !== 'dead' && (
                      <button
                        className={`small ${session.activeCharacterId === c.id ? 'active' : ''}`}
                        onClick={() => sessionStore.update({ activeCharacterId: c.id })}
                      >
                        {session.activeCharacterId === c.id ? '▶ 조종 중' : '조종'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="muted small">작업은 직접 조종하지 않을 때 거점에서 하는 일입니다. 텃밭·물 관리는 생산 속도를 올립니다.</div>
      </Panel>
    </>
  );
}

function CreateForm({ onDone }: { onDone: (id: string) => void }) {
  const session = useSession();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [job, setJob] = useState('unemployed');
  const [bio, setBio] = useState('');
  const [app, setApp] = useState<Appearance>(DEFAULT_APP);
  const [perma, setPerma] = useState(false);

  const submit = () => {
    if (!name.trim()) return toast('이름을 입력하자.', 'bad');
    const s = store.s;
    const c = createCharacter({ name, age, job, bio, appearance: app, owner: session.player, permadeathAllowed: perma });
    s.characters[c.id] = c;
    s.characterOrder.push(c.id);
    addNews(`${c.name}이(가) 거점에 합류했다. (${JOB_BY_ID[job].name})`, 'good');
    postRp('system', `${c.name}이(가) 피난처에 합류했다.`, c.id);
    if (!session.activeCharacterId) sessionStore.update({ activeCharacterId: c.id });
    store.commit();
    onDone(c.id);
  };

  const color = (k: keyof Appearance, label: string) => (
    <label className="color-field">
      {label}
      <input type="color" value={app[k]} onChange={(e) => setApp({ ...app, [k]: e.target.value })} />
    </label>
  );

  return (
    <Panel title="새 생존자 등록">
      <div className="create-grid">
        <div className="create-preview">
          <Avatar a={app} size={96} />
          <div className="row wrap">
            {SKINS.map((sk) => (
              <button key={sk} className="swatch" style={{ background: sk }} onClick={() => setApp({ ...app, skin: sk })} />
            ))}
          </div>
          {color('skin', '피부')}
          {color('hair', '머리')}
          {color('shirt', '상의')}
          {color('pants', '하의')}
        </div>
        <div className="create-fields">
          <label className="field">
            이름
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="캐릭터 이름" />
          </label>
          <label className="field">
            나이 / 한 줄 소개
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="예: 27세, 전직 바리스타" />
          </label>
          <label className="field">
            직업 (시작 숙련도)
            <select value={job} onChange={(e) => setJob(e.target.value)}>
              {JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
            <span className="muted small">
              {JOB_BY_ID[job].desc} · 시작 물품: {JOB_BY_ID[job].startItems.map((x) => ITEMS[x.itemId].name).join(', ')}
            </span>
          </label>
          <label className="field">
            설정 / 배경
            <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="성격, 과거, 좀비 사태 당시의 이야기…" />
          </label>
          <label className="check">
            <input type="checkbox" checked={perma} onChange={(e) => setPerma(e.target.checked)} />
            영구 사망 허용 (끄면 체력이 0이 되어도 쓰러질 뿐 죽지 않는다)
          </label>
          <button className="primary big" onClick={submit}>
            등록하기
          </button>
        </div>
      </div>
    </Panel>
  );
}

type Section = 'body' | 'status' | 'items' | 'profile' | 'social';
const SECTIONS: [Section, string][] = [
  ['body', '몸 상태 · 장비'],
  ['status', '상태 · 숙련도'],
  ['items', '장비 · 소지품'],
  ['profile', '프로필 · 일지'],
  ['social', '관계 · 편지'],
];

function CharacterDetail({ c }: { c: Character }) {
  const s = store.s;
  const session = useSession();
  const isMine = c.owner === session.player;
  const [useId, setUseId] = useState('');
  const [equipUid, setEquipUid] = useState('');
  const [relTarget, setRelTarget] = useState('');
  const [relText, setRelText] = useState('');
  const [letterTo, setLetterTo] = useState('');
  const [letter, setLetter] = useState('');
  const [editBio, setEditBio] = useState(false);
  const [sec, setSec] = useState<Section>((session.profileSec as Section) || 'body');
  useEffect(() => {
    if (session.profileSec) {
      setSec(session.profileSec as Section);
      sessionStore.update({ profileSec: null });
    }
  }, [session.profileSec]);

  const consumables = s.storage.filter((x) => ITEMS[x.itemId]?.consume || ITEMS[x.itemId]?.treat);
  const equippables = s.storage.filter((x) => ['weapon', 'tool', 'backpack'].includes(ITEMS[x.itemId]?.category) && (ITEMS[x.itemId].weapon || ITEMS[x.itemId].backpack));
  const others = s.characterOrder.filter((id) => id !== c.id).map((id) => s.characters[id]);
  const letters = s.rpLog.filter((m) => m.kind === 'letter' && (m.targetId === c.id || m.characterId === c.id)).slice(-10);

  const atBase = c.status === 'base' || c.status === 'down';

  return (
    <div className="profile">
      <div className="profile-card">
        <Avatar a={c.appearance} sprite={c.sprite} size={72} />
        <div className="profile-main">
          <div className="profile-name">
            {c.name} <span className="muted">{c.age}</span>
          </div>
          <div className="profile-meta">
            <span className="chip">{JOB_BY_ID[c.job]?.name}</span>
            <span className="chip">{STATUS_LABEL[c.status]}</span>
            <span className={`chip ${moodText(c) === '양호' ? 'ok' : 'bad'}`}>{moodText(c)}</span>
            <span className="muted small">오너 {c.owner} · 작업: {TASK_LABEL[c.task]}</span>
          </div>
          <Vitals c={c} compact />
        </div>
        <div className="profile-actions">
          {isMine && c.status !== 'dead' && (
            <button className={session.activeCharacterId === c.id ? 'active' : 'primary'} onClick={() => sessionStore.update({ activeCharacterId: c.id })}>
              {session.activeCharacterId === c.id ? '▶ 조종 중' : '조종하기'}
            </button>
          )}
          <button className="ghost small" onClick={() => sessionStore.update({ viewCharId: null })}>
            ◂ 전체 명단
          </button>
        </div>
      </div>

      <div className="seg sub">
        {SECTIONS.map(([id, label]) => (
          <button key={id} className={sec === id ? 'active' : ''} onClick={() => setSec(id)}>
            {label}
          </button>
        ))}
      </div>

      {sec === 'body' && (
        <Panel title="몸 상태 · 장비">
          <BodyPanel c={c} editable={isMine} />
        </Panel>
      )}
      {sec === 'status' && (
        <div className="detail-grid">
      <Panel title="상태">
        <Vitals c={c} />
        {c.injuries.length > 0 && (
          <div className="injuries">
            부상:{' '}
            {c.injuries.map((i) => (
              <span key={i.id} className={`chip ${i.bandaged ? 'ok' : 'bad'}`}>
                {injuryName(i.type)} {i.bandaged ? `(붕대, ${Math.ceil(i.healHours)}h)` : '(출혈!)'}
              </span>
            ))}
          </div>
        )}
        {atBase && isMine && (
          <div className="row">
            <select value={useId} onChange={(e) => setUseId(e.target.value)}>
              <option value="">창고에서 먹기 / 치료하기…</option>
              {consumables.map((x) => (
                <option key={x.uid} value={x.itemId}>
                  {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name} x{x.qty}
                </option>
              ))}
            </select>
            <button
              disabled={!useId}
              onClick={() => {
                const msg = consumeFrom(s.storage, c, useId);
                if (msg) toast(msg, 'info');
                store.commit();
              }}
            >
              사용
            </button>
          </div>
        )}
        <label className="field">
          거점 작업 (직접 조종하지 않을 때)
          <select
            value={c.task}
            disabled={!isMine}
            onChange={(e) => {
              c.task = e.target.value as BaseTask;
              store.commit();
            }}
          >
            {(Object.keys(TASK_LABEL) as BaseTask[]).map((t) => (
              <option key={t} value={t}>
                {TASK_LABEL[t]}
              </option>
            ))}
          </select>
          <span className="muted small">{TASK_DESC[c.task]}</span>
        </label>
      </Panel>
      <Panel title="숙련도">
        <div className="skills">
          {SKILL_IDS.map((sk) => {
            const xp = c.skills[sk];
            const lv = skillLevel(xp);
            const cur = xpForLevel(lv);
            const next = xpForLevel(lv + 1);
            return (
              <div key={sk} className="skill">
                <span>{SKILL_LABEL[sk]}</span>
                <b>Lv.{lv}</b>
                <div className="progress">
                  <div style={{ width: lv >= 10 ? '100%' : `${((xp - cur) / (next - cur)) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="muted small">
          탐험 {c.stats.expeditions}회 · 처치 {c.stats.kills} · 제작 {c.stats.crafted}
        </div>
      </Panel>
        </div>
      )}
      {sec === 'items' && (
        <div className="detail-grid">
      <Panel title="장비 · 소지품">
        <div className="equip">
          <div>
            🗡️ 무기: {c.weapon ? <StackLabel s={c.weapon} /> : <span className="muted">맨손</span>}
            {c.weapon && isMine && atBase && (
              <button className="ghost small" onClick={() => unequip(c, 'weapon')}>
                해제
              </button>
            )}
          </div>
          <div>
            🎒 가방: {c.backpack ? <StackLabel s={c.backpack} /> : <span className="muted">없음</span>} (휴대 한도 {carryCapacity(c)}kg)
            {c.backpack && isMine && atBase && (
              <button className="ghost small" onClick={() => unequip(c, 'backpack')}>
                해제
              </button>
            )}
          </div>
        </div>
        {isMine && atBase && (
          <div className="row">
            <select value={equipUid} onChange={(e) => setEquipUid(e.target.value)}>
              <option value="">창고에서 장착…</option>
              {equippables.map((x) => (
                <option key={x.uid} value={x.uid}>
                  {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name}
                  {x.durability !== undefined ? ` (${Math.round((x.durability / (ITEMS[x.itemId].durability ?? 1)) * 100)}%)` : ''}
                </option>
              ))}
            </select>
            <button
              disabled={!equipUid}
              onClick={() => {
                const st = s.storage.find((x) => x.uid === equipUid);
                if (st) equipFromStorage(c, equipUid, ITEMS[st.itemId].backpack ? 'backpack' : 'weapon');
                setEquipUid('');
              }}
            >
              장착
            </button>
          </div>
        )}
        <div className="field">
          <div>
            개인 소지품 <span className="muted small">· {carriedWeight(c)}/{carryCapacity(c)}kg</span>
          </div>
          {c.inventory.length === 0 && <div className="muted small">없음</div>}
          {c.inventory.map((x) => (
            <div key={x.uid} className="row item-row">
              <span className="inv-detail">
                <StackLabel s={x} />
                <span className="muted small">
                  {' '}
                  {Math.round(ITEMS[x.itemId].weight * x.qty * 10) / 10}kg · {ITEMS[x.itemId].desc}
                </span>
              </span>
              {isMine && atBase && (
                <span className="row">
                  {(ITEMS[x.itemId].consume || ITEMS[x.itemId].treat) && (
                    <button
                      className="small"
                      onClick={() => {
                        const msg = consumeFrom(c.inventory, c, x.itemId);
                        if (msg) toast(msg);
                        store.commit();
                      }}
                    >
                      사용
                    </button>
                  )}
                  <button
                    className="small ghost"
                    onClick={() => {
                      const st = takeStack(c.inventory, x.uid);
                      if (st) addStack(s.storage, st);
                      store.commit();
                    }}
                  >
                    창고로
                  </button>
                </span>
              )}
            </div>
          ))}
          {isMine && atBase && (
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const msg = giveToCharacter('storage', c, e.target.value);
                if (msg) toast(msg);
                store.commit();
              }}
            >
              <option value="">창고에서 개인 소지품으로 챙기기…</option>
              {s.storage
                .filter((x) => ['prop', 'rare', 'food', 'drink', 'medical'].includes(ITEMS[x.itemId].category))
                .map((x) => (
                  <option key={x.uid} value={x.uid}>
                    {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name} x{x.qty}
                  </option>
                ))}
            </select>
          )}
        </div>
      </Panel>
        </div>
      )}
      {sec === 'profile' && (
        <div className="detail-grid">
      <Panel
        title="설정 · 개인 기록"
        actions={
          isMine && (
            <button className="ghost small" onClick={() => setEditBio(!editBio)}>
              {editBio ? '완료' : '편집'}
            </button>
          )
        }
      >
        {editBio ? (
          <>
            <label className="field">
              이름
              <input value={c.name} onChange={(e) => ((c.name = e.target.value), store.commit())} />
            </label>
            <label className="field">
              나이 / 소개
              <input value={c.age} onChange={(e) => ((c.age = e.target.value), store.commit())} />
            </label>
            <label className="field">
              설정
              <textarea rows={4} value={c.bio} onChange={(e) => ((c.bio = e.target.value), store.commit())} />
            </label>
            <div className="row wrap">
              {(['skin', 'hair', 'shirt', 'pants'] as const).map((k) => (
                <label key={k} className="color-field">
                  {{ skin: '피부', hair: '머리', shirt: '상의', pants: '하의' }[k]}
                  <input type="color" value={c.appearance[k]} onChange={(e) => ((c.appearance = { ...c.appearance, [k]: e.target.value }), store.commit())} />
                </label>
              ))}
            </div>
            <SpriteUpload sprite={c.sprite} onChange={(v) => ((c.sprite = v), store.commit())} />
            <label className="check">
              <input type="checkbox" checked={c.permadeathAllowed} onChange={(e) => ((c.permadeathAllowed = e.target.checked), store.commit())} />
              영구 사망 허용
            </label>
          </>
        ) : (
          <p className="bio">{c.bio || <span className="muted">설정이 비어 있다.</span>}</p>
        )}
        <label className="field">
          일지 (캐릭터의 개인 기록)
          <textarea rows={4} value={c.journal} disabled={!isMine} onChange={(e) => ((c.journal = e.target.value), store.commit())} placeholder="오늘 있었던 일…" />
        </label>
        <div className="muted small">영구 사망: {c.permadeathAllowed ? '허용됨' : '꺼짐 (쓰러져도 죽지 않음)'}</div>
      </Panel>
      {isMine && (
        <Panel title="관리">
          <button
            className="danger"
            onClick={() => {
              if (!confirm(`${c.name}을(를) 정말 삭제할까요? 되돌릴 수 없습니다.`)) return;
              if (c.status === 'expedition') return toast('탐험 중에는 삭제할 수 없다.', 'bad');
              if (c.weapon) addStack(s.storage, c.weapon);
              if (c.backpack) addStack(s.storage, c.backpack);
              for (const st of c.inventory) addStack(s.storage, st);
              delete s.characters[c.id];
              s.characterOrder = s.characterOrder.filter((x) => x !== c.id);
              for (const f of s.base.furniture) if (f.ownerId === c.id) f.ownerId = undefined;
              if (session.activeCharacterId === c.id) sessionStore.update({ activeCharacterId: null });
              store.commit();
            }}
          >
            캐릭터 삭제 (소지품은 창고로)
          </button>
        </Panel>
      )}
        </div>
      )}
      {sec === 'social' && (
        <div className="detail-grid">
      <Panel title="관계 (오너가 직접 설정)">
        {c.relations.length === 0 && <div className="muted small">시스템은 관계를 자동으로 정하지 않는다. 직접 적어 두자.</div>}
        {c.relations.map((r, i) => (
          <div key={i} className="row item-row">
            <span>
              → <b>{s.characters[r.targetId]?.name ?? '??'}</b>: {r.text}
            </span>
            {isMine && (
              <button
                className="small ghost"
                onClick={() => {
                  c.relations.splice(i, 1);
                  store.commit();
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {isMine && others.length > 0 && (
          <div className="row">
            <select value={relTarget} onChange={(e) => setRelTarget(e.target.value)}>
              <option value="">대상…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input value={relText} onChange={(e) => setRelText(e.target.value)} placeholder="예: 소꿉친구, 은인, 신경 쓰이는 사람" />
            <button
              disabled={!relTarget || !relText.trim()}
              onClick={() => {
                const ex = c.relations.find((r) => r.targetId === relTarget);
                if (ex) ex.text = relText.trim();
                else c.relations.push({ targetId: relTarget, text: relText.trim() });
                setRelText('');
                store.commit();
              }}
            >
              저장
            </button>
          </div>
        )}
      </Panel>
      <Panel title="✉️ 편지 · 메모">
        {letters.length === 0 && <div className="muted small">주고받은 편지가 없다.</div>}
        {letters.map((m) => (
          <RpLine key={m.id} m={m} />
        ))}
        {isMine && others.length > 0 && c.status !== 'dead' && (
          <>
            <select value={letterTo} onChange={(e) => setLetterTo(e.target.value)}>
              <option value="">받는 사람…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <textarea rows={3} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="베개 밑에 몰래 넣어둘 쪽지…" />
            <button
              disabled={!letterTo || !letter.trim()}
              onClick={() => {
                postRp('letter', letter, c.id, letterTo);
                setLetter('');
                toast('편지를 남겼다.', 'good');
              }}
            >
              편지 남기기
            </button>
          </>
        )}
      </Panel>
        </div>
      )}
    </div>
  );
}


/** 거점에 서 있는 캐릭터 그림 올리기: 도트 또는 일러스트. 배경·여백은 알아서 정리 */
function SpriteUpload({ sprite, onChange }: { sprite?: string; onChange: (v: string | undefined) => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [bg, setBg] = useState<'auto' | 'yes' | 'no'>('auto');
  const pick = (file: File | undefined) => {
    setErr('');
    if (!file) return;
    setBusy(true);
    prepareSprite(file, bg)
      .then(onChange)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="sprite-upload">
      <div className="sprite-preview">
        {sprite ? <img src={sprite} alt="" onLoad={(e) => e.currentTarget.classList.toggle('smooth', e.currentTarget.naturalHeight > 96)} /> : <span className="muted small">기본</span>}
      </div>
      <div className="sprite-body">
        <div>거점 캐릭터 그림</div>
        <div className="muted small">PNG·JPG 아무 크기 · 전신 그림 · 흰 배경은 자동으로 지우고 여백은 잘라 냄</div>
        <label className="field small">
          배경
          <select value={bg} onChange={(e) => setBg(e.target.value as typeof bg)}>
            <option value="auto">자동 (투명 배경이 없을 때만 지우기)</option>
            <option value="yes">테두리 배경 지우기</option>
            <option value="no">그대로 두기</option>
          </select>
        </label>
        <div className="row">
          <label className="btn-file">
            {busy ? '정리하는 중…' : '그림 올리기'}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          {sprite && (
            <button className="ghost small" onClick={() => onChange(undefined)}>
              기본으로
            </button>
          )}
        </div>
        {err && <div className="warn small">{err}</div>}
      </div>
    </div>
  );
}
