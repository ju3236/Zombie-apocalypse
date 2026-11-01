import { ITEMS } from '../data/items';
import { addItem, removeItem } from '../inventory';
import { addNews, store, withBase } from '../store';
import type { BaseState, GameState, ItemStack } from '../types';
import { hourOf } from '../util';
import { addEffect } from './effects';
import { isAsleep } from './character';

/**
 * 전기와 음식 상함. 한 시간마다 처리한다.
 * - 발전기: 휘발유 1통 = 24시간. 돌아가는 동안 거점에 전기가 들어온다 (소리가 나서 습격이 조금 잦아진다)
 * - 태양광: 낮(7~18시)에만 전기
 * - 전기가 들어오면: 냉장고가 음식을 오래 보관, TV·주크박스·오락기로 기분 전환, 무전 탑이 더 멀리 닿는다
 */

export const FUEL_PER_CAN = 24;
export const FUEL_MAX = 72;
const FUN = new Set(['f_tv', 'f_jukebox', 'f_arcade']);

export function generatorsOf(b: BaseState | undefined) {
  return b?.furniture.filter((f) => f.itemId === 'f_generator') ?? [];
}

/** 지금 이 거점에 전기가 들어오는지 */
export function powerOf(b: BaseState | undefined, s: GameState = store.s): { on: boolean; source: string; hours: number } {
  if (!b) return { on: false, source: '', hours: 0 };
  const fuel = generatorsOf(b).reduce((n, f) => n + (f.fuel ?? 0), 0);
  if (fuel > 0) return { on: true, source: '발전기', hours: Math.round(fuel) };
  const h = hourOf(s.time);
  if (b.furniture.some((f) => f.itemId === 'f_solar_panel') && h >= 7 && h < 18) return { on: true, source: '태양광', hours: 18 - h };
  return { on: false, source: '', hours: 0 };
}

export const hasPowerGear = (b: BaseState | undefined) => !!b?.furniture.some((f) => f.itemId === 'f_generator' || f.itemId === 'f_solar_panel');

/** 발전기에 휘발유 넣기 (창고에서 1통) */
export function refuel(fUid: string): string | null {
  const s = store.s;
  const f = s.base.furniture.find((x) => x.uid === fUid);
  if (!f || f.itemId !== 'f_generator') return null;
  if ((f.fuel ?? 0) >= FUEL_MAX - 1) return '연료통이 가득 찼다.';
  if (!removeItem(s.storage, 'gasoline', 1)) return '창고에 휘발유가 없다.';
  f.fuel = Math.min(FUEL_MAX, (f.fuel ?? 0) + FUEL_PER_CAN);
  addNews(`⛽ [${s.base.name}] 발전기에 휘발유를 넣었다. (${Math.round(f.fuel)}시간)`, 'info');
  store.commit();
  return null;
}

/** 한 시간마다 */
export function tickHourly(s: GameState, hours: number) {
  for (const b of Object.values(s.bases)) withBase(b.id, () => tickBase(s, b, hours));
  // 밖에 들고 다니는 음식
  for (const id of s.characterOrder) {
    const c = s.characters[id];
    if (c && c.status !== 'dead') rotStacks(c.inventory, hours, 1);
  }
}

function tickBase(s: GameState, b: BaseState, hours: number) {
  const power = powerOf(b, s);
  // 발전기 연료
  for (const g of generatorsOf(b)) {
    if ((g.fuel ?? 0) <= 0) continue;
    const before = g.fuel!;
    g.fuel = Math.max(0, before - hours);
    if (g.fuel === 0) addNews(`🔌 [${b.name}] 발전기 연료가 떨어져 전기가 끊겼다.`, 'bad');
  }
  // 상함: 창고 1배, 보관함 1배, 냉장고 0.5배 (전기가 들어오면 0.15배)
  const spoiled: Record<string, number> = {};
  const add = (r: Record<string, number>) => {
    for (const [k, v] of Object.entries(r)) spoiled[k] = (spoiled[k] ?? 0) + v;
  };
  add(rotStacks(b.storage, hours, 1));
  for (const f of b.furniture) if (f.items?.length) add(rotStacks(f.items, hours, f.itemId === 'f_fridge' ? (power.on ? 0.15 : 0.5) : 1));
  const names = Object.entries(spoiled).map(([id, n]) => `${ITEMS[id]?.name} ${n}`);
  if (names.length) addNews(`🦠 [${b.name}] 음식이 상했다: ${names.join(', ')}`, 'bad');
  // 전기가 들어오면 TV·주크박스·오락기로 기분 전환
  if (power.on && b.furniture.some((f) => FUN.has(f.itemId))) {
    for (const id of s.characterOrder) {
      const c = s.characters[id];
      if (c && c.homeId === b.id && c.status === 'base' && !isAsleep(c)) addEffect(c, 'cheered', s.time, '전기가 들어와 TV·음악을 즐겼다', 90);
    }
  }
}

/** 상하는 음식을 시간만큼 묵힌다. 상한 것은 상한 음식으로 바꾸고 개수를 돌려준다 */
function rotStacks(inv: ItemStack[], hours: number, rate: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = inv.length - 1; i >= 0; i--) {
    const st = inv[i];
    const life = ITEMS[st.itemId]?.spoil;
    if (!life) continue;
    st.rot = Math.round(((st.rot ?? 0) + hours * rate) * 10) / 10;
    if (st.rot >= life) {
      out[st.itemId] = (out[st.itemId] ?? 0) + st.qty;
      inv.splice(i, 1);
      addItem(inv, 'rotten_food', st.qty);
    }
  }
  return out;
}

/** 신선도 0~1 (상하지 않는 것은 null) */
export function freshness(st: ItemStack): number | null {
  const life = ITEMS[st.itemId]?.spoil;
  if (!life) return null;
  return Math.max(0, 1 - (st.rot ?? 0) / life);
}
