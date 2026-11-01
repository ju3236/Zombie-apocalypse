import { bus } from '../bus';
import { PACK_FURNITURE } from '../data/packItems';
import { mod } from './traits';
import { addRep, hasFacility, tierDefense } from './baseLevel';
import { noteDay } from './story';
import { ITEMS } from '../data/items';
import { addItem } from '../inventory';
import { addNews, store, withBase } from '../store';
import type { Character, GameState } from '../types';
import { chance, dayOf, hourOf, pick, rand } from '../util';
import { addInjury, addXp, damage, isAsleep, level } from './character';
import { addEffect } from './effects';
import { weatherOf } from './weather';

/**
 * 거점 습격.
 * 가끔 좀비 떼가 몰려온다. 실제 시간으로 10분 전에 경고가 뜨고, 그동안 사람을 깨우거나
 * 경계 근무를 세우거나 바리케이드를 설치해 대비한다. 도착하면 방어력과 좀비 수로 결과가 정해진다.
 */

export const RAID_WARN_MS = 10 * 60000;

/** 한 시간에 습격이 시작될 확률 */
const RATE: Record<NonNullable<GameState['settings']['raids']>, number> = { off: 0, low: 1 / 60, normal: 1 / 30, high: 1 / 14 };

export const RAID_LABEL: Record<NonNullable<GameState['settings']['raids']>, string> = {
  off: '끄기',
  low: '가끔 (2~3일에 한 번쯤)',
  normal: '보통 (하루에 한 번쯤)',
  high: '자주 (하루에 두어 번)',
};

/** 방어 시설 점수 */
const WALL_SCORE: Record<string, number> = {
  f_barricade: 3, f_sandbags: 2, f_watchtower: 4,
  ...Object.fromEntries(Object.entries(PACK_FURNITURE).filter(([, f]) => 'def_' in f).map(([id, f]) => [id, (f as { def_: number }).def_])),
};

/** 지금 다루는 거점(withBase)에 머물고 있는 사람 */
const atBase = (s: GameState) => s.characterOrder.map((id) => s.characters[id]).filter((c): c is Character => !!c && c.status === 'base' && c.homeId === s.base.id);

function fighter(c: Character): number {
  const w = c.weapon ? ITEMS[c.weapon.itemId]?.weapon : undefined;
  const wd = w ? (w.damage[0] + w.damage[1]) / 2 : 0.5;
  if (isAsleep(c)) return 0.3;
  if (c.task === 'guard') return Math.max(0, 3 + level(c, 'melee') + wd + mod(c, 'defense'));
  return Math.max(0, 1 + level(c, 'melee') * 0.5 + wd * 0.5 + mod(c, 'defense') * 0.5);
}

/** 지금 방어력 (운 제외) */
export function defenseScore(s: GameState): { total: number; walls: number; people: number; tier: number } {
  const walls = s.base.furniture.reduce((n, f) => n + (WALL_SCORE[f.itemId] ?? 0), 0);
  const people = atBase(s).reduce((n, c) => n + fighter(c), 0);
  const tier = tierDefense(s, s.base);
  return { total: Math.round((walls + people + tier) * 10) / 10, walls, people: Math.round(people * 10) / 10, tier };
}

/** 게임 시간이 minutes 만큼 흐르는 동안 습격이 시작될지 (실시간 진행 중일 때만 부른다) */
export function maybeStartRaid(minutes: number, now = Date.now()): void {
  const s = store.s;
  if (s.raid || minutes <= 0) return;
  const rate = RATE[s.settings.raids ?? 'normal'];
  if (!rate || dayOf(s.time) < 2) return;
  // 사람이 머물고 있는 거점 중 한 곳
  const homes = Object.keys(s.bases).filter((id) => withBase(id, () => atBase(s).length > 0));
  if (!homes.length) return;
  const h = hourOf(s.time);
  const night = h >= 22 || h < 6;
  // 거점이 여러 개면 그만큼 어딘가 습격당할 확률도 늘어난다
  const p = 1 - Math.pow(1 - rate * (night ? 1.8 : 1) * weatherOf(s).raid * Math.min(homes.length, 3), minutes / 60);
  if (!chance(p)) return;
  const baseId = pick(homes);
  const name = s.bases[baseId].name;
  const size = Math.min(20, 3 + Math.floor(dayOf(s.time) / 2) + rand(0, 3));
  // 감시탑이 있으면 일찍 발견한다
  const warn = (hasFacility(s.bases[baseId], 'f_watchtower') ? RAID_WARN_MS * 2 : RAID_WARN_MS) + (hasFacility(s.bases[baseId], 'f_trap_alarm') ? 5 * 60000 : 0);
  const mins = Math.round(warn / 60000);
  s.raid = { baseId, arriveAt: now + warn, warnedAt: now, size };
  addNews(`🧟 좀비 떼 ${size}마리가 [${name}] 쪽으로 몰려온다! ${mins}분 뒤 도착한다.`, 'bad', '🧟 습격 경보');
  bus.emit('alert', { title: '🧟 습격 경보', text: `좀비 ${size}마리가 ${mins}분 뒤 [${name}]에 닥친다! 사람을 깨우고 경계를 세우자.`, kind: 'bad' });
}

