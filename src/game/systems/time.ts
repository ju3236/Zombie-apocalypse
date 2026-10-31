import { FURNITURE } from '../data/furniture';
import { ITEMS, itemDef } from '../data/items';
import { LOCATION_BY_ID, LOCATIONS } from '../data/locations';
import { addItem, countItem } from '../inventory';
import { makeLocationState } from '../newGame';
import { addNews, store } from '../store';
import type { Character, GameState } from '../types';
import { chance, clamp, hourOf } from '../util';
import { applyConsumable, collapse, level } from './character';

function hasFurniture(s: GameState, pred: (id: string) => boolean): boolean {
  return s.base.furniture.some((f) => pred(f.itemId));
}

/** 침대 품질: 본인 소유 침대 > 아무 침대 > 맨바닥 */
function sleepQuality(s: GameState, c: Character): number {
  const beds = s.base.furniture.filter((f) => FURNITURE[f.itemId]?.use === 'sleep');
  const own = beds.find((b) => b.ownerId === c.id);
  if (own) return (FURNITURE[own.itemId].sleepQuality ?? 0.7) + 0.1;
  if (beds.length) return FURNITURE[beds[0].itemId].sleepQuality ?? 0.7;
  return 0.4;
}

/** 시간 경과. 위험한 사건은 여기서 발생시키지 않는다 (탐험 중에만). */
export function advanceTime(minutes: number): void {
  const s = store.s;
  let left = Math.max(0, Math.round(minutes));
  while (left > 0) {
    const step = Math.min(60, left);
    const beforeDay = Math.floor(s.time / 1440);
    s.time += step;
    left -= step;
    tickCharacters(s, step / 60);
    const afterDay = Math.floor(s.time / 1440);
    if (afterDay > beforeDay) onNewDay(s);
  }
}

function tickCharacters(s: GameState, h: number) {
  const hour = hourOf(s.time);
  const night = hour >= 22 || hour < 6;
  const medBonus = hasFurniture(s, (id) => id === 'f_medcab') ? 1.3 : 1;

  for (const id of s.characterOrder) {
    const c = s.characters[id];
    if (!c || c.status === 'dead') continue;

    const onExp = c.status === 'expedition';
    const sleeping = !onExp && (night || c.task === 'rest' || c.status === 'down');

    // 기본 소모
    // 잠든 동안은 소모가 적다
    const burn = sleeping ? 0.65 : 1;
    c.hunger = clamp(c.hunger - (onExp ? 3.5 : 2.2) * burn * h, 0, 100);
    c.thirst = clamp(c.thirst - (onExp ? 5 : 3.2) * burn * h, 0, 100);
    if (onExp) c.energy = clamp(c.energy - 5 * h, 0, 100);
    else if (sleeping) c.energy = clamp(c.energy + 9 * h * sleepQuality(s, c), 0, 100);
    else c.energy = clamp(c.energy - 1.5 * h, 0, 100);

    // 부상
    let bleed = 0;
    for (const inj of c.injuries) {
      if (inj.bandaged) inj.healHours -= h * (onExp ? 0.5 : 1) * medBonus;
      else {
        bleed += inj.type === 'scratch' ? 0.4 : 1.2;
        c.infection = clamp(c.infection + 0.3 * h, 0, 100);
      }
    }
    c.injuries = c.injuries.filter((i) => i.healHours > 0);

    // 감염: 30 미만이면 몸이 이겨내고, 이상이면 진행된다
    if (c.infection > 0) {
      if (c.infection < 30) c.infection = clamp(c.infection - 0.5 * h, 0, 100);
      else c.infection = clamp(c.infection + 0.6 * h, 0, 100);
    }

    let dmg = bleed * h;
    if (c.hunger <= 0) dmg += 2 * h;
    if (c.thirst <= 0) dmg += 3 * h;
    if (c.infection >= 90) dmg += 2 * h;
    else if (c.infection >= 60) dmg += 1 * h;

    // 회복
    if (!onExp && c.hunger > 25 && c.thirst > 25 && bleed === 0 && c.infection < 60) {
      c.health = clamp(c.health + (sleeping ? 2.2 : 0.8) * h * medBonus, 0, 100);
    }

    if (c.infection >= 100) {
      if (c.permadeathAllowed) {
        collapse(c, '감염으로');
        continue;
      }
      c.infection = 99;
    }
    if (dmg > 0) {
      c.health = clamp(c.health - dmg, 0, 100);
      if (c.health <= 0) {
        collapse(c, c.infection >= 90 ? '감염으로 쓰러졌다' : '쓰러졌다');
        continue;
      }
    }

    // 요양 회복
    if (c.status === 'down' && c.health >= 45 && c.energy >= 30) {
      c.status = 'base';
      addNews(`${c.name}이(가) 몸을 추슬러 다시 일어났다.`, 'good');
    }

    // 거점 자동 식사
    if (!onExp && s.settings.autoConsume) autoConsume(s, c);
  }
}

const SAFE_FOOD = ['stew', 'rice_bowl', 'grilled_meat', 'roasted_veg', 'canned_beans', 'canned_tuna', 'ration_pack', 'vegetable', 'chips', 'chocolate'];
const SAFE_DRINK = ['boiled_water', 'water_bottle', 'soda'];

