import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { JOB_BY_ID, JOB_CATS, JOBS } from '../game/data/jobs';
import { MAX_TRAITS, TRAIT_BY_ID, TRAITS, type TraitDef } from '../game/data/traits';
import { store } from '../game/store';
import { addMemory, noteDay } from '../game/systems/story';
import {
  canAddTrait, describeJob, describeMods, describeTrait, earnable, modsOf, pointsLeft, randomTraits, traitInactive, validTraits,
} from '../game/systems/traits';
import type { Character } from '../game/types';
import { Panel } from './common';
import { fixJosa } from '../game/util';

/** 직업 고르기: 분야 탭 + 검색 + 카드 */
export function JobPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [cat, setCat] = useState(JOB_BY_ID[value]?.cat ?? JOB_CATS[0]);
  const [q, setQ] = useState('');
  const list = q.trim() ? JOBS.filter((j) => j.name.includes(q.trim()) || j.desc.includes(q.trim())) : JOBS.filter((j) => j.cat === cat);
  const cur = JOB_BY_ID[value];
  return (
    <div className="job-picker">
      <div className="row wrap job-cats">
        {JOB_CATS.map((c) => (
          <button key={c} className={`small ${c === cat && !q ? 'active' : ''}`} onClick={() => (setCat(c), setQ(''))}>
            {c}
          </button>
        ))}
        <input className="job-search" value={q} placeholder="직업 검색 (100종)" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="job-grid">
        {list.map((j) => (
          <button key={j.id} className={`job-card ${j.id === value ? 'on' : ''}`} onClick={() => onChange(j.id)} title={describeJob(j)}>
            <b>{j.name}</b>
            {j.pts > 0 && <span className="tag good">+{j.pts}점</span>}
            <span className="small muted">{j.desc}</span>
          </button>
        ))}
      </div>
      {cur && (
        <div className="job-detail">
          <b>{cur.name}</b> <span className="muted small">({cur.cat})</span>
          <div className="small">{describeJob(cur)}</div>
          {cur.startItems.length > 0 && <div className="small muted">시작 물품: {cur.startItems.map((x) => `${ITEMS[x.itemId]?.icon}${ITEMS[x.itemId]?.name} ${x.qty}`).join(', ')}</div>}
          <div className="small muted">직업은 출발점일 뿐, 모든 기술은 플레이하면서 배울 수 있다.</div>
        </div>
      )}
    </div>
  );
}

function TraitChip({ t, on, disabled, why, onClick }: { t: TraitDef; on: boolean; disabled?: boolean; why?: string | null; onClick: () => void }) {
  return (
    <button className={`trait-chip ${t.kind} ${on ? 'on' : ''}`} disabled={disabled && !on} onClick={onClick} title={`${t.desc}\n${describeTrait(t)}${why ? `\n⛔ ${why}` : ''}`}>
      <span className="tc-name">{t.name}</span>
      <span className="tc-pts">{t.kind === 'pos' ? `−${t.pts}` : `+${t.pts}`}</span>
    </button>
  );
}

