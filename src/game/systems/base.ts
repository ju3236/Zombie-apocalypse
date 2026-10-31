import { BUILD_BY_ID, FURNITURE, footprint, isPassableWall } from '../data/furniture';
import { ITEMS } from '../data/items';
import { addItem, countItem, removeItem } from '../inventory';
import { addNews, store } from '../store';
import type { BaseState, PlacedFurniture } from '../types';
import { uid } from '../util';
import { addXp, level } from './character';

export const idx = (b: BaseState, x: number, y: number) => y * b.width + x;

export function inClaimed(b: BaseState, x: number, y: number) {
  const c = b.claimed;
  return x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
}

/** 각 칸을 점유한 일반 가구 uid (러그 제외) */
export function occupancy(b: BaseState, ignoreUid?: string): (string | null)[] {
  const occ: (string | null)[] = new Array(b.width * b.height).fill(null);
  for (const f of b.furniture) {
    if (f.uid === ignoreUid) continue;
    if (FURNITURE[f.itemId]?.layer === 'rug') continue;
    const { w, h } = footprint(f.itemId, f.rot);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occ[idx(b, f.x + dx, f.y + dy)] = f.uid;
  }
  return occ;
}

export function canPlace(itemId: string, x: number, y: number, rot: number, ignoreUid?: string): boolean {
  const b = store.s.base;
  const def = FURNITURE[itemId];
  if (!def) return false;
  const { w, h } = footprint(itemId, rot);
  const occ = def.layer === 'rug' ? null : occupancy(b, ignoreUid);
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= b.width || cy >= b.height) return false;
      if (!inClaimed(b, cx, cy)) return false;
      if (b.walls[idx(b, cx, cy)] !== '') return false;
      if (occ && occ[idx(b, cx, cy)]) return false;
      if (def.layer === 'rug') {
        const overlap = b.furniture.some((f) => {
          if (f.uid === ignoreUid || FURNITURE[f.itemId]?.layer !== 'rug') return false;
          const fp = footprint(f.itemId, f.rot);
          return cx >= f.x && cx < f.x + fp.w && cy >= f.y && cy < f.y + fp.h;
        });
        if (overlap) return false;
      }
    }
  return true;
}

export function placeFurniture(itemId: string, x: number, y: number, rot: 0 | 1 | 2 | 3): boolean {
  if (!canPlace(itemId, x, y, rot)) return false;
  if (!removeItem(store.s.storage, itemId, 1)) return false;
  const f: PlacedFurniture = { uid: uid('f'), itemId, x, y, rot, props: [] };
  if (FURNITURE[itemId].production) f.prod = { lastTick: Date.now(), progress: 0, stored: 0, planted: false };
  store.s.base.furniture.push(f);
  store.commit();
  return true;
}

export function moveFurniture(fUid: string, x: number, y: number, rot: 0 | 1 | 2 | 3): boolean {
  const f = store.s.base.furniture.find((x) => x.uid === fUid);
  if (!f || !canPlace(f.itemId, x, y, rot, fUid)) return false;
  f.x = x;
  f.y = y;
  f.rot = rot;
  store.commit();
  return true;
}

export function furnitureAt(x: number, y: number, preferNonRug = true): PlacedFurniture | undefined {
  const b = store.s.base;
  const hits = b.furniture.filter((f) => {
    const { w, h } = footprint(f.itemId, f.rot);
    return x >= f.x && x < f.x + w && y >= f.y && y < f.y + h;
  });
  if (!preferNonRug) return hits[0];
  return hits.find((f) => FURNITURE[f.itemId]?.layer !== 'rug') ?? hits[0];
}

export function pickupFurniture(fUid: string): void {
  const s = store.s;
  const i = s.base.furniture.findIndex((f) => f.uid === fUid);
  if (i < 0) return;
  const f = s.base.furniture[i];
  collectProduction(fUid, false);
  addItem(s.storage, f.itemId, 1);
  for (const p of f.props) addItem(s.storage, p, 1);
  if (f.prod?.planted) addItem(s.storage, 'seeds', 1);
  s.base.furniture.splice(i, 1);
  store.commit();
}

export function rotateFurniture(fUid: string): boolean {
  const f = store.s.base.furniture.find((x) => x.uid === fUid);
  if (!f) return false;
  for (let k = 1; k <= 3; k++) {
    const r = ((f.rot + k) % 4) as 0 | 1 | 2 | 3;
    if (canPlace(f.itemId, f.x, f.y, r, f.uid)) {
      f.rot = r;
      store.commit();
      return true;
    }
  }
  return false;
}

export function addProp(fUid: string, propId: string): string | null {
  const f = store.s.base.furniture.find((x) => x.uid === fUid);
  const def = f && FURNITURE[f.itemId];
  if (!f || !def?.surface) return '소품을 올릴 수 없는 가구다.';
  if (f.props.length >= def.surface) return '더 올릴 자리가 없다.';
  if (!removeItem(store.s.storage, propId, 1)) return '창고에 해당 물건이 없다.';
  f.props.push(propId);
  store.commit();
  return null;
}

export function removeProp(fUid: string, index: number): void {
  const f = store.s.base.furniture.find((x) => x.uid === fUid);
  if (!f) return;
  const [p] = f.props.splice(index, 1);
  if (p) addItem(store.s.storage, p, 1);
  store.commit();
}

export function setOwner(fUid: string, ownerId: string | undefined): void {
  const f = store.s.base.furniture.find((x) => x.uid === fUid);
  if (!f) return;
  f.ownerId = ownerId || undefined;
  store.commit();
}

// ───────────── 생산 시설 ─────────────

