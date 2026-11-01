import { useState } from 'react';
import { store } from '../game/store';
import { activeEffects, formatLeft } from '../game/systems/effects';
import type { Character } from '../game/types';

/** 버프·디버프: 아이콘 칩. 누르면 이유·효과·남은 시간 */
export function EffectChips({ c, iconsOnly }: { c: Character; iconsOnly?: boolean }) {
  const list = activeEffects(c, store.s);
  const [open, setOpen] = useState<string | null>(null);
  if (!list.length) return iconsOnly ? null : <div className="fx-none muted small">걸린 효과 없음</div>;
  if (iconsOnly)
    return (
      <span className="fx-icons">
        {list.map((e) => (
          <span key={e.id} className={`fx-ico ${e.kind}`} title={`${e.name} — ${e.desc}`}>
            {e.icon}
          </span>
        ))}
      </span>
    );
  const sel = list.find((e) => e.id === open);
  return (
    <div className="fx">
      <div className="fx-chips">
        {list.map((e) => (
          <button key={e.id} className={`fx-chip ${e.kind} ${open === e.id ? 'on' : ''}`} onClick={() => setOpen(open === e.id ? null : e.id)} title={`${e.name}: ${e.desc}`}>
            <span>{e.icon}</span>
            {e.name}
            {e.left !== null && <span className="fx-left">{formatLeft(e.left)}</span>}
          </button>
        ))}
      </div>
      {sel && (
        <div className={`fx-detail ${sel.kind}`}>
          <div className="fx-d-title">
            {sel.icon} {sel.name} <span className="muted small">{sel.kind === 'buff' ? '버프' : '디버프'}</span>
          </div>
          <div className="kv small">
            <span>이유</span>
            <span>{sel.reason}</span>
            <span>효과</span>
            <span>{sel.desc}</span>
            <span>{sel.left !== null ? '남은 시간' : '없어지려면'}</span>
            <span>{sel.left !== null ? `${formatLeft(sel.left)} (${sel.until})` : sel.until}</span>
            {sel.cure && (
              <>
                <span>해소 방법</span>
                <span className="fx-cure">{sel.cure}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
