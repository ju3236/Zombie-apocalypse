/**
 * 오리지널 도시 생성기 (고정 시드 → 모든 플레이어가 같은 지도를 본다)
 *
 * 북쪽 강과 항구, 남서쪽 해안, 도심 격자 도로, 순환 고속도로, 철도,
 * 중앙 대공원과 호수, 외곽 숲과 농지로 이루어진 가상의 도시 "회색강시(灰色江市)".
 * 1타일 = 지도 1픽셀. 화면에서는 확대해서 도트풍으로 보여준다.
 */

export const MAP_W = 360;
export const MAP_H = 320;

export const Tile = {
  Land: 0,
  Forest: 1,
  Water: 2,
  Road: 3,
  Highway: 4,
  Building: 5,
  Park: 6,
  FieldA: 7,
  FieldB: 8,
  Parking: 9,
  Rail: 10,
  Sand: 11,
  Trail: 12,
  Plaza: 13,
  DeepWater: 14,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** 구역(대분류) 번호 */
export const D = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Local: 3,
  Medical: 4,
  Education: 5,
  Admin: 6,
  Industrial: 7,
  Transport: 8,
  Farm: 9,
  Nature: 10,
  Harbor: 11,
  Utility: 12,
  Military: 13,
  Research: 14,
  Secret: 15,
} as const;
export type D = (typeof D)[keyof typeof D];

export interface Center {
  x: number;
  y: number;
  d: D;
  w: number; // 영향력(클수록 넓다)
  name: string; // 동네 이름
}

/** 동네 배치 (손으로 정한 도시 구조) */
export const CENTERS: Center[] = [
  { x: 70, y: 26, d: D.Harbor, w: 0.8, name: '서항동' },
  { x: 190, y: 24, d: D.Harbor, w: 0.75, name: '중앙부두' },
  { x: 300, y: 28, d: D.Harbor, w: 0.75, name: '동항동' },
  { x: 168, y: 62, d: D.Commercial, w: 1.15, name: '중앙동' },
  { x: 236, y: 58, d: D.Commercial, w: 0.85, name: '신시가지' },
  { x: 118, y: 66, d: D.Admin, w: 0.9, name: '관청가' },
  { x: 40, y: 66, d: D.Industrial, w: 1.05, name: '북공단' },
  { x: 74, y: 290, d: D.Industrial, w: 0.85, name: '남부공단' },
  { x: 76, y: 140, d: D.Education, w: 1, name: '학원동' },
  { x: 170, y: 128, d: D.Medical, w: 0.9, name: '백운동' },
  { x: 248, y: 110, d: D.Local, w: 0.85, name: '시장통' },
  { x: 132, y: 214, d: D.Local, w: 0.8, name: '골목동' },
  { x: 244, y: 236, d: D.Local, w: 0.85, name: '남문동' },
  { x: 116, y: 104, d: D.Residential, w: 1, name: '은행나무동' },
  { x: 40, y: 190, d: D.Residential, w: 1.05, name: '서림동' },
  { x: 300, y: 150, d: D.Residential, w: 1.05, name: '동화동' },
  { x: 312, y: 228, d: D.Residential, w: 0.95, name: '갈대동' },
  { x: 128, y: 262, d: D.Residential, w: 0.95, name: '해송동' },
  { x: 222, y: 166, d: D.Residential, w: 0.75, name: '언덕동' },
  { x: 192, y: 196, d: D.Nature, w: 1.35, name: '중앙대공원' },
  { x: 342, y: 92, d: D.Nature, w: 0.9, name: '동쪽 숲' },
  { x: 136, y: 168, d: D.Transport, w: 0.75, name: '역전동' },
  { x: 214, y: 290, d: D.Transport, w: 1.05, name: '공항로' },
  { x: 334, y: 292, d: D.Farm, w: 1.1, name: '들녘마을' },
  { x: 22, y: 258, d: D.Farm, w: 0.7, name: '바닷가 농원' },
  { x: 290, y: 66, d: D.Utility, w: 0.8, name: '발전단지' },
  { x: 22, y: 120, d: D.Utility, w: 0.7, name: '정수장길' },
  { x: 286, y: 296, d: D.Military, w: 0.85, name: '봉쇄구역' },
  { x: 334, y: 36, d: D.Research, w: 0.85, name: '연구단지' },
];

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  d: D;
  big: boolean;
  taken?: boolean;
}

