import { useEffect, useState, type ReactNode } from 'react';
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

export function StackLabel({ s }: { s: ItemStack }) {
  return <ItemName id={s.itemId} qty={s.qty} dur={s.durability} />;
}

export function Avatar({ a, size = 40, sprite }: { a: Appearance; size?: number; sprite?: string }) {
  const u = size / 40;
  if (sprite)
    return (
      <div className="avatar" style={{ width: size, height: size }}>
        <img className="avatar-sprite" src={sprite} alt="" />
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
  return s.characterOrder.map((id) => s.characters[id]).filter((c) => c && c.owner === me);
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
  down: '요양 중',
  dead: '사망',
};
