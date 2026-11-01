import { FURNITURE, footprint } from '../data/furniture';
import { residentsOf } from '../homes';
import type { BaseState, Character, GameState, PlacedFurniture } from '../types';

/**
 * 거점 레벨(평판) · 특수 시설 · 방 아늑함.
 */

// ───────────── 특수 시설 ─────────────

export const FACILITIES: Record<string, { name: string; desc: string }> = {
  f_radio_tower: { name: '무전 탑', desc: '먼 곳의 무전이 잡힌다. 사건이 더 자주 생기고, 세력·생존자와 연락이 닿는다.' },
  f_greenhouse: { name: '온실', desc: '씨앗 없이도 채소가 천천히 자란다. 날씨의 영향을 받지 않는다.' },
  f_water_filter: { name: '정수기', desc: '빗물을 걸러 깨끗한 물을 만든다.' },
  f_watchtower: { name: '감시탑', desc: '좀비 떼를 일찍 발견한다 (경보 20분 전). 방어력 +4.' },
};

export const hasFacility = (b: BaseState | undefined, id: string) => !!b?.furniture.some((f) => f.itemId === id);

// ───────────── 거점 레벨 ─────────────

export const BASE_TIERS = [
  { name: '판잣집', icon: '🛖', min: 0, perk: '—' },
  { name: '은신처', icon: '🏠', min: 25, perk: '방어력 +2, 생존자가 찾아오기 시작한다' },
  { name: '요새', icon: '🏰', min: 60, perk: '방어력 +5, 세력이 함부로 하지 못한다' },
  { name: '성채', icon: '🏯', min: 120, perk: '방어력 +9, 떠돌이 상인이 더 좋은 물건을 가져온다' },
];

const TIER_DEFENSE = [0, 2, 5, 9];

export function basePoints(s: GameState, b: BaseState): { total: number; furniture: number; facilities: number; people: number; rep: number } {
  const furniture = b.furniture.length;
  const facilities = b.furniture.filter((f) => FACILITIES[f.itemId]).length * 6;
  const people = residentsOf(s, b.id).length * 4;
  const rep = Math.round(b.rep ?? 0);
  return { total: furniture + facilities + people + rep, furniture, facilities, people, rep };
}

export function baseTier(s: GameState, b: BaseState): number {
  const p = basePoints(s, b).total;
  let t = 0;
  BASE_TIERS.forEach((x, i) => {
    if (p >= x.min) t = i;
  });
  return t;
}

export const tierDefense = (s: GameState, b: BaseState) => TIER_DEFENSE[baseTier(s, b)];

export function addRep(b: BaseState | undefined, n: number) {
  if (b) b.rep = Math.max(0, (b.rep ?? 0) + n);
}

// ───────────── 방 아늑함 ─────────────

const DECOR = new Set([
  'f_rug', 'f_plant', 'f_lamp', 'f_neon', 'f_aquarium', 'f_bookcase', 'f_jukebox', 'f_mirror', 'f_pet_bed', 'f_tv', 'f_piano',
  'f_arcade', 'f_armchair', 'f_sofa', 'f_vanity', 'f_fireplace', 'f_bean_bag', 'f_floor_cushion', 'f_xmas_tree', 'f_nightstand',
]);
const UGLY = new Set(['f_barricade', 'f_sandbags', 'f_generator', 'f_rain', 'f_water_filter', 'f_workbench']);

const center = (f: PlacedFurniture) => {
  const fp = footprint(f.itemId, f.rot);
  return { x: f.x + fp.w / 2, y: f.y + fp.h / 2 };
};

export const COMFORT_MAX = 20;

/** 침대 주변(3칸 안)이 얼마나 아늑한지 0~20 */
export function comfortOf(b: BaseState, bed: PlacedFurniture): number {
  const c = center(bed);
  let score = (FURNITURE[bed.itemId]?.sleepQuality ?? 0.7) >= 1 ? 2 : 0;
  for (const f of b.furniture) {
    if (f.uid === bed.uid) continue;
    const o = center(f);
    if (Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) > 3.5) continue;
    if (UGLY.has(f.itemId)) score -= 1;
    else score += DECOR.has(f.itemId) ? 2 : 1;
    if (FURNITURE[f.itemId]?.light) score += 1;
    score += f.props.length;
  }
  // 침대 아래 바닥이 깔려 있으면
  const floor = b.floor[Math.floor(c.y) * b.width + Math.floor(c.x)];
  if (floor && floor.startsWith('floor_')) score += 1;
  return Math.max(0, Math.min(COMFORT_MAX, score));
}

export function comfortLabel(n: number): string {
  if (n >= 12) return '아주 아늑함';
  if (n >= 8) return '아늑함';
  if (n >= 4) return '그럭저럭';
  return '썰렁함';
}

/** 캐릭터가 자는 침대: 본인 소유 → 아무 침대 */
export function bedOf(b: BaseState, c: Character): PlacedFurniture | undefined {
  const beds = b.furniture.filter((f) => FURNITURE[f.itemId]?.use === 'sleep');
  return beds.find((f) => f.ownerId === c.id) ?? beds.find((f) => !f.ownerId) ?? beds[0];
}

/** 아늑한 잠 버프가 붙는 기준 */
export const COZY_AT = 8;