export interface City {
  tiles: Uint8Array;
  district: Uint8Array;
  shade: Uint8Array; // 건물 색 변화
  buildings: Building[];
  base: { x: number; y: number; w: number; h: number };
  baseD: D;
}

// ───────────── 난수 / 노이즈 ─────────────
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, scale: number, s: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, s);
  const b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s);
  const d = hash2(x0 + 1, y0 + 1, s);
  const u = sm(tx);
  const v = sm(ty);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

const PARK = { x: 192, y: 196 };

export function generateCity(seed = 20261031): City {
  const W = MAP_W;
  const H = MAP_H;
  const rng = mulberry32(seed);
  const ri = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const tiles = new Uint8Array(W * H);
  const district = new Uint8Array(W * H);
  const shade = new Uint8Array(W * H);
  const at = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const isWater = (t: number) => t === Tile.Water || t === Tile.DeepWater;

  // 1) 지형: 북쪽 강, 남서 해안, 공원 호수, 동쪽 저수지
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const river = 9 + 4 * Math.sin(x / 37) + 2.5 * Math.sin(x / 11 + 1) + (noise(x, 0, 9, 7) - 0.5) * 3;
      const coast = y > 188 ? (y - 188) * 0.33 + 3 * Math.sin(y / 15) + (noise(0, y, 8, 9) - 0.5) * 4 : -99;
      const lake = ((x - PARK.x) / 11) ** 2 + ((y - PARK.y + 2) / 7.5) ** 2 + (noise(x, y, 5, 3) - 0.5) * 0.7;
      const pond = ((x - 330) / 6) ** 2 + ((y - 170) / 4) ** 2;
      let t: Tile = Tile.Land;
      if (y < river - 3 || x < coast - 4) t = Tile.DeepWater;
      else if (y < river || x < coast || lake < 1 || pond < 1) t = Tile.Water;
      else if (y < river + 1.5 || (x < coast + 1.5 && y > 188)) t = Tile.Sand;
      tiles[at(x, y)] = t;
    }

  // 2) 구역: 가중 보로노이
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = 0;
      let bd = Infinity;
      const jx = x + (noise(x, y, 14, 21) - 0.5) * 16;
      const jy = y + (noise(x, y, 14, 22) - 0.5) * 16;
      for (const c of CENTERS) {
        const d = Math.hypot(jx - c.x, jy - c.y) / c.w;
        if (d < bd) {
          bd = d;
          best = c.d;
        }
      }
      district[at(x, y)] = best;
    }

  // 3) 숲·공원
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (tiles[i] !== Tile.Land) continue;
      const d = district[i];
      const n = noise(x, y, 10, 5) * 0.7 + noise(x, y, 4, 6) * 0.3;
      if (d === D.Nature) {
        const near = Math.hypot(x - PARK.x, y - PARK.y) < 36;
        tiles[i] = n > (near ? 0.5 : 0.42) ? Tile.Forest : Tile.Park;
      } else if ((d === D.Farm || d === D.Military || d === D.Utility || d === D.Research) && n > 0.6) tiles[i] = Tile.Forest;
      else if (d === D.Residential && n > 0.74) tiles[i] = Tile.Forest;
    }

  const setRoad = (x: number, y: number, t: Tile) => {
    if (!inb(x, y)) return;
    const i = at(x, y);
    if (isWater(tiles[i])) return;
    if (tiles[i] === Tile.Highway && t === Tile.Road) return;
    tiles[i] = t;
  };
  const line = (x0: number, y0: number, x1: number, y1: number, t: Tile, wdt = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      for (let a = 0; a < wdt; a++) for (let b = 0; b < wdt; b++) setRoad(x + a, y + b, t);
    }
  };

  // 4) 순환 고속도로 + 간선도로
  const RX0 = 12, RY0 = 30, RX1 = 348, RY1 = 308;
  line(RX0 + 30, RY0, RX1 - 6, RY0, Tile.Highway, 2);
  line(RX1, RY0 + 6, RX1, RY1 - 6, Tile.Highway, 2);
  line(RX1 - 6, RY1, 60, RY1, Tile.Highway, 2);
  line(RX0 + 30, RY0, RX0 + 22, RY0 + 160, Tile.Highway, 2);
  line(RX1 - 6, RY0, RX1, RY0 + 6, Tile.Highway, 2);
  line(RX1, RY1 - 6, RX1 - 6, RY1, Tile.Highway, 2);
  line(60, RY1, 30, 250, Tile.Highway, 2);
  line(30, 250, RX0 + 22, RY0 + 160, Tile.Highway, 2);
  const inPark = (x: number, y: number) => Math.hypot((x - PARK.x) / 1.15, y - PARK.y) < 30;
  const vx = [46, 90, 132, 176, 220, 262, 306].map((v) => v + ri(-3, 3));
  const hy = [50, 86, 122, 160, 236, 272].map((v) => v + ri(-3, 3));
  for (const x of vx) for (let y = 14; y < H - 4; y++) if (!inPark(x, y)) setRoad(x, y, Tile.Road), setRoad(x + 1, y, Tile.Road);
  for (const y of hy) for (let x = 4; x < W - 4; x++) if (!inPark(x, y)) setRoad(x, y, Tile.Road), setRoad(x, y + 1, Tile.Road);
  // 공원 순환로
  for (let a = 0; a < Math.PI * 2; a += 0.004) setRoad(Math.round(PARK.x + Math.cos(a) * 36), Math.round(PARK.y + Math.sin(a) * 31), Tile.Road);

  // 5) 구역별 골목길
  const SPACING: Partial<Record<D, number>> = {
    [D.Commercial]: 7, [D.Admin]: 9, [D.Local]: 8, [D.Residential]: 10, [D.Education]: 13, [D.Medical]: 11,
    [D.Harbor]: 11, [D.Industrial]: 15, [D.Transport]: 15, [D.Utility]: 17, [D.Research]: 15, [D.Military]: 17, [D.Farm]: 34,
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      const d = district[i] as D;
      const s = SPACING[d];
      if (!s || tiles[i] === Tile.Forest || inPark(x, y)) continue;
      const ox = (d * 3) % s;
      const oy = (d * 5) % s;
      const onV = (x + ox) % s === 0;
      const onH = (y + oy) % s === 0;
      if (!onV && !onH) continue;
      // 주거지는 일부 구간을 끊어 막다른 길·불규칙한 골목을 만든다
      const segDrop = d === D.Residential || d === D.Farm ? 0.28 : d === D.Local ? 0.12 : 0.05;
      const seg = onV ? hash2(Math.floor((x + ox) / s), Math.floor((y + oy) / s), 11) : hash2(Math.floor((x + ox) / s), Math.floor((y + oy) / s), 13);
      if (seg < segDrop) continue;
      setRoad(x, y, Tile.Road);
    }

  // 6) 철도 (북쪽 부두 → 역전동 → 남쪽 공항)
  const railPts: [number, number][] = [[150, 12], [150, 120], [140, 160], [136, 180], [150, 230], [190, 268], [214, 300], [214, 318]];
  for (let k = 0; k < railPts.length - 1; k++) {
    const [ax, ay] = railPts[k];
    const [bx, by] = railPts[k + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let j = 0; j <= n; j++) {
      const x = Math.round(ax + ((bx - ax) * j) / n);
      const y = Math.round(ay + ((by - ay) * j) / n);
      if (inb(x, y) && !isWater(tiles[at(x, y)])) tiles[at(x, y)] = Tile.Rail;
    }
  }
  // 공원 산책로
  for (let t = 0; t < 6; t++) {
    let x = PARK.x + ri(-25, 25);
    let y = PARK.y + ri(-20, 20);
    for (let k = 0; k < 120; k++) {
      x += ri(-1, 1);
      y += ri(-1, 1);
      if (inb(x, y) && tiles[at(x, y)] !== Tile.Water && tiles[at(x, y)] !== Tile.Road && inPark(x, y)) tiles[at(x, y)] = Tile.Trail;
    }
  }

  // 7) 농지 (밭 줄무늬)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (district[i] !== D.Farm || tiles[i] !== Tile.Land) continue;
      const fx = Math.floor(x / 18);
      const fy = Math.floor(y / 14);
      const h = hash2(fx, fy, 31);
      if (h < 0.7) tiles[i] = (h < 0.35 ? x : y) % 3 === 0 ? Tile.FieldB : Tile.FieldA;
    }

  // 8) 건물
  const buildings: Building[] = [];
  const free = (x: number, y: number, w: number, h: number, d: D, gap: number) => {
    for (let yy = y - gap; yy < y + h + gap; yy++)
      for (let xx = x - gap; xx < x + w + gap; xx++) {
        if (!inb(xx, yy)) return false;
        const t = tiles[at(xx, yy)];
        const inner = xx >= x && xx < x + w && yy >= y && yy < y + h;
        if (inner && (t !== Tile.Land || district[at(xx, yy)] !== d)) return false;
        if (!inner && (t === Tile.Building || t === Tile.Plaza)) return false;
        if (inner && t === Tile.Road) return false;
      }
    return true;
  };
  const nearRoad = (x: number, y: number, w: number, h: number, r: number) => {
    for (let yy = y - r; yy < y + h + r; yy++)
      for (let xx = x - r; xx < x + w + r; xx++) if (inb(xx, yy) && (tiles[at(xx, yy)] === Tile.Road || tiles[at(xx, yy)] === Tile.Highway)) return true;
    return false;
  };
  const fill = (x: number, y: number, w: number, h: number, t: Tile, sh: number) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        tiles[at(xx, yy)] = t;
        shade[at(xx, yy)] = sh;
      }
  };

  // 8-1) 대형 시설 부지 (구역마다 몇 개씩)
  const BIG: Partial<Record<D, number>> = {
    [D.Commercial]: 5, [D.Medical]: 4, [D.Education]: 4, [D.Admin]: 4, [D.Industrial]: 6, [D.Transport]: 5,
    [D.Harbor]: 4, [D.Utility]: 5, [D.Military]: 5, [D.Research]: 5, [D.Local]: 2, [D.Farm]: 3, [D.Nature]: 2, [D.Residential]: 4,
  };
  for (const [dk, n] of Object.entries(BIG)) {
    const d = Number(dk) as D;
    let made = 0;
    for (let tries = 0; tries < 4000 && made < (n ?? 0); tries++) {
      const w = ri(8, 13);
      const h = ri(6, 10);
      const x = ri(2, W - w - 2);
      const y = ri(2, H - h - 2);
      if (district[at(x, y)] !== d) continue;
      if (!free(x, y, w, h, d, 1) || !nearRoad(x, y, w, h, 2)) continue;
      fill(x, y, w, h, Tile.Plaza, 0);
      const bw = w - ri(2, 4);
      const bh = h - ri(2, 3);
      const bx = x + Math.floor((w - bw) / 2);
      const by = y + Math.floor((h - bh) / 2);
      fill(bx, by, bw, bh, Tile.Building, ri(0, 3));
      buildings.push({ x: bx, y: by, w: bw, h: bh, d, big: true });
      made++;
    }
  }

  // 8-2) 일반 건물: 모든 땅 타일을 섞어 돌며 도로를 따라 블록을 채운다
  const STYLE: Partial<Record<D, { w: [number, number]; h: [number, number]; fill: number; lot?: number; road: number }>> = {
    [D.Residential]: { w: [2, 3], h: [2, 3], fill: 0.55, road: 1 },
    [D.Commercial]: { w: [3, 6], h: [2, 5], fill: 0.9, lot: 0.12, road: 1 },
    [D.Local]: { w: [2, 4], h: [2, 3], fill: 0.85, lot: 0.05, road: 1 },
    [D.Medical]: { w: [3, 5], h: [2, 4], fill: 0.7, lot: 0.15, road: 1 },
    [D.Education]: { w: [3, 6], h: [3, 5], fill: 0.5, lot: 0.1, road: 2 },
    [D.Admin]: { w: [3, 5], h: [2, 4], fill: 0.75, lot: 0.1, road: 1 },
    [D.Industrial]: { w: [4, 9], h: [3, 6], fill: 0.6, lot: 0.18, road: 2 },
    [D.Transport]: { w: [4, 8], h: [3, 5], fill: 0.45, lot: 0.35, road: 2 },
    [D.Harbor]: { w: [3, 8], h: [2, 4], fill: 0.6, lot: 0.15, road: 2 },
    [D.Utility]: { w: [3, 6], h: [3, 5], fill: 0.25, lot: 0.1, road: 2 },
    [D.Military]: { w: [3, 7], h: [2, 3], fill: 0.3, lot: 0.2, road: 2 },
    [D.Research]: { w: [3, 6], h: [3, 5], fill: 0.3, lot: 0.1, road: 2 },
    [D.Farm]: { w: [2, 4], h: [2, 3], fill: 0.05, road: 3 },
    [D.Nature]: { w: [2, 3], h: [2, 2], fill: 0.02, road: 3 },
  };
  const order: number[] = [];
  for (let i = 0; i < W * H; i++) if (tiles[i] === Tile.Land) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const i of order) {
    if (tiles[i] !== Tile.Land) continue;
    const d = district[i] as D;
    const st = STYLE[d];
    if (!st || rng() > st.fill) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    const w = ri(st.w[0], st.w[1]);
    const h = ri(st.h[0], st.h[1]);
    if (x + w >= W - 1 || y + h >= H - 1) continue;
    if (!free(x, y, w, h, d, 1) || !nearRoad(x, y, w, h, st.road)) continue;
    if (st.lot && rng() < st.lot) {
      fill(x, y, w, h, Tile.Parking, 0);
      continue;
    }
    fill(x, y, w, h, Tile.Building, ri(0, 3));
    buildings.push({ x, y, w, h, d, big: false });
  }

  // 9) 거점: 은행나무동 근처의 주택
  const homes = buildings.filter((b) => b.d === D.Residential && !b.big).sort((a, b) => Math.hypot(a.x - 104, a.y - 118) - Math.hypot(b.x - 104, b.y - 118));
  const base = homes[0] ?? { x: 104, y: 118, w: 3, h: 3, d: D.Residential, big: false };
  base.taken = true;

  return { tiles, district, shade, buildings, base: { x: base.x, y: base.y, w: base.w, h: base.h }, baseD: base.d as D };
}