/** 도착했으면 결과를 정한다 */
export function resolveRaid(now = Date.now()): boolean {
  const s = store.s;
  const r = s.raid;
  if (!r || now < r.arriveAt) return false;
  s.raid = null;
  if (!s.bases[r.baseId]) return true;
  return withBase(r.baseId, () => resolveAt(r));
}

function resolveAt(r: NonNullable<GameState['raid']>): boolean {
  const s = store.s;
  const people = atBase(s);
  if (!people.length) {
    addNews(`좀비 떼가 빈 [${s.base.name}] 주변을 맴돌다 흩어졌다.`, 'info');
    return true;
  }
  // 자던 사람은 소란에 깬다
  for (const c of people) if (isAsleep(c)) delete c.sleepUntil;
  const def = defenseScore(s);
  const roll = def.total * (0.8 + Math.random() * 0.4);
  const barricades = s.base.furniture.filter((f) => WALL_SCORE[f.itemId]);
  const breakOne = () => {
    if (!barricades.length) return '';
    const f = pick(barricades);
    s.base.furniture = s.base.furniture.filter((x) => x.uid !== f.uid);
    addItem(s.storage, 'plank', 1);
    return ` ${ITEMS[f.itemId]?.name ?? '방어 시설'} 하나가 부서졌다.`;
  };

  if (roll >= r.size) {
    let broke = '';
    if (r.size > roll * 0.7 && chance(0.35)) broke = breakOne();
    for (const c of people.filter((x) => x.task === 'guard')) {
      addXp(c, 'melee', 6);
      c.stats.kills += Math.ceil(r.size / Math.max(1, people.filter((x) => x.task === 'guard').length));
      c.energy = Math.max(0, c.energy - 8);
    }
    addRep(s.base, 3);
    for (const c of people) noteDay(c, `좀비 ${r.size}마리의 습격을 다 함께 막아냈다.`);
    addNews(`🛡️ [${s.base.name}] 좀비 ${r.size}마리의 습격을 막아냈다! (방어력 ${def.total})${broke}`, 'good', '🛡️ 습격을 막아냈다');
    bus.emit('alert', { title: '🛡️ 습격을 막아냈다', text: `좀비 ${r.size}마리를 물리쳤다.${broke}`, kind: 'good' });
    return true;
  }

  // 뚫렸다: 거점 사람들이 다친다
  const excess = r.size - roll;
  const hurt = Math.min(people.length, 1 + Math.floor(excess / 4));
  const victims = [...people].sort(() => Math.random() - 0.5).slice(0, hurt);
  const names: string[] = [];
  for (const c of victims) {
    const bite = chance(0.1);
    addInjury(c, bite ? 'bite' : chance(0.5) ? 'laceration' : 'scratch');
    damage(c, rand(6, 14) + (bite ? 4 : 0));
    addEffect(c, 'shaken', s.time, '거점이 좀비에게 뚫렸다');
    names.push(c.name + (bite ? '(물림!)' : ''));
  }
  let broke = breakOne();
  if (excess > 6) broke += breakOne();
  // 손에 잡히는 데 있던 음식이 엉망이 된다
  const food = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'food');
  let spoiled = '';
  if (food.length && chance(0.5)) {
    const f = pick(food);
    const n = Math.min(f.qty, rand(1, 3));
    f.qty -= n;
    s.storage = s.storage.filter((x) => x.qty > 0);
    spoiled = ` ${ITEMS[f.itemId].name} ${n}개가 못 쓰게 됐다.`;
  }
  for (const c of people) {
    c.energy = Math.max(0, c.energy - 10);
    noteDay(c, '거점이 좀비에게 뚫렸다. 끔찍한 밤이었다.');
  }
  addRep(s.base, -2);
  addNews(`💥 좀비 ${r.size}마리가 [${s.base.name}]을(를) 덮쳤다! 다친 사람: ${names.join(', ')}.${broke}${spoiled}`, 'bad', '💥 거점이 뚫렸다');
  bus.emit('alert', { title: '💥 거점이 뚫렸다', text: `다친 사람: ${names.join(', ')}`, kind: 'bad' });
  return true;
}

/** 대비: 거점의 내 캐릭터를 모두 깨운다 */
export function wakeEveryone(player: string): void {
  const r = store.s.raid;
  withBase(r?.baseId, () => {
    for (const c of atBase(store.s)) if (c.owner === player && isAsleep(c)) delete c.sleepUntil;
  });
  store.commit();
}
