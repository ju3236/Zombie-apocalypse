import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type FocusEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { freshness } from '../game/systems/power';
import { controls } from '../game/homes';
import { bus } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { sessionStore, store } from '../game/store';
import type { Appearance, Character, ItemStack } from '../game/types';

export function Bar({ value, max = 100, color, label, small }: { value: number; max?: number; color: string; label?: string; small?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${small ? 'small' : ''}`} title={label ? `${label} ${Math.round(value)}/${max}` : undefined}>
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-val">{Math.round(value)}</span>
    </div>
  );
}

export function Vitals({ c, compact }: { c: Character; compact?: boolean }) {
  return (
    <div className={`vitals ${compact ? 'compact' : ''}`}>
      <Bar label="체력" value={c.health} color="#d9534f" small={compact} />
      <Bar label="포만" value={c.hunger} color="#e0a040" small={compact} />
      <Bar label="수분" value={c.thirst} color="#4aa3df" small={compact} />
      <Bar label="기력" value={c.energy} color="#7ac943" small={compact} />
      {c.infection > 0 && <Bar label="감염" value={c.infection} color="#9b59b6" small={compact} />}
    </div>
  );
}

export function ItemName({ id, qty, dur }: { id: string; qty?: number; dur?: number }) {
  const d = ITEMS[id];
  if (!d) return <span>{id}</span>;
  return (
    <span className={`item-name rarity-${d.rarity ?? 1}`} title={d.desc}>
      <span className="icon">{d.icon}</span>
      {d.name}
      {qty !== undefined && qty > 1 && <span className="qty"> x{qty}</span>}
      {dur !== undefined && d.durability && <span className="dur"> ({Math.round((dur / d.durability) * 100)}%)</span>}
    </span>
  );
}

/** 상하는 음식의 신선도 */
export function FreshTag({ s }: { s: ItemStack }) {
  const f = freshness(s);
  if (f === null) return null;
  const pct = Math.round(f * 100);
  return (
    <span className={`fresh ${pct < 25 ? 'bad' : pct < 60 ? 'mid' : 'good'}`} title={`신선도 ${pct}% (상하기까지 약 ${Math.round((ITEMS[s.itemId].spoil ?? 0) - (s.rot ?? 0))}시간)`}>
      {pct < 25 ? '🦠' : '🍃'}
      {pct}%
    </span>
  );
}

export function StackLabel({ s }: { s: ItemStack }) {
  return <ItemName id={s.itemId} qty={s.qty} dur={s.durability} />;
}

export function Avatar({ a, size = 40, sprite }: { a: Appearance; size?: number; sprite?: string }) {
  const u = size / 40;
  if (sprite)
    return (
      <div className="avatar" style={{ width: size, height: size }}>
        <img className="avatar-sprite" src={sprite} alt="" onLoad={(e) => e.currentTarget.classList.toggle('smooth', e.currentTarget.naturalHeight > 96)} />
      </div>
    );
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      <div style={{ position: 'absolute', left: 13 * u, top: 30 * u, width: 6 * u, height: 9 * u, background: a.pants, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 21 * u, top: 30 * u, width: 6 * u, height: 9 * u, background: a.pants, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 10 * u, top: 18 * u, width: 20 * u, height: 14 * u, background: a.shirt, borderRadius: 4 * u }} />
      <div style={{ position: 'absolute', left: 12 * u, top: 4 * u, width: 16 * u, height: 16 * u, background: a.skin, borderRadius: '50%' }} />
      <div style={{ position: 'absolute', left: 11 * u, top: 2 * u, width: 18 * u, height: 9 * u, background: a.hair, borderRadius: `${9 * u}px ${9 * u}px ${2 * u}px ${2 * u}px` }} />
    </div>
  );
}

export function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span className="stars" title={`위험도 ${n}/${max}`}>
      {'●'.repeat(n)}
      <span className="dim">{'●'.repeat(max - n)}</span>
    </span>
  );
}

export function Panel({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <div className="panel-head">
          <h3>{title}</h3>
          <div className="panel-actions">{actions}</div>
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function Toasts() {
  const [list, setList] = useState<{ id: number; text: string; kind?: string }[]>([]);
  useEffect(() => {
    let n = 0;
    return bus.on('toast', ({ text, kind }) => {
      const id = ++n + Date.now();
      setList((l) => [...l.slice(-4), { id, text, kind }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3200);
    });
  }, []);
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind ?? ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** 현재 플레이어가 조종할 수 있는 캐릭터 */
export function myCharacters(): Character[] {
  const s = store.s;
  const me = sessionStore.get().player;
  return s.characterOrder.map((id) => s.characters[id]).filter((c) => c && controls(c, me)).sort((a, b) => Number(!!a.npc) - Number(!!b.npc));
}

export function allCharacters(): Character[] {
  const s = store.s;
  return s.characterOrder.map((id) => s.characters[id]).filter(Boolean);
}

export function activeCharacter(): Character | null {
  const id = sessionStore.get().activeCharacterId;
  const c = id ? store.s.characters[id] : null;
  return c ?? null;
}

export const STATUS_LABEL: Record<Character['status'], string> = {
  base: '거점',
  expedition: '탐험 중',
  moving: '이사 중',
  away: '심부름 중',
  down: '요양 중',
  dead: '사망',
};

/**
 * 게임 데이터에 바로 저장되는 글 입력칸.
 * 한글처럼 조합해서 쓰는 입력이 끊기지 않도록, 입력하는 동안은 칸 안의 값을 따로 들고 있다가
 * 조합이 끝날 때마다(또는 칸을 떠날 때) 저장한다.
 */
export function StoreText({
  value,
  onCommit,
  multiline,
  ...rest
}: { value: string; onCommit: (v: string) => void; multiline?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  const composing = useRef(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(value);
  }, [value]);
  const save = (x: string) => {
    if (x !== value) onCommit(x);
  };
  const props = {
    ...rest,
    value: v,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setV(e.target.value);
      if (!composing.current) save(e.target.value);
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false;
      save(e.currentTarget.value);
    },
    onFocus: () => {
      focused.current = true;
    },
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      focused.current = false;
      composing.current = false;
      save(e.currentTarget.value);
    },
  };
  return multiline ? <textarea {...props} /> : <input {...props} />;
}
