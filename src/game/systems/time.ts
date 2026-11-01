import { FURNITURE } from '../data/furniture';
import { ITEMS, itemDef } from '../data/items';
import { LOCATION_BY_ID, LOCATIONS } from '../data/locations';
import { addItem, countItem } from '../inventory';
import { makeLocationState } from '../newGame';
import { addNews, store, withBase } from '../store';
import type { Character, GameState } from '../types';
import { chance, clamp } from '../util';
import { afterSleep, applyConsumable, collapse, level } from './character';
import { addEffect, effectMods, expireEffects } from './effects';
import { hasHeat, isWet, rollWeather, WEATHER, weatherOf } from './weather';

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

/**
 * 시간 경과. 위험한 사건은 여기서 발생시키지 않는다 (탐험 중에만).
 * safe: 아무도 접속하지 않았던 동안을 따라잡을 때. 배고픔·목마름·부상으로 쓰러지지는 않게 한다.
 */
export function advanceTime(minutes: number, safe = false): void {
  const s = store.s;
  let left = Math.max(0, Math.round(minutes));
  while (left > 0) {
    const step = Math.min(60, left);
    const beforeDay = Math.floor(s.time / 1440);
    s.time += step;
    left -= step;
    tickCharacters(s, step / 60, safe);
    const afterDay = Math.floor(s.time / 1440);
    if (afterDay > beforeDay) onNewDay(s);
    // 날씨 바뀜
    if (s.time >= s.weather.until) {
      const before = s.weather.kind;
      s.weather = rollWeather(s);
      if (s.weather.kind !== before) addNews(`${WEATHER[s.weather.kind].icon} 날씨가 바뀌었다: ${WEATHER[s.weather.kind].name}. ${WEATHER[s.weather.kind].desc}`, 'info');
    }
  }
}

function tickCharacters(s: GameState, h: number, safe = false) {
  for (const id of s.characterOrder) {
    const c = s.characters[id];
    if (!c || c.status === 'dead') continue;
    // 그 캐릭터가 사는 거점을 기준으로 (침대·의료 캐비닛·창고)
    withBase(c.homeId, () => tickOne(s, c, h, safe));
  }
}