/** 특성 고르기: 포인트제 */
export function TraitPicker({ job, value, onChange }: { job: string; value: string[]; onChange: (v: string[]) => void }) {
  const [tab, setTab] = useState<'pos' | 'neg'>('pos');
  const [q, setQ] = useState('');
  const left = pointsLeft(job, value);
  const list = TRAITS.filter((t) => t.kind === tab && (!q.trim() || t.name.includes(q.trim()) || describeTrait(t).includes(q.trim())));
  const groups = [...new Set(list.map((t) => t.group))];
  const toggle = (id: string) => {
    if (value.includes(id)) return onChange(value.filter((x) => x !== id));
    const why = canAddTrait(job, value, id);
    if (why) return toast(why, 'bad');
    onChange([...value, id]);
  };
  const total = modsOf({ job, traits: value } as Character, null);
  // 특성 효과도 합쳐서 미리보기 (조건부 효과는 따로 표시)
  const summary = describeMods(total);
  const traitLines = value.map((id) => TRAIT_BY_ID[id]).filter(Boolean);

  return (
    <div className="trait-picker">
      <div className="row wrap trait-head">
        <span className={`trait-points ${left < 0 ? 'bad' : ''}`}>
          남은 포인트 <b>{left}</b>
        </span>
        <span className="muted small">
          {value.length}/{MAX_TRAITS}개 · 직업 보너스 {JOB_BY_ID[job]?.pts ?? 0}점
        </span>
        <button className="small" onClick={() => onChange(randomTraits(job))}>
          🎲 랜덤
        </button>
        <button className="small ghost" onClick={() => onChange([])}>
          비우기
        </button>
      </div>
      <div className="row wrap">
        <button className={`small ${tab === 'pos' ? 'active' : ''}`} onClick={() => setTab('pos')}>
          👍 긍정 특성 (포인트 사용)
        </button>
        <button className={`small ${tab === 'neg' ? 'active' : ''}`} onClick={() => setTab('neg')}>
          👎 부정 특성 (포인트 획득)
        </button>
        <input className="job-search" value={q} placeholder="특성 검색" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="trait-groups">
        {groups.map((g) => (
          <div key={g} className="trait-group">
            <div className="muted small">{g}</div>
            <div className="chips">
              {list
                .filter((t) => t.group === g)
                .map((t) => {
                  const why = value.includes(t.id) ? null : canAddTrait(job, value, t.id);
                  return <TraitChip key={t.id} t={t} on={value.includes(t.id)} disabled={!!why} why={why} onClick={() => toggle(t.id)} />;
                })}
            </div>
          </div>
        ))}
      </div>
      {traitLines.length > 0 && (
        <div className="trait-chosen">
          {traitLines.map((t) => (
            <div key={t.id} className={`small trait-line ${t.kind}`}>
              <b>{t.name}</b> — {describeTrait(t)}
            </div>
          ))}
        </div>
      )}
      {summary.length > 0 && <div className="small trait-sum">📊 직업+특성 합계 (늘 켜진 효과): {summary.join(' · ')}</div>}
      <div className="muted small">특성은 수치만 바꾼다. 캐릭터가 어떻게 말하고 행동할지는 오너가 정한다.</div>
    </div>
  );
}

/** 프로필: 지금 특성 · 처음 한 번 고르기 · 성장형 특성 받기 */
export function TraitPanel({ c, isMine }: { c: Character; isMine: boolean }) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const traits = (c.traits ?? []).map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  const offers = isMine ? earnable(c) : [];
  return (
    <Panel title="🧬 직업 · 특성">
      <div className="small">
        <b>{JOB_BY_ID[c.job]?.name}</b> — {JOB_BY_ID[c.job] ? describeJob(JOB_BY_ID[c.job]) : ''}
      </div>
      {traits.length > 0 ? (
        <div className="trait-list">
          {traits.map((t) => {
            const off = traitInactive(c, t);
            return (
              <div key={t.id} className={`trait-line ${t.kind} ${off ? 'off' : ''}`}>
                <b>{t.kind === 'earned' ? '🏅 ' : ''}{t.name}</b> <span className="small">{describeTrait(t)}</span>
                {off && <span className="tag dim">{off}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        c.traits && <div className="muted small">특성 없음</div>
      )}
      {!c.traits && isMine && draft === null && (
        <button className="primary" onClick={() => setDraft([])}>
          특성 고르기 (한 번만)
        </button>
      )}
      {draft !== null && (
        <>
          <TraitPicker job={c.job} value={draft} onChange={setDraft} />
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                const err = validTraits(c.job, draft);
                if (err) return toast(err, 'bad');
                c.traits = draft;
                store.commit();
                setDraft(null);
                toast('특성을 정했다.', 'good');
              }}
            >
              확정
            </button>
            <button className="ghost" onClick={() => setDraft(null)}>
              취소
            </button>
          </div>
        </>
      )}
      {offers.map((t) => (
        <div key={t.id} className="earn-offer">
          🏅 <b>{t.name}</b>{fixJosa(`${t.name}을(를)`).slice(t.name.length)} 얻을 수 있다 — <span className="small">{t.earn}: {describeTrait(t)}</span>
          <div className="row">
            <button
              className="small primary"
              onClick={() => {
                c.traits = [...(c.traits ?? []), t.id];
                addMemory(c, 'resolve', `「${t.name}」 — ${t.desc}`);
                noteDay(c, `${t.desc}`);
                store.commit();
              }}
            >
              받기
            </button>
            <button className="small ghost" onClick={() => ((c.declined = [...(c.declined ?? []), t.id]), store.commit())} title="캐릭터 설정과 맞지 않으면 받지 않아도 된다">
              안 받기
            </button>
          </div>
        </div>
      ))}
    </Panel>
  );
}
