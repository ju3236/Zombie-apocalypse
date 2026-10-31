import { FURNITURE } from '../data/furniture';
import { ITEMS } from '../data/items';
import type { Recipe } from '../data/recipes';
import { addItem, countItem, hasTag, removeItem } from '../inventory';
import { addNews, store } from '../store';
import type { Character } from '../types';
import { addXp, level } from './character';
import { fixJosa } from '../util';

export function hasStation(station: string): boolean {
  return store.s.base.furniture.some((f) => FURNITURE[f.itemId]?.station === station);
}

/** stove = 불이 있는 곳 (캠핑 스토브 또는 모닥불) */
export const STATION_NAME: Record<string, string> = { workbench: '작업대', stove: '불 (스토브·모닥불)', medical: '의료 캐비닛' };

export const TOOL_NAME: Record<string, string> = {
  hammer: '망치',
  saw: '톱',
  screwdriver: '드라이버',
  pry: '쇠지렛대',
  fire: '라이터 (불씨)',
};

export interface CraftCheck {
  ok: boolean;
  missing: string[];
}

export function checkRecipe(r: Recipe, c: Character | null): CraftCheck {
  const s = store.s;
  const missing: string[] = [];
  for (const inp of r.inputs) {
    const have = countItem(s.storage, inp.itemId);
    if (have < inp.qty) missing.push(`${ITEMS[inp.itemId].name} ${have}/${inp.qty}`);
  }
  for (const t of r.tools ?? []) {
    if (!hasTag(s.storage, t) && !(c && (hasTag(c.inventory, t) || (c.weapon && ITEMS[c.weapon.itemId].tags?.includes(t)))))
      missing.push(`도구: ${TOOL_NAME[t] ?? t}`);
  }
  if (r.station && !hasStation(r.station)) {
    const unplaced = s.storage.find((x) => FURNITURE[x.itemId]?.station === r.station);
    missing.push(unplaced ? fixJosa(`시설: ${STATION_NAME[r.station]} — 창고의 ${ITEMS[unplaced.itemId].name}을(를) 거점에 설치하세요`) : `시설: ${STATION_NAME[r.station]} (제작하거나 탐험에서 구해 거점에 설치)`);
  }
  if (!c) missing.push('제작할 캐릭터 선택');
  else {
    if (c.status !== 'base') missing.push(`${c.name}은(는) 거점에 없다`);
    if (level(c, r.skill) < r.level) missing.push(`숙련도 부족 (Lv.${r.level} 필요)`);
    if (c.energy < 10) missing.push('기력 부족');
  }
  return { ok: missing.length === 0, missing };
}

export function craftTime(r: Recipe, c: Character): number {
  return Math.max(5, Math.round(r.minutes * (1 - level(c, r.skill) * 0.05)));
}

export function craft(r: Recipe, c: Character, times = 1): string {
  let made = 0;
  let mins = 0;
  for (let i = 0; i < times; i++) {
    if (!checkRecipe(r, c).ok) break;
    for (const inp of r.inputs) removeItem(store.s.storage, inp.itemId, inp.qty);
    addItem(store.s.storage, r.output.itemId, r.output.qty);
    const msg = addXp(c, r.skill, 6 + r.level * 3);
    if (msg) addNews(msg, 'good');
    c.stats.crafted++;
    c.energy = Math.max(0, c.energy - 2);
    mins += craftTime(r, c);
    made++;
  }
  if (made) {
    // 실시간이라 시계를 넘기지 않는다. 대신 걸린 시간만큼 지친다
    c.energy = Math.max(0, c.energy - mins / 60);
    addNews(`${c.name}이(가) ${ITEMS[r.output.itemId].name}을(를) ${r.output.qty * made}개 만들었다.`);
  }
  store.commit();
  return made ? `${ITEMS[r.output.itemId].name} x${r.output.qty * made} 완성!` : '제작할 수 없다.';
}

/** 테이프로 무기 수리 */
export function repairWeapon(c: Character, stackUid: string): string {
  const s = store.s;
  if (c.status !== 'base') return `${c.name}은(는) 거점에 없어 창고 테이프를 쓸 수 없다.`;
  const st = s.storage.find((x) => x.uid === stackUid) ?? (c.weapon?.uid === stackUid ? c.weapon : null);
  if (!st || st.durability === undefined) return '수리할 수 없는 물건이다.';
  const max = ITEMS[st.itemId].durability ?? 0;
  if (st.durability >= max) return '이미 멀쩡하다.';
  if (!removeItem(s.storage, 'duct_tape', 1)) return '덕트 테이프가 필요하다.';
  const amount = Math.round(max * (0.3 + level(c, 'crafting') * 0.04));
  st.durability = Math.min(max, st.durability + amount);
  addXp(c, 'crafting', 4);
  store.commit();
  return `${ITEMS[st.itemId].name} 수리 완료 (+${amount})`;
}