function tickOne(s: GameState, c: Character, h: number, safe: boolean) {
  const medBonus = hasFurniture(s, (id) => id === 'f_medcab') ? 1.3 : 1;
  // 탐험·이사 중에는 밖에 있다
  const onExp = c.status === 'expedition' || c.status === 'moving';
  // 잠은 직접 재울 때만 (정해 둔 시간이 지나면 깬다)
  if (c.sleepUntil !== undefined && (c.sleepUntil <= s.time || c.status !== 'base')) {
    if (c.status === 'base') {
      afterSleep(c, Math.min(s.time, c.sleepUntil));
      addNews(`${c.name}이(가) 잠에서 깼다.`, 'info');
    }
    delete c.sleepUntil;
    delete c.sleepStart;
  }
  expireEffects(c, s.time);
  // 비 오는 날 밖에 있으면 젖고, 불 있는 거점에 돌아오면 마른다
  if (onExp && isWet(s)) addEffect(c, 'wet', s.time, `${WEATHER[s.weather.kind].name} 속을 돌아다녔다`);
  if (c.status === 'base' && hasHeat(s) && c.effects?.some((e) => e.id === 'wet')) c.effects = c.effects.filter((e) => e.id !== 'wet');
  const mods = effectMods(c, s);
  const sleeping = !onExp && ((c.sleepUntil ?? 0) > s.time || c.task === 'rest' || c.status === 'down');

  // 기본 소모
  // 잠든 동안은 소모가 적다
  const burn = sleeping ? 0.65 : 1;
  c.hunger = clamp(c.hunger - (onExp ? 3.5 : 2.2) * burn * h * mods.hungerDrain, 0, 100);
  c.thirst = clamp(c.thirst - (onExp ? 5 : 3.2) * burn * h * mods.thirstDrain, 0, 100);
  if (onExp) c.energy = clamp(c.energy - 5 * h * mods.energyDrain, 0, 100);
  else if (sleeping) c.energy = clamp(c.energy + 9 * h * sleepQuality(s, c), 0, 100);
  else c.energy = clamp(c.energy - 1.5 * h * mods.energyDrain, 0, 100);

  // 부상
  let bleed = 0;
  for (const inj of c.injuries) {
    if (inj.bandaged) {
      // 소독한 상처는 더 빨리 낫는다
      inj.healHours -= h * (onExp ? 0.5 : 1) * medBonus * (inj.disinfected ? 1.3 : 1);
      if (inj.dirtyBandage && !inj.disinfected) c.infection = clamp(c.infection + 0.15 * h, 0, 100);
    } else {
      bleed += inj.type === 'scratch' ? 0.4 : 1.2;
      if (!inj.disinfected) c.infection = clamp(c.infection + 0.3 * h, 0, 100);
    }
  }
  c.injuries = c.injuries.filter((i) => i.healHours > 0);

  // 감염: 30 미만이면 몸이 이겨내고, 이상이면 진행된다
  if (c.infection > 0) {
    if (c.infection < 30) c.infection = clamp(c.infection - 0.5 * h, 0, 100);
    else c.infection = clamp(c.infection + 0.6 * h, 0, 100);
  }

  // 자리를 비운 동안에는 굶거나 피를 흘려 쓰러지지 않는다
  if (safe) {
    c.hunger = Math.max(c.hunger, 15);
    c.thirst = Math.max(c.thirst, 15);
    c.infection = Math.min(c.infection, 85);
  }
  let dmg = bleed * h;
  if (c.hunger <= 0) dmg += 2 * h;
  if (c.thirst <= 0) dmg += 3 * h;
  if (c.infection >= 90) dmg += 2 * h;
  else if (c.infection >= 60) dmg += 1 * h;

  // 회복
  if (!onExp && c.hunger > 25 && c.thirst > 25 && bleed === 0 && c.infection < 60) {
    c.health = clamp(c.health + (sleeping ? 2.2 : 0.8) * h * medBonus * mods.regen, 0, 100);
  }

  if (c.infection >= 100) {
    if (c.permadeathAllowed) {
      collapse(c, '감염으로');
      return;
    }
    c.infection = 99;
  }
  if (dmg > 0) {
    c.health = clamp(c.health - dmg, safe ? Math.min(c.health, 25) : 0, 100);
    if (c.health <= 0) {
      collapse(c, c.infection >= 90 ? '감염으로 쓰러졌다' : '쓰러졌다');
      return;
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
  const report: ProductionReport = {};
  for (const id of Object.keys(store.s.bases)) withBase(id, () => tickBaseProduction(id, now, report));
  return report;
}

function tickBaseProduction(baseId: string, now: number, report: ProductionReport) {
  const s = store.s;
  const residents = s.characterOrder.map((id) => s.characters[id]).filter((c) => c && c.homeId === baseId);
  const helpers = (task: string) => residents.filter((c) => c.status === 'base' && c.task === task).length;
  const farmMult = 1 + 0.4 * helpers('farm');
  const waterMult = (1 + 0.4 * helpers('water')) * weatherOf(s).water;
  const bestFarmer = Math.max(0, ...residents.map((c) => level(c, 'farming')));

  for (const f of s.base.furniture) {
    const def = FURNITURE[f.itemId];
    const p = def?.production;
    if (!p) continue;
    f.prod ??= { lastTick: now, progress: 0, stored: 0 };
    const pr = f.prod;
    // 멈춰 있는 동안에는 값을 바꾸지 않는다 (같이 살기에서 매번 서버에 올리지 않도록)
    if (p.needsSeed && !pr.planted) continue;
    if (pr.stored >= p.cap) continue;
    const mult = p.needsSeed ? farmMult : waterMult;
    const elapsedMin = Math.max(0, (now - pr.lastTick) / 60000) * mult;
    // 한 번 생산될 만큼 시간이 차기 전에는 아무것도 바꾸지 않는다
    if (pr.progress + elapsedMin / p.minutes < 1) continue;
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
}

export function describeReport(r: ProductionReport): string {
  return Object.entries(r)
    .map(([id, n]) => `${itemDef(id).name} ${n}`)
    .join(', ');
}
