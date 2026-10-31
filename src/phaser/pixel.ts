/**
 * 도트(픽셀아트) 그리기 도구 — 안티앨리어싱 없이 1px 단위로 그린다.
 * 임시 그래픽과 리소스 템플릿 내보내기가 같이 쓴다. Phaser 에 의존하지 않는다.
 *
 * 기준 크기 (원본 픽셀):
 *   바닥 1칸 = 32 × 16 마름모, 벽 높이 70, 벽 두께 3
 */
import { FURNITURE } from '../game/data/furniture';

export const TW = 32;
export const TH = 16;
export const HW = 16;
export const HH = 8;
export const WALL_H = 70;
export const WALL_T = 3;
export const LOW_H = 6;

type Ctx = CanvasRenderingContext2D;
export type Pt = { x: number; y: number };

export function px(c: Ctx, x: number, y: number, col: string) {
  c.fillStyle = col;
  c.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

/** 픽셀 중심이 안쪽인 칸만 채우는 다각형 (가장자리가 계단식으로 또렷하다) */
export function poly(c: Ctx, pts: Pt[], col: string) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  c.fillStyle = col;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i];
        const b = pts[j];
        if (a.y > cy !== b.y > cy && cx < ((b.x - a.x) * (cy - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      if (inside) c.fillRect(x, y, 1, 1);
    }
}

export function line(c: Ctx, a: Pt, b: Pt, col: string) {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(c, x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });

/** 로컬 좌표계: (ox, oy) = 바닥면 위 꼭짓점 */
export function makeIso(ox: number, oy: number) {
  return (gx: number, gy: number): Pt => ({ x: ox + (gx - gy) * HW, y: oy + (gx + gy) * HH });
}

/** 입체 상자 (gx, gy 에서 w × d 칸, 높이 h) */
export function box(c: Ctx, iso: (x: number, y: number) => Pt, gx: number, gy: number, w: number, d: number, h: number, top: string, left: string, right: string, ol = '#14161a') {
  const A = up(iso(gx, gy), h);
  const B = up(iso(gx + w, gy), h);
  const C = up(iso(gx + w, gy + d), h);
  const D = up(iso(gx, gy + d), h);
  if (h > 0) {
    poly(c, [D, C, up(C, -h), up(D, -h)], left);
    poly(c, [C, B, up(B, -h), up(C, -h)], right);
  }
  poly(c, [A, B, C, D], top);
  const edges: [Pt, Pt][] = [[A, B], [B, C], [C, D], [D, A]];
  if (h > 0) edges.push([D, up(D, -h)], [C, up(C, -h)], [B, up(B, -h)], [up(D, -h), up(C, -h)], [up(C, -h), up(B, -h)]);
  for (const [p, q] of edges) line(c, p, q, ol);
  return { A, B, C, D };
}

export function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// ───────────── 가구 ─────────────

/** 가구 높이 (원본 픽셀) */
export const FURN_H: Record<string, number> = {
  f_mattress: 5, f_bed: 22, f_chair: 22, f_table: 14, f_desk: 20, f_sofa: 16, f_shelf: 40, f_wardrobe: 54, f_crate: 14, f_rug: 0,
  f_plant: 18, f_lamp: 30, f_tv: 22, f_workbench: 20, f_stove: 14, f_medcab: 36, f_rain: 18, f_planter: 10, f_barricade: 16,
  f_armchair: 18, f_vanity: 30, f_aquarium: 22, f_bookcase: 50, f_dresser: 22, f_sleeping_bag: 3, f_piano: 30, f_neon: 22,
  f_campfire: 16, f_gas_range: 20,
};

/** 가구 그림 크기 규칙: 가로 = (가로칸+세로칸)×16, 바닥 마름모는 그림 맨 아래 (가로칸+세로칸)×8 줄 */
export function furnSize(itemId: string) {
  const d = FURNITURE[itemId];
  const w = d?.w ?? 1;
  const dep = d?.h ?? 1;
  const H = (FURN_H[itemId] ?? 16) + 12; // 위쪽 여유
  return { w, dep, width: (w + dep) * HW, height: (w + dep) * HH + H, H };
}

export function paintFurniture(c: Ctx, itemId: string) {
  const def = FURNITURE[itemId];
  if (!def) return;
  const { w, dep, H } = furnSize(itemId);
  const iso = makeIso(dep * HW, H);
  const col = hex(def.color);
  const acc = hex(def.accent ?? Math.round(def.color * 0.7));
  const L = (s: string) => shadeHex(s, 0.82);
  const R = (s: string) => shadeHex(s, 0.66);
  const h = FURN_H[itemId] ?? 16;
  const T = (gx: number, gy: number, hh: number) => up(iso(gx, gy), hh);
  switch (itemId) {
    case 'f_rug': {
      poly(c, [iso(0, 0), iso(w, 0), iso(w, dep), iso(0, dep)], col);
      const k = 0.15;
      [[iso(k, k), iso(w - k, k)], [iso(w - k, k), iso(w - k, dep - k)], [iso(w - k, dep - k), iso(k, dep - k)], [iso(k, dep - k), iso(k, k)]].forEach(([a, b]) => line(c, a, b, acc));
      return;
    }
    case 'f_bed':
    case 'f_mattress':
    case 'f_sleeping_bag': {
      const base = itemId === 'f_bed' ? 8 : itemId === 'f_mattress' ? 5 : 3;
      if (itemId === 'f_bed') box(c, iso, 0, 0, w, 0.25, h, '#1e2024', '#2a2d32', '#202226');
      const s0 = itemId === 'f_bed' ? 0.25 : 0;
      box(c, iso, 0, s0, w, dep - s0, base, itemId === 'f_bed' ? '#26292e' : col, L(col), R(col));
      poly(c, [T(0.08, s0 + 0.1, base), T(w - 0.08, s0 + 0.1, base), T(w - 0.08, s0 + 0.55, base), T(0.08, s0 + 0.55, base)], '#e9e2cf');
      poly(c, [T(0.08, s0 + 0.6, base), T(w - 0.08, s0 + 0.6, base), T(w - 0.08, dep - 0.06, base), T(0.08, dep - 0.06, base)], acc);
      for (let k = 1; k < 4; k++) line(c, T(0.2 + (k * (w - 0.4)) / 4, s0 + 0.8, base), T(0.25 + (k * (w - 0.4)) / 4, dep - 0.2, base), shadeHex(acc, 0.75));
      return;
    }
    case 'f_chair':
    case 'f_armchair':
    case 'f_sofa': {
      const seat = itemId === 'f_chair' ? 11 : 9;
      box(c, iso, 0.1, 0.1, w - 0.2, dep - 0.2, seat, col, L(col), R(col));
      const back = acc;
      box(c, iso, 0.1, 0.1, w - 0.2, 0.18, h, back, L(back), R(back));
      if (itemId !== 'f_chair') {
        box(c, iso, 0.1, 0.1, 0.18, dep - 0.2, seat + 5, back, L(back), R(back));
        box(c, iso, w - 0.28, 0.1, 0.18, dep - 0.2, seat + 5, back, L(back), R(back));
      }
      return;
    }
    case 'f_plant': {
      box(c, iso, 0.3, 0.3, 0.4, 0.4, 7, acc, L(acc), R(acc));
      const p = up(iso(0.5, 0.5), 8);
      const leaves = ['#3c7a32', '#5aa04a', '#8acb5e'];
      for (let i = 0; i < 40; i++) {
        const a = (i * 2.4) % 6.28;
        const r = (i % 7) + 1;
        px(c, p.x + Math.cos(a) * r, p.y - 4 - Math.abs(Math.sin(a)) * r, leaves[i % 3]);
      }
      return;
    }
    case 'f_lamp': {
      box(c, iso, 0.35, 0.35, 0.3, 0.3, 2, '#333', '#2a2a2a', '#222');
      const p = iso(0.5, 0.5);
      line(c, up(p, 2), up(p, 22), '#444');
      poly(c, [up({ x: p.x - 5, y: p.y }, 22), up({ x: p.x + 5, y: p.y }, 22), up({ x: p.x + 3, y: p.y }, 30), up({ x: p.x - 3, y: p.y }, 30)], col);
      line(c, up({ x: p.x - 5, y: p.y }, 22), up({ x: p.x + 5, y: p.y }, 22), shadeHex(col, 0.7));
      return;
    }
    case 'f_campfire': {
      box(c, iso, 0.1, 0.1, 0.8, 0.8, 3, '#5a5a5a', '#4a4a4a', '#3a3a3a');
      const p = up(iso(0.5, 0.5), 3);
      line(c, { x: p.x - 6, y: p.y }, { x: p.x + 6, y: p.y - 2 }, '#6b4a2f');
      poly(c, [{ x: p.x - 5, y: p.y }, { x: p.x + 5, y: p.y }, { x: p.x, y: p.y - 13 }], acc);
      poly(c, [{ x: p.x - 2, y: p.y }, { x: p.x + 2, y: p.y }, { x: p.x, y: p.y - 7 }], '#ffd060');
      return;
    }
    case 'f_neon': {
      const p = iso(0.5, 0.5);
      poly(c, [{ x: p.x - 8, y: p.y - 22 }, { x: p.x + 8, y: p.y - 22 }, { x: p.x + 8, y: p.y - 10 }, { x: p.x - 8, y: p.y - 10 }], '#111');
      line(c, { x: p.x - 6, y: p.y - 19 }, { x: p.x + 5, y: p.y - 19 }, col);
      line(c, { x: p.x - 6, y: p.y - 14 }, { x: p.x + 2, y: p.y - 14 }, acc);
      return;
    }
    default: {
      const r = box(c, iso, 0, 0, w, dep, h, col, L(col), R(col));
      const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      if (itemId === 'f_shelf' || itemId === 'f_bookcase') {
        for (let k = 1; k < 4; k++) line(c, { x: r.D.x, y: r.D.y + (h * k) / 4 }, { x: r.C.x, y: r.C.y + (h * k) / 4 }, shadeHex(col, 0.45));
        const books = ['#8a3a3a', '#3a5a8a', '#8a7a3a', '#3a6a4a'];
        for (let k = 0; k < 7; k++) {
          const t = (k + 0.5) / 7;
          const x = r.D.x + (r.C.x - r.D.x) * t;
          const y = r.D.y + (r.C.y - r.D.y) * t;
          c.fillStyle = books[k % 4];
          c.fillRect(Math.round(x), Math.round(y + h * 0.28), 2, 5);
        }
      } else if (itemId === 'f_wardrobe' || itemId === 'f_dresser') {
        const m = mid(r.D, r.C);
        line(c, m, { x: m.x, y: m.y + h }, shadeHex(col, 0.5));
        px(c, m.x - 2, m.y + h / 2, '#555');
        px(c, m.x + 2, m.y + h / 2 + 1, '#555');
      } else if (itemId === 'f_crate') {
        line(c, r.D, { x: r.C.x, y: r.C.y + h }, shadeHex(col, 0.6));
        line(c, r.C, { x: r.D.x, y: r.D.y + h }, shadeHex(col, 0.6));
      } else if (itemId === 'f_stove' || itemId === 'f_gas_range') {
        const m = mid(r.A, r.C);
        c.fillStyle = '#222';
        c.fillRect(Math.round(m.x - 6), Math.round(m.y - 1), 4, 2);
        c.fillRect(Math.round(m.x + 2), Math.round(m.y + 1), 4, 2);
        px(c, m.x - 4, m.y - 1, acc);
      } else if (itemId === 'f_tv' || itemId === 'f_aquarium') {
        poly(c, [{ x: r.D.x + 2, y: r.D.y + 3 }, { x: r.C.x - 2, y: r.C.y + 3 - 1 }, { x: r.C.x - 2, y: r.C.y + h - 3 }, { x: r.D.x + 2, y: r.D.y + h - 3 }], acc);
      } else if (itemId === 'f_medcab') {
        const m = mid(r.D, r.C);
        c.fillStyle = acc;
        c.fillRect(Math.round(m.x - 1), Math.round(m.y + h / 2 - 4), 2, 8);
        c.fillRect(Math.round(m.x - 4), Math.round(m.y + h / 2 - 1), 8, 2);
      } else if (itemId === 'f_desk') {
        const m = mid(r.A, r.C);
        poly(c, [{ x: m.x - 4, y: m.y - 6 }, { x: m.x + 4, y: m.y - 2 }, { x: m.x + 4, y: m.y + 1 }, { x: m.x - 4, y: m.y - 3 }], '#1a1c1f');
        poly(c, [{ x: m.x - 3, y: m.y - 5 }, { x: m.x + 3, y: m.y - 2 }, { x: m.x + 3, y: m.y }, { x: m.x - 3, y: m.y - 3 }], '#5a7a9a');
      } else if (itemId === 'f_planter') {
        poly(c, [T(0.1, 0.12, h), T(w - 0.1, 0.12, h), T(w - 0.1, dep - 0.12, h), T(0.1, dep - 0.12, h)], '#3b2a1a');
      } else if (itemId === 'f_piano') {
        poly(c, [{ x: r.D.x, y: r.D.y + h * 0.45 }, { x: r.C.x, y: r.C.y + h * 0.45 }, { x: r.C.x, y: r.C.y + h * 0.6 }, { x: r.D.x, y: r.D.y + h * 0.6 }], acc);
      } else if (itemId === 'f_workbench') {
        const m = mid(r.A, r.C);
        c.fillStyle = '#aa3333';
        c.fillRect(Math.round(m.x - 4), Math.round(m.y - 1), 8, 2);
      } else if (itemId === 'f_vanity') {
        const m = mid(r.A, r.B);
        poly(c, [{ x: m.x - 5, y: m.y - 14 }, { x: m.x + 5, y: m.y - 9 }, { x: m.x + 5, y: m.y }, { x: m.x - 5, y: m.y - 5 }], acc);
      }
    }
  }
}

// ───────────── 벽 / 바닥 (정면 그림 → 기울여 붙이기) ─────────────

/** 벽지 한 칸: 정면에서 본 16 × 70 직사각형 */
export const WALL_STRIP = { width: HW, height: WALL_H };

export function paintWallStrip(c: Ctx, color: number, accent: number | undefined, kind: string, id: string) {
  const col = hex(color);
  const acc = hex(accent ?? Math.round(color * 0.75));
  c.fillStyle = col;
  c.fillRect(0, 0, HW, WALL_H);
  c.fillStyle = shadeHex(col, 0.7);
  c.fillRect(0, WALL_H - 3, HW, 3); // 걸레받이
  if (kind === 'window') {
    c.fillStyle = '#e8ebee';
    c.fillRect(2, 14, 12, 34);
    c.fillStyle = '#3c6b3a';
    c.fillRect(3, 15, 10, 32);
    c.fillStyle = '#5a9a4a';
    for (let i = 0; i < 18; i++) c.fillRect(3 + ((i * 7) % 10), 16 + ((i * 11) % 30), 1, 1);
    c.fillStyle = '#e8ebee';
    c.fillRect(7, 15, 1, 32);
    c.fillRect(3, 30, 10, 1);
  } else if (kind === 'door') {
    c.fillStyle = shadeHex(col, 0.6);
    c.fillRect(1, 18, 14, WALL_H - 18);
    c.fillStyle = col;
    c.fillRect(2, 19, 12, WALL_H - 19);
    c.fillStyle = acc;
    c.fillRect(11, 44, 2, 2);
  } else if (id === 'wall_wood') {
    c.fillStyle = acc;
    for (let y = 8; y < WALL_H - 3; y += 9) c.fillRect(0, y, HW, 1);
    for (let y = 0; y < WALL_H - 3; y += 18) c.fillRect(((y / 18) % 2) * 8 + 3, y, 1, 9);
  } else if (id === 'wall_paper_flower') {
    c.fillStyle = acc;
    for (let y = 6; y < WALL_H - 6; y += 12) {
      c.fillRect(4, y, 1, 1);
      c.fillRect(11, y + 6, 1, 1);
    }
  } else if (id === 'wall_paper_stripe') {
    c.fillStyle = acc;
    c.fillRect(3, 0, 2, WALL_H - 3);
    c.fillRect(11, 0, 2, WALL_H - 3);
  } else {
    c.fillStyle = shadeHex(col, 0.9);
    for (let y = 10; y < WALL_H - 3; y += 14) c.fillRect(0, y, HW, 1);
  }
}

/**
 * 정면 직사각형(16 × h) 그림을 비스듬한 벽면으로 기울여 그린다.
 * dir 'x' = 오른쪽 아래로 뻗는 벽 (뒤쪽 벽), 'y' = 왼쪽 아래로 뻗는 벽 (왼쪽 벽)
 * 결과 크기: 16 + 두께 × (h + 8 + 두께)
 */
export function shearWall(c: Ctx, strip: CanvasImageSource, dir: 'x' | 'y', h: number, capColor: string, shade = 1) {
  const W = HW;
  c.save();
  if (dir === 'x') c.setTransform(1, 0.5, 0, 1, 0, WALL_T);
  else c.setTransform(1, -0.5, 0, 1, WALL_T, HH + WALL_T);
  c.imageSmoothingEnabled = false;
  c.drawImage(strip, 0, WALL_H - h, W, h, 0, 0, W, h);
  if (shade !== 1) {
    c.fillStyle = `rgba(0,0,0,${1 - shade})`;
    c.fillRect(0, 0, W, h);
  }
  c.restore();
  // 윗면(두께)
  if (dir === 'x') poly(c, [{ x: 0, y: WALL_T }, { x: W, y: HH + WALL_T }, { x: W + WALL_T, y: HH }, { x: WALL_T, y: 0 }], capColor);
  else poly(c, [{ x: WALL_T, y: HH + WALL_T }, { x: W + WALL_T, y: WALL_T }, { x: W, y: 0 }, { x: 0, y: HH }], capColor);
}

export function paintFloor(c: Ctx, id: string, color: number, accent?: number) {
  const iso = makeIso(HW, 0);
  const col = hex(color);
  const acc = hex(accent ?? Math.round(color * 0.85));
  poly(c, [iso(0, 0), iso(1, 0), iso(1, 1), iso(0, 1)], col);
  if (id === 'floor_wood') {
    for (let k = 1; k < 3; k++) line(c, iso(0, k / 3), iso(1, k / 3), acc);
    line(c, iso(0, 0), iso(0, 1), shadeHex(col, 0.75));
  } else if (id === 'floor_tile') {
    line(c, iso(0, 0), iso(1, 0), acc);
    line(c, iso(0, 0), iso(0, 1), acc);
    px(c, iso(0.5, 0.5).x, iso(0.5, 0.5).y, acc);
  } else if (id === 'floor_carpet') {
    for (let i = 0; i < 6; i++) px(c, 8 + ((i * 5) % 16), 4 + ((i * 3) % 8), acc);
  } else {
    for (let i = 0; i < 4; i++) px(c, 9 + ((i * 7) % 14), 5 + ((i * 3) % 6), acc);
  }
}

// ───────────── 캐릭터 ─────────────

/** 기본 캐릭터 도트 (12 × 18 을 2배로 → 24 × 36) */
const CHAR_PATTERN = [
  '....hhhh....', '..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhh', '.hhsssssshh.', '.hseesseesh.', '.hsssssssh..', '..ssssssss..', '...ssmmss...',
  '...cccccc...', '..cccwwccc..', '.ccccwwcccc.', '.cc.cwwc.cc.', '.ss.cccc.ss.', '....cccc....', '....pp.pp...', '....pp.pp...', '...bbb.bbb..',
];
export const CHAR_SIZE = { width: 26, height: 38 };

export function paintCharacter(c: Ctx, look: { skin: string; hair: string; shirt: string; pants: string }) {
  const colors: Record<string, string> = { h: look.hair, s: look.skin, e: '#2a1a10', m: shadeHex(look.skin, 0.75), c: look.shirt, w: '#e9e9e9', p: look.pants, b: '#0e0f11' };
  const S = 2;
  const at = (x: number, y: number) => (CHAR_PATTERN[y]?.[x] && CHAR_PATTERN[y][x] !== '.' ? CHAR_PATTERN[y][x] : null);
  const ox = 1;
  const oy = 1;
  for (let y = -1; y <= CHAR_PATTERN.length; y++)
    for (let x = -1; x <= 12; x++) {
      if (at(x, y)) continue;
      if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) {
        c.fillStyle = '#000';
        c.fillRect(ox + x * S, oy + y * S, S, S);
      }
    }
  CHAR_PATTERN.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      c.fillStyle = colors[ch];
      c.fillRect(ox + x * S, oy + y * S, S, S);
    }),
  );
}
