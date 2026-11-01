import { FURNITURE } from '../data/furniture';
import { ITEMS } from '../data/items';
import { RECIPES, type Recipe } from '../data/recipes';
import { addItem, countItem, hasTag, removeItem } from '../inventory';
import { addNews, store, withBase } from '../store';
import type { Character } from '../types';
import { addXp, isAsleep, level } from './character';
import { bus } from '../bus';

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
import { chance, fixJosa } from '../util';
import { modsOf } from './traits';

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

export function checkRecipe(r: Recipe, c: Character | null, continuing = false): CraftCheck {
  return withBase(c?.homeId, () => checkRecipeAtHome(r, c, continuing));
}

function checkRecipeAtHome(r: Recipe, c: Character | null, continuing = false): CraftCheck {
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
    if (!continuing && c.crafting) missing.push(`${c.name}은(는) 이미 다른 것을 만들고 있다`);
    if (isAsleep(c)) missing.push(`${c.name}은(는) 자는 중이다`);
  }
  return { ok: missing.length === 0, missing };
}

export function craftTime(r: Recipe, c: Character): number {
  return Math.max(5, Math.round(r.minutes * (1 - level(c, r.skill) * 0.05)));
}

/** 실제로 걸리는 시간 = 레시피 시간 × 이 값 (실제 분) */
export const CRAFT_REAL_FACTOR = 0.5;

/** 하나 만드는 데 걸리는 실제 시간(분) */
export function craftRealMinutes(r: Recipe, c: Character): number {
  return Math.max(1, Math.round(craftTime(r, c) * CRAFT_REAL_FACTOR));
}

const consume = (r: Recipe) => {
  for (const inp of r.inputs) removeItem(store.s.storage, inp.itemId, inp.qty);
};

/** 제작: 시간이 걸리지 않고 바로 완성된다 (대신 기력이 든다). 실패하면 오류 문구 */
export function startCraft(r: Recipe, c: Character, times = 1): string | null {
  return withBase(c.homeId, () => startCraftAtHome(r, c, times));
}

function startCraftAtHome(r: Recipe, c: Character, times = 1): string | null {
  const first = checkRecipe(r, c);
  if (!first.ok) return first.missing[0] ?? '제작할 수 없다.';
  let made = 0;
  const bonus: string[] = [];
  for (let i = 0; i < Math.max(1, times); i++) {
    if (!checkRecipe(r, c).ok) break;
    consume(r);
    addItem(store.s.storage, r.output.itemId, r.output.qty);
    // 직업·특성: 재료 아끼기 / 하나 더 만들기
    const m = modsOf(c);
    const inp = r.inputs[Math.floor(Math.random() * r.inputs.length)];
    if (inp && (m.craftSave ?? 0) > 0 && chance(m.craftSave!)) {
      addItem(store.s.storage, inp.itemId, 1);
      bonus.push(`${ITEMS[inp.itemId].name} 1개 아낌`);
    } else if (inp && (m.craftSave ?? 0) < 0 && chance(-m.craftSave!) && removeItem(store.s.storage, inp.itemId, 1)) bonus.push(`${ITEMS[inp.itemId].name} 1개 망침`);
    const extra = m.craftBonus?.[r.group] ?? 0;
    if (extra > 0 && chance(extra)) {
      addItem(store.s.storage, r.output.itemId, 1);
      bonus.push('하나 더 만듦');
    }
    const msg = addXp(c, r.skill, 6 + r.level * 3);
    if (msg) addNews(msg, 'good');
    c.stats.crafted++;
    c.energy = Math.max(0, c.energy - 2 - craftTime(r, c) / 60);
    made++;
  }
  addNews(`🔨 ${c.name}이(가) ${ITEMS[r.output.itemId].name}을(를) ${r.output.qty * made}개 만들었다.${bonus.length ? ` (${bonus.join(', ')})` : ''}`, 'good');
  store.commit();
  return null;
}

/** 그만두기: 만들던 하나의 재료는 돌려받는다 */
export function cancelCraft(c: Character, quiet = false): void {
  return withBase(c.homeId, () => cancelCraftAtHome(c, quiet));
}

function cancelCraftAtHome(c: Character, quiet = false): void {
  const job = c.crafting;
  if (!job) return;
  const r = RECIPE_BY_ID[job.recipeId];
  if (r) for (const inp of r.inputs) addItem(store.s.storage, inp.itemId, inp.qty);
  delete c.crafting;
  if (!quiet) addNews(`${c.name}이(가) ${r ? ITEMS[r.output.itemId].name : ''} 만들기를 그만뒀다. (${job.done}개 완성)`);
  store.commit();
}

/** 실시간 진행: 다 된 것을 창고에 넣고 다음 것을 시작한다 */
export function processCraft(c: Character, now = Date.now()): boolean {
  return withBase(c.homeId, () => processCraftAtHome(c, now));
}

function processCraftAtHome(c: Character, now = Date.now()): boolean {
  const job = c.crafting;
  if (!job) return false;
  const r = RECIPE_BY_ID[job.recipeId];
  if (!r || c.status !== 'base') {
    cancelCraft(c, true);
    return true;
  }
  let changed = false;
  const out = ITEMS[r.output.itemId];
  const fresh = (t: number) => now - t < 120000;
  while (c.crafting && now >= job.itemEnd) {
    addItem(store.s.storage, r.output.itemId, r.output.qty);
    const msg = addXp(c, r.skill, 6 + r.level * 3);
    if (msg) addNews(msg, 'good');
    c.stats.crafted++;
    c.energy = Math.max(0, c.energy - 2 - craftTime(r, c) / 60);
    job.done++;
    changed = true;
    if (job.done >= job.total) {
      addNews(`🔨 ${c.name}이(가) ${out.name}을(를) ${r.output.qty * job.done}개 만들었다.`, 'good');
      if (fresh(job.itemEnd)) bus.emit('alert', { characterId: c.id, title: `🔨 ${c.name} 제작 완료`, text: `${out.name} ${r.output.qty * job.done}개`, kind: 'good' });
      delete c.crafting;
      break;
    }
    const chk = checkRecipe(r, c, true);
    if (!chk.ok) {
      addNews(`${c.name}의 ${out.name} 제작이 멈췄다: ${chk.missing[0]} (${job.done}개 완성)`, 'info');
      if (fresh(job.itemEnd)) bus.emit('alert', { characterId: c.id, title: `🔨 ${c.name} 제작 멈춤`, text: `${chk.missing[0]} (${job.done}개 완성)`, kind: 'info' });
      delete c.crafting;
      break;
    }
    consume(r);
    job.itemStart = job.itemEnd;
    job.itemEnd += craftRealMinutes(r, c) * 60000;
  }
  return changed;
}

/** 테이프로 무기 수리 */
export function repairWeapon(c: Character, stackUid: string): string {
  return withBase(c.homeId, () => repairWeaponAtHome(c, stackUid));
}

function repairWeaponAtHome(c: Character, stackUid: string): string {
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