export const CITY = generateCity();

/** 장소 배치용: 구역 안의 빈 건물을 고른다 (결정적) */
export function claimBuilding(d: D, size: 'S' | 'M' | 'L', key: string, nearBase = false): { x: number; y: number } {
  const anyDistrict = d === D.Secret;
  let pool = CITY.buildings.filter((b) => !b.taken && (anyDistrict ? b.d !== D.Nature : b.d === d));
  if (size === 'L') {
    const big = pool.filter((b) => b.big);
    if (big.length) pool = big;
  } else if (size === 'M') {
    const mid = pool.filter((b) => b.w * b.h >= 9);
    if (mid.length) pool = mid;
  } else {
    const small = pool.filter((b) => !b.big);
    if (small.length) pool = small;
  }
  if (!pool.length) pool = CITY.buildings.filter((b) => !b.taken);
  if (nearBase) {
    const b0 = CITY.base;
    const b = [...pool].sort((a, c) => Math.hypot(a.x - b0.x, a.y - b0.y) - Math.hypot(c.x - b0.x, c.y - b0.y))[0];
    b.taken = true;
    return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
  }
  // 키 해시로 결정적으로 고르기
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const b = pool[Math.abs(h) % pool.length];
  b.taken = true;
  return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
}

export function distanceFromBase(p: { x: number; y: number }) {
  const b = CITY.base;
  return Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2));
}

