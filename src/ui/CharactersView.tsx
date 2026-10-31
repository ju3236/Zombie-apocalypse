import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { JOB_BY_ID, JOBS, SKILL_IDS, SKILL_LABEL, skillLevel, TASK_DESC, TASK_LABEL, xpForLevel } from '../game/data/jobs';
import { addStack, takeStack } from '../game/inventory';
import { addNews, sessionStore, store, useSession } from '../game/store';
import { carryCapacity, createCharacter, equipFromStorage, giveToCharacter, injuryName, moodText, unequip, consumeFrom } from '../game/systems/character';
import { postRp } from '../game/systems/rp';
import type { Appearance, BaseTask, Character } from '../game/types';
import { Avatar, Panel, StackLabel, STATUS_LABEL, Vitals } from './common';
import { RpLine } from './panels';

const SKINS = ['#f3d2b3', '#e8b98f', '#c98e62', '#8d5a3b', '#5c3a24'];
const DEFAULT_APP: Appearance = { skin: '#f3d2b3', hair: '#2b1d14', shirt: '#4a7bb7', pants: '#3b3f4a' };

export function CharactersView() {
  const s = store.s;
  const session = useSession();
  const creating = session.viewCharId === '__new__' || s.characterOrder.length === 0;
  const id = session.viewCharId && s.characters[session.viewCharId] ? session.viewCharId : (session.activeCharacterId ?? s.characterOrder[0]);
  const c = id ? s.characters[id] : null;

  return (
    <div className="char-view">
      {creating ? (
        <CreateForm onDone={(newId) => sessionStore.update({ viewCharId: newId })} />
      ) : c ? (
        <CharacterDetail key={c.id} c={c} />
      ) : null}
    </div>
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

  const consumables = s.storage.filter((x) => ITEMS[x.itemId]?.consume || ITEMS[x.itemId]?.treat);
  const equippables = s.storage.filter((x) => ['weapon', 'tool', 'backpack'].includes(ITEMS[x.itemId]?.category) && (ITEMS[x.itemId].weapon || ITEMS[x.itemId].backpack));
  const others = s.characterOrder.filter((id) => id !== c.id).map((id) => s.characters[id]);
  const letters = s.rpLog.filter((m) => m.kind === 'letter' && (m.targetId === c.id || m.characterId === c.id)).slice(-10);

  const atBase = c.status === 'base' || c.status === 'down';

  return (
    <div className="detail-grid">
      <Panel
        title={
          <span className="row">
            <Avatar a={c.appearance} size={44} />
            <span>
              {c.name} <span className="muted small">{c.age}</span>
            </span>
          </span>
        }
        actions={
          isMine &&
          c.status !== 'dead' && (
            <button className={session.activeCharacterId === c.id ? 'active' : 'primary'} onClick={() => sessionStore.update({ activeCharacterId: c.id })}>
              {session.activeCharacterId === c.id ? '조종 중' : '🎮 조종하기'}
            </button>
          )
        }
      >
        <div className="muted small">
          {JOB_BY_ID[c.job]?.name} · 오너 {c.owner} · {STATUS_LABEL[c.status]} · 상태: {moodText(c)}
        </div>
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
          <div>개인 소지품</div>
          {c.inventory.length === 0 && <div className="muted small">없음</div>}
          {c.inventory.map((x) => (
            <div key={x.uid} className="row item-row">
              <StackLabel s={x} />
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
  );
}

