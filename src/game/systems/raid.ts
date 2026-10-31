import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { addItem } from '../inventory';
import { addNews, store } from '../store';
import type { Character, GameState } from '../types';
import { chance, dayOf, hourOf, pick, rand } from '../util';
import { addInjury, addXp, damage, isAsleep, level } from './character';

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
const WALL_SCORE: Record<string, number> = { f_barricade: 3, f_sandbags: 2 };

const atBase = (s: GameState) => s.characterOrder.map((id) => s.characters[id]).filter((c): c is Character => !!c && c.status === 'base');

function fighter(c: Character): number {
  const w = c.weapon ? ITEMS[c.weapon.itemId]?.weapon : undefined;
  const wd = w ? (w.damage[0] + w.damage[1]) / 2 : 0.5;
  if (isAsleep(c)) return 0.3;
  if (c.task === 'guard') return 3 + level(c, 'melee') + wd;
  return 1 + level(c, 'melee') * 0.5 + wd * 0.5;
}

/** 지금 방어력 (운 제외) */
export function defenseScore(s: GameState): { total: number; walls: number; people: number } {
  const walls = s.base.furniture.reduce((n, f) => n + (WALL_SCORE[f.itemId] ?? 0), 0);
  const people = atBase(s).reduce((n, c) => n + fighter(c), 0);
  return { total: Math.round((walls + people) * 10) / 10, walls, people: Math.round(people * 10) / 10 };
}

/** 게임 시간이 minutes 만큼 흐르는 동안 습격이 시작될지 (실시간 진행 중일 때만 부른다) */
export function maybeStartRaid(minutes: number, now = Date.now()): void {
  const s = store.s;
  if (s.raid || minutes <= 0) return;
  const rate = RATE[s.settings.raids ?? 'normal'];
  if (!rate || dayOf(s.time) < 2 || atBase(s).length === 0) return;
  const h = hourOf(s.time);
  const night = h >= 22 || h < 6;
  const p = 1 - Math.pow(1 - rate * (night ? 1.8 : 1), minutes / 60);
  if (!chance(p)) return;
  const size = Math.min(20, 3 + Math.floor(dayOf(s.time) / 2) + rand(0, 3));
  s.raid = { arriveAt: now + RAID_WARN_MS, warnedAt: now, size };
  addNews(`🧟 좀비 떼 ${size}마리가 거점 쪽으로 몰려온다! 10분 뒤 도착한다.`, 'bad');
  bus.emit('alert', { title: '🧟 습격 경보', text: `좀비 ${size}마리가 10분 뒤 거점에 닥친다! 사람을 깨우고 경계를 세우자.`, kind: 'bad' });
}

/** 도착했으면 결과를 정한다 */
export function resolveRaid(now = Date.now()): boolean {
  const s = store.s;
  const r = s.raid;
  if (!r || now < r.arriveAt) return false;
  s.raid = null;
  const people = atBase(s);
  if (!people.length) {
    addNews('좀비 떼가 빈 거점 주변을 맴돌다 흩어졌다.', 'info');
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
    addNews(`🛡️ 좀비 ${r.size}마리의 습격을 막아냈다! (방어력 ${def.total})${broke}`, 'good');
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
  for (const c of people) c.energy = Math.max(0, c.energy - 10);
  addNews(`💥 좀비 ${r.size}마리가 거점을 덮쳤다! 다친 사람: ${names.join(', ')}.${broke}${spoiled}`, 'bad');
  bus.emit('alert', { title: '💥 거점이 뚫렸다', text: `다친 사람: ${names.join(', ')}`, kind: 'bad' });
  return true;
}

/** 대비: 거점의 내 캐릭터를 모두 깨운다 */
export function wakeEveryone(player: string): void {
  for (const c of atBase(store.s)) if (c.owner === player && isAsleep(c)) delete c.sleepUntil;
  store.commit();
}
