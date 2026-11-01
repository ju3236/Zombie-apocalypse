import type { Character } from '../types';
import { mod } from './traits';
import { store } from '../store';

/**
 * 호감도. 서로 돕고 같이 지낼수록 양쪽 다 오른다 (0~100).
 * 관계 설명(text)은 오너가 직접 적고, 숫자는 시스템이 쌓는다.
 */
export const BOND_START = 10;

export const BOND_TIERS: { min: number; name: string; icon: string }[] = [
  { min: 80, name: '소중한 사람', icon: '💗' },
  { min: 60, name: '믿음직한 동료', icon: '💛' },
  { min: 40, name: '동료', icon: '🤝' },
  { min: 20, name: '아는 사이', icon: '🙂' },
  { min: 0, name: '낯선 사람', icon: '·' },
];

export const bondTier = (n: number) => BOND_TIERS.find((t) => n >= t.min) ?? BOND_TIERS[BOND_TIERS.length - 1];

function rel(a: Character, b: Character) {
  let r = a.relations.find((x) => x.targetId === b.id);
  if (!r) {
    r = { targetId: b.id, text: '', bond: BOND_START };
    a.relations.push(r);
  }
  r.bond ??= BOND_START;
  return r;
}

export const bondOf = (a: Character, b: Character) => a.relations.find((x) => x.targetId === b.id)?.bond ?? BOND_START;

/** 같은 종류의 일로 너무 자주 오르지 않게 (게임 시간 기준) */
const recent = new Map<string, number>();

/** 둘 다 호감 +amount. key 가 있으면 그 일은 cooldown(분) 동안 한 번만 */
export function addBond(a: Character, b: Character, amount: number, key?: string, cooldown = 60): number | null {
  if (!a || !b || a.id === b.id) return null;
  if (key) {
    const k = [a.id, b.id].sort().join('|') + '|' + key;
    const last = recent.get(k);
    if (last !== undefined && store.s.time - last < cooldown) return null;
    recent.set(k, store.s.time);
  }
  const ra = rel(a, b);
  const rb = rel(b, a);
  const before = bondTier(Math.min(ra.bond!, rb.bond!)).name;
  // 다정한 사람끼리는 더 빨리 가까워진다
  if (amount > 0) amount = Math.round(amount * Math.max(0.5, 1 + (mod(a, 'bond') + mod(b, 'bond')) / 2) * 10) / 10;
  ra.bond = Math.max(0, Math.min(100, ra.bond! + amount));
  rb.bond = Math.max(0, Math.min(100, rb.bond! + amount));
  const after = bondTier(Math.min(ra.bond, rb.bond)).name;
  return before !== after ? Math.min(ra.bond, rb.bond) : null;
}

/** 관계 단계가 오르면 남길 문장 */
export function tierUpText(a: Character, b: Character, n: number | null): string | null {
  if (n === null) return null;
  const t = bondTier(n);
  return `${t.icon} ${a.name}과(와) ${b.name}은(는) 이제 '${t.name}'이다.`;
}