export function collectProduction(fUid: string, commit = true): number {
  const s = store.s;
  const f = s.base.furniture.find((x) => x.uid === fUid);
  const p = f && FURNITURE[f.itemId]?.production;
  if (!f || !p || !f.prod || f.prod.stored <= 0) return 0;
  const n = f.prod.stored;
  addItem(s.storage, p.output, n);
  f.prod.stored = 0;
  if (p.needsSeed) {
    // 수확한 사람: 농업 숙련이 가장 높은 거점 인원
    const farmer = s.characterOrder.map((id) => s.characters[id]).filter((c) => c?.status === 'base').sort((a, b) => level(b, 'farming') - level(a, 'farming'))[0];
    if (farmer) {
      const msg = addXp(farmer, 'farming', 10);
      if (msg) addNews(msg, 'good');
    }
  }
  if (commit) store.commit();
  return n;
}

export function plant(fUid: string): string | null {
  const s = store.s;
  const f = s.base.furniture.find((x) => x.uid === fUid);
  const p = f && FURNITURE[f.itemId]?.production;
  if (!f || !p?.needsSeed || !f.prod) return null;
  if (f.prod.planted) return '이미 무언가 자라고 있다.';
  if (f.prod.stored > 0) return '먼저 수확하자.';
  if (!removeItem(s.storage, p.needsSeed, 1)) return '씨앗이 없다.';
  f.prod.planted = true;
  f.prod.progress = 0;
  f.prod.lastTick = Date.now();
  store.commit();
  return null;
}

// ───────────── 건축 ─────────────

export function buildCost(buildId: string) {
  return BUILD_BY_ID[buildId]?.cost ?? [];
}

export function canAfford(cost: { itemId: string; qty: number }[]): boolean {
  return cost.every((c) => countItem(store.s.storage, c.itemId) >= c.qty);
}

/** 벽/문/창문/바닥 설치. 결과 메시지(실패 시) 반환 */
export function build(x: number, y: number, buildId: string, commit = true): string | null {
  const s = store.s;
  const b = s.base;
  const def = BUILD_BY_ID[buildId];
  if (!def) return '알 수 없는 건축물';
  if (!inClaimed(b, x, y)) return '거점 부지 밖이다. 부지를 확장하자.';
  const i = idx(b, x, y);
  if (def.kind === 'floor') {
    if (b.floor[i] === buildId) return null;
    if (!canAfford(def.cost)) return '재료가 부족하다.';
    for (const c of def.cost) removeItem(s.storage, c.itemId, c.qty);
    b.floor[i] = buildId;
  } else {
    if (b.walls[i] === buildId) return null;
    if (occupancy(b)[i]) return '가구가 있는 자리에는 지을 수 없다.';
    if (b.furniture.some((f) => FURNITURE[f.itemId]?.layer === 'rug' && furnitureAt(x, y, false)?.uid === f.uid)) return '러그를 먼저 치우자.';
    if (!canAfford(def.cost)) return '재료가 부족하다.';
    for (const c of def.cost) removeItem(s.storage, c.itemId, c.qty);
    b.walls[i] = buildId;
    if (!b.floor[i]) b.floor[i] = 'floor_concrete';
  }
  if (commit) store.commit();
  return null;
}

export function demolish(x: number, y: number, what: 'wall' | 'floor', commit = true): string | null {
  const s = store.s;
  const b = s.base;
  if (!inClaimed(b, x, y)) return '거점 부지 밖이다.';
  const i = idx(b, x, y);
  if (what === 'wall') {
    const w = b.walls[i];
    if (!w) return null;
    // 재료 절반 회수
    for (const c of BUILD_BY_ID[w]?.cost ?? []) {
      const back = Math.floor(c.qty / 2);
      if (back > 0) addItem(s.storage, c.itemId, back);
    }
    b.walls[i] = '';
  } else {
    if (!b.floor[i]) return null;
    if (occupancy(b)[i] || furnitureAt(x, y)) return '가구를 먼저 치우자.';
    b.floor[i] = '';
  }
  if (commit) store.commit();
  return null;
}

export const EXPAND_COST = [
  { itemId: 'plank', qty: 12 },
  { itemId: 'nails', qty: 12 },
  { itemId: 'scrap', qty: 4 },
];

export function canExpand(): boolean {
  const b = store.s.base;
  const c = b.claimed;
  return c.x0 > 0 || c.y0 > 0 || c.x1 < b.width - 1 || c.y1 < b.height - 1;
}

/** 부지 확장: 울타리를 넓혀 건축 가능 영역을 늘린다 */
export function expandBase(): string | null {
  const s = store.s;
  const b = s.base;
  if (!canExpand()) return '더 이상 넓힐 수 없다.';
  if (!canAfford(EXPAND_COST)) return '재료가 부족하다.';
  for (const c of EXPAND_COST) removeItem(s.storage, c.itemId, c.qty);
  const c = b.claimed;
  b.claimed = {
    x0: Math.max(0, c.x0 - 2),
    y0: Math.max(0, c.y0 - 1),
    x1: Math.min(b.width - 1, c.x1 + 2),
    y1: Math.min(b.height - 1, c.y1 + 2),
  };
  addNews('울타리를 넓혀 거점 부지를 확장했다!', 'good');
  store.commit();
  return null;
}

// ───────────── 길찾기용 통행 맵 ─────────────

export function walkable(b: BaseState): boolean[] {
  const occ = occupancy(b);
  return b.walls.map((w, i) => isPassableWall(w) && !occ[i]);
}

export function furnitureName(f: PlacedFurniture) {
  return ITEMS[f.itemId]?.name ?? f.itemId;
}