export interface Starter {
  x: number;
  y: number;
  w: number;
  h: number;
  d: D;
}
let startersCache: Starter[] | null = null;
/**
 * 처음 살 집 후보 (0번은 원래 거점). 탐험 장소가 다 자리 잡은 뒤 남은 작은 건물 중에서
 * 서로 멀리 떨어지게 고른다 (결정적).
 */
export function starters(): Starter[] {
  if (startersCache) return startersCache;
  const b0 = CITY.base;
  const first: Starter = { ...b0, d: CITY.baseD };
  const homeD: D[] = [D.Residential, D.Local, D.Commercial, D.Farm, D.Harbor];
  const pool = CITY.buildings.filter((b) => !b.taken && !b.big && homeD.includes(b.d as D));
  const out: Starter[] = [first];
  while (out.length < 24 && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      const dmin = Math.min(...out.map((s) => Math.hypot(s.x - b.x, s.y - b.y)));
      if (dmin < 8) continue;
      // 서로 멀리, 그래도 너무 외지지 않게
      const score = dmin - Math.hypot(b.x - b0.x, b.y - b0.y) * 0.08;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    const b = pool.splice(best, 1)[0];
    b.taken = true;
    out.push({ x: b.x, y: b.y, w: b.w, h: b.h, d: b.d as D });
  }
  startersCache = out;
  return out;
}

export function starterPos(i: number): { x: number; y: number } {
  const b = starters()[i] ?? starters()[0];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** 어떤 지점에서 장소까지의 이동 거리로 정한 기본 이동 시간(분) */
export function travelBase(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.round(12 + Math.hypot(to.x - from.x, to.y - from.y) * 0.42);
}
