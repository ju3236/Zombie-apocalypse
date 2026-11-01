import { JOB_BY_ID } from '../game/data/jobs';
import { TRAIT_BY_ID } from '../game/data/traits';
import { sessionStore, store } from '../game/store';
import { bondOf } from '../game/systems/bonds';
import { moodText } from '../game/systems/character';
import { describeTrait } from '../game/systems/traits';
import type { Character } from '../game/types';
import { Avatar, myCharacters, STATUS_LABEL } from './common';
import { EffectChips } from './Effects';
import { BondTag } from './Social';

/**
 * 남의 캐릭터 프로필: 소개와 관계만. 소지품·장비·일기·숙련 같은 속사정은 보여 주지 않는다.
 */
export function PublicProfile({ c, onClose }: { c: Character; onClose?: () => void }) {
  const s = store.s;
  const mine = myCharacters().filter((m) => m.id !== c.id && !m.npc);
  const traits = (c.traits ?? []).map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  return (
    <div className="public-profile">
      <div className="pp-head">
        <div className="pp-portrait">
          <Avatar a={c.appearance} sprite={c.sprite} size={120} />
        </div>
        <div className="pp-main">
          <div className="profile-name">
            {c.name} <span className="muted">{c.age}</span>
          </div>
          <div className="profile-meta">
            <span className="chip">{JOB_BY_ID[c.job]?.name}</span>
            <span className="chip">{STATUS_LABEL[c.status]}</span>
            <span className={`chip ${moodText(c) === '양호' ? 'ok' : 'bad'}`}>{moodText(c)}</span>
            <span className="chip">⌂ {s.bases[c.homeId]?.name ?? '거점'}</span>
          </div>
          <div className="muted small">{c.npc ? '🤝 NPC 생존자' : `오너 ${c.owner}`}</div>
          <EffectChips c={c} iconsOnly />
        </div>
        <div className="pp-actions">
          {onClose ? (
            <button className="ghost" onClick={onClose}>
              ✕
            </button>
          ) : (
            <button className="ghost small" onClick={() => sessionStore.update({ viewCharId: null })}>
              ◂ 전체 명단
            </button>
          )}
        </div>
      </div>
      <div className="pp-section">
        <div className="divider small">소개</div>
        <p className="bio">{c.bio || <span className="muted">아직 소개가 없다.</span>}</p>
      </div>
      {traits.length > 0 && (
        <div className="pp-section">
          <div className="divider small">특성</div>
          <div className="chips">
            {traits.map((t) => (
              <span key={t.id} className={`trait-chip ${t.kind} on`} title={`${t.desc}\n${describeTrait(t)}`}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <div className="pp-section">
          <div className="divider small">내 캐릭터와의 사이</div>
          {mine.map((m) => {
            const r1 = m.relations.find((r) => r.targetId === c.id);
            const r2 = c.relations.find((r) => r.targetId === m.id);
            return (
              <div key={m.id} className="pp-rel">
                <Avatar a={m.appearance} sprite={m.sprite} size={22} /> <b>{m.name}</b> <BondTag n={bondOf(m, c)} />
                {r1?.text && <span className="small"> · {m.name}: “{r1.text}”</span>}
                {r2?.text && <span className="small muted"> · {c.name}: “{r2.text}”</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 화면 위에 띄우는 프로필 창 */
export function ProfileModal({ id, onClose }: { id: string; onClose: () => void }) {
  const c = store.s.characters[id];
  if (!c) return null;
  return (
    <div className="pp-modal" onClick={onClose}>
      <div className="pp-box" onClick={(e) => e.stopPropagation()}>
        <PublicProfile c={c} onClose={onClose} />
      </div>
    </div>
  );
}