function autoConsume(s: GameState, c: Character) {
  if (c.hunger < 45) {
    const food = SAFE_FOOD.find((id) => countItem(s.storage, id) > 0);
    if (food) {
      eatFromStorage(s, c, food);
    } else if (!recentNews(s, '식량이 바닥')) {
      addNews('공동 창고의 식량이 바닥났다! 탐험이 필요하다.', 'bad');
    }
  }
  if (c.thirst < 45) {
    const drink = SAFE_DRINK.find((id) => countItem(s.storage, id) > 0);
    if (drink) eatFromStorage(s, c, drink);
    else if (!recentNews(s, '마실 물이')) addNews('마실 물이 떨어졌다! 물을 끓이거나 구해 와야 한다.', 'bad');
  }
}

function eatFromStorage(s: GameState, c: Character, itemId: string) {
  const inv = s.storage;
  const idx = inv.findIndex((x) => x.itemId === itemId);
  if (idx < 0) return;
  inv[idx].qty -= 1;
  if (inv[idx].qty <= 0) inv.splice(idx, 1);
  applyConsumable(c, itemId);
  const leaves = ITEMS[itemId]?.consume?.leaves;
  if (leaves) addItem(inv, leaves, 1);
}

function recentNews(s: GameState, frag: string) {
  return s.news.slice(0, 8).some((n) => n.text.includes(frag) && s.time - n.t < 12 * 60);
}

function onNewDay(s: GameState) {
  const day = Math.floor(s.time / 1440) + 1;
  // 고갈된 장소 일부 재보급 (아주 느리게)
  for (const def of LOCATIONS) {
    const ls = s.locations[def.id];
    if (!ls || def.temporary) continue;
    for (const z of def.zones)
      for (const sp of z.spots) {
        const st = ls.zones[z.id]?.spots[sp.id];
        if (st && st.remaining < sp.capacity && chance(0.06)) st.remaining++;
      }
  }
  // 보급 투하 이벤트
  const drop = s.locations['airdrop'];
  if (drop && drop.expiresAt !== undefined && s.time > drop.expiresAt) {
    const busy = Object.values(s.expeditions).some((e) => e.locationId === 'airdrop');
    if (!busy) {
      delete s.locations['airdrop'];
      addNews('보급 투하 지점이 좀비 떼에 뒤덮였다. 더는 접근할 수 없다.', 'info');
    }
  } else if (!drop && day >= 3 && chance(0.3)) {
    const ls = makeLocationState(LOCATION_BY_ID['airdrop'], true);
    ls.expiresAt = s.time + 2 * 1440;
    s.locations['airdrop'] = ls;
    addNews('🪂 멀리서 헬기 소리가 들렸다. 보급 상자가 떨어진 것 같다! (2일간 탐험 가능)', 'good');
  }
  addNews(`── ${day}일차 아침이 밝았다 ──`, 'info');
}

// ───────────── 실시간 생산 (오프라인 진행 포함) ─────────────

export interface ProductionReport {
  [itemId: string]: number;
}

/** 실제 경과 시간에 따라 안전한 생산만 진행한다. */
export function tickProduction(now = Date.now()): ProductionReport {
  const s = store.s;
  const report: ProductionReport = {};
  const helpers = (task: string) =>
    s.characterOrder.filter((id) => {
      const c = s.characters[id];
      return c && c.status === 'base' && c.task === task;
    }).length;
  const farmMult = 1 + 0.4 * helpers('farm');
  const waterMult = 1 + 0.4 * helpers('water');
  const bestFarmer = Math.max(0, ...s.characterOrder.map((id) => (s.characters[id] ? level(s.characters[id], 'farming') : 0)));

  for (const f of s.base.furniture) {
    const def = FURNITURE[f.itemId];
    const p = def?.production;
    if (!p) continue;
    f.prod ??= { lastTick: now, progress: 0, stored: 0 };
    const pr = f.prod;
    if (p.needsSeed && !pr.planted) {
      pr.lastTick = now;
      continue;
    }
    if (pr.stored >= p.cap) {
      pr.lastTick = now;
      continue;
    }
    const mult = p.needsSeed ? farmMult : waterMult;
    const elapsedMin = Math.max(0, (now - pr.lastTick) / 60000) * mult;
    pr.lastTick = now;
    pr.progress += elapsedMin / p.minutes;
    while (pr.progress >= 1 && pr.stored < p.cap) {
      pr.progress -= 1;
      const yieldN = p.yieldPerCycle + (p.needsSeed ? Math.floor(bestFarmer / 3) : 0);
      const add = Math.min(yieldN, p.cap - pr.stored);
      pr.stored += add;
      report[p.output] = (report[p.output] ?? 0) + add;
      if (p.needsSeed) {
        pr.planted = false;
        pr.progress = 0;
        break;
      }
    }
    if (pr.stored >= p.cap) pr.progress = 0;
  }
  return report;
}

export function describeReport(r: ProductionReport): string {
  return Object.entries(r)
    .map(([id, n]) => `${itemDef(id).name} ${n}`)
    .join(', ');
}
