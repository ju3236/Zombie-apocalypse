import Phaser from 'phaser';
import { FLOORS, FURNITURE, WALLS, type FurnitureDef } from '../game/data/furniture';

/** 아이소메트릭 타일 크기 (2:1 마름모) */
export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;
/** 뒤쪽 벽 높이 / 앞쪽(잘린) 벽 높이 */
export const WALL_H = 72;
export const LOW_H = 10;

type G = Phaser.GameObjects.Graphics;

export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

function gen(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

type Pt = { x: number; y: number };
const poly = (g: G, pts: Pt[], color: number, alpha = 1) => {
  g.fillStyle(color, alpha);
  g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
};
const outlinePoly = (g: G, pts: Pt[], color = 0x000000, alpha = 0.55) => {
  g.lineStyle(1, color, alpha);
  g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
};

/**
 * w × d 칸을 차지하고 높이 h 인 상자를 그린다.
 * (ox, oy) = 바닥면 위쪽 꼭짓점 좌표 (텍스처 안)
 */
function isoBox(g: G, ox: number, oy: number, w: number, d: number, h: number, top: number, left?: number, right?: number) {
  const A = { x: ox, y: oy - h }; // 위면 위 꼭짓점
  const B = { x: ox + w * HW, y: oy + w * HH - h }; // 위면 오른쪽
  const C = { x: ox + (w - d) * HW, y: oy + (w + d) * HH - h }; // 위면 아래
  const Dp = { x: ox - d * HW, y: oy + d * HH - h }; // 위면 왼쪽
  const lf = left ?? shade(top, 0.78);
  const rf = right ?? shade(top, 0.6);
  if (h > 0) {
    poly(g, [Dp, C, { x: C.x, y: C.y + h }, { x: Dp.x, y: Dp.y + h }], lf);
    poly(g, [C, B, { x: B.x, y: B.y + h }, { x: C.x, y: C.y + h }], rf);
  }
  poly(g, [A, B, C, Dp], top);
  outlinePoly(g, h > 0 ? [A, B, { x: B.x, y: B.y + h }, { x: C.x, y: C.y + h }, { x: Dp.x, y: Dp.y + h }, Dp] : [A, B, C, Dp]);
  return { A, B, C, D: Dp };
}

/** 위면 위의 한 점 (u: 오른쪽 방향 0~w, v: 왼쪽 방향 0~d) */
const topPt = (ox: number, oy: number, h: number, u: number, v: number): Pt => ({ x: ox + (u - v) * HW, y: oy + (u + v) * HH - h });

// 가구별 높이와 장식
const HEIGHT: Record<string, number> = {
  f_mattress: 6, f_bed: 12, f_chair: 14, f_table: 22, f_desk: 22, f_sofa: 14, f_shelf: 46, f_wardrobe: 58, f_crate: 18, f_rug: 0,
  f_plant: 10, f_lamp: 6, f_tv: 30, f_workbench: 24, f_stove: 16, f_medcab: 44, f_rain: 24, f_planter: 14, f_barricade: 22,
  f_armchair: 14, f_vanity: 24, f_aquarium: 28, f_bookcase: 58, f_dresser: 26, f_sleeping_bag: 4, f_piano: 40, f_neon: 4,
  f_campfire: 4, f_gas_range: 24,
};

function drawFurnitureIso(g: G, d: FurnitureDef, w: number, dep: number, H: number, ox: number, oy: number) {
  const c = d.color;
  const a = d.accent ?? shade(c, 0.7);
  const h = HEIGHT[d.itemId] ?? 16;
  switch (d.itemId) {
    case 'f_rug': {
      isoBox(g, ox, oy, w, dep, 0, c);
      const inset = 0.25;
      const p = [topPt(ox, oy, 0, inset, inset), topPt(ox, oy, 0, w - inset, inset), topPt(ox, oy, 0, w - inset, dep - inset), topPt(ox, oy, 0, inset, dep - inset)];
      outlinePoly(g, p, a, 1);
      return;
    }
    case 'f_bed':
    case 'f_mattress':
    case 'f_sleeping_bag': {
      isoBox(g, ox, oy, w, dep, h, d.itemId === 'f_bed' ? c : c, undefined, undefined);
      // 이불 (뒤쪽 30%는 베개)
      const long = w >= dep; // 긴 방향
      const pil = 0.32;
      const blanket = long
        ? [topPt(ox, oy, h, w * pil, 0.08), topPt(ox, oy, h, w - 0.08, 0.08), topPt(ox, oy, h, w - 0.08, dep - 0.08), topPt(ox, oy, h, w * pil, dep - 0.08)]
        : [topPt(ox, oy, h, 0.08, dep * pil), topPt(ox, oy, h, w - 0.08, dep * pil), topPt(ox, oy, h, w - 0.08, dep - 0.08), topPt(ox, oy, h, 0.08, dep - 0.08)];
      poly(g, blanket, d.itemId === 'f_bed' ? a : shade(c, 0.85));
      const pillow = long
        ? [topPt(ox, oy, h + 2, 0.1, 0.15), topPt(ox, oy, h + 2, w * pil - 0.05, 0.15), topPt(ox, oy, h + 2, w * pil - 0.05, dep - 0.15), topPt(ox, oy, h + 2, 0.1, dep - 0.15)]
        : [topPt(ox, oy, h + 2, 0.15, 0.1), topPt(ox, oy, h + 2, w - 0.15, 0.1), topPt(ox, oy, h + 2, w - 0.15, dep * pil - 0.05), topPt(ox, oy, h + 2, 0.15, dep * pil - 0.05)];
      poly(g, pillow, 0xe8e4d8);
      return;
    }
    case 'f_chair':
    case 'f_armchair':
    case 'f_sofa': {
      isoBox(g, ox, oy, w, dep, h, c, undefined, undefined);
      // 등받이 (뒤쪽 가장자리)
      const back = 0.28;
      const bh = d.itemId === 'f_chair' ? 20 : 16;
      if (w >= dep) isoBox(g, ox, oy - h, w, back, bh, d.accent ?? shade(c, 0.85));
      else isoBox(g, ox, oy - h, back, dep, bh, d.accent ?? shade(c, 0.85));
      return;
    }
    case 'f_lamp': {
      isoBox(g, ox + 0, oy + HH * 0.6, 0.3, 0.3, 30, 0x444444);
      isoBox(g, ox, oy + HH * 0.2, 0.6, 0.6, 10, c, shade(c, 0.85), shade(c, 0.7));
      return;
    }
    case 'f_plant': {
      isoBox(g, ox, oy + HH * 0.4, 0.6, 0.6, h, a);
      g.fillStyle(c).fillCircle(ox, oy + HH - h - 12, 11);
      g.fillStyle(shade(c, 1.3)).fillCircle(ox - 4, oy + HH - h - 16, 5).fillCircle(ox + 5, oy + HH - h - 10, 4);
      return;
    }
    case 'f_campfire': {
      isoBox(g, ox, oy, w, dep, h, 0x5a5a5a);
      const cx = ox;
      const cy = oy + HH - h;
      g.fillStyle(0x6b4a2f).fillRect(cx - 10, cy - 3, 20, 4);
      g.fillStyle(a).fillTriangle(cx - 9, cy, cx + 9, cy, cx, cy - 24);
      g.fillStyle(0xffd060).fillTriangle(cx - 4, cy, cx + 4, cy, cx, cy - 14);
      return;
    }
    case 'f_neon': {
      isoBox(g, ox, oy, w, dep, 30, 0x111111);
      g.lineStyle(2, c).strokeRect(ox - 12, oy - 22, 18, 10);
      g.lineStyle(2, a).lineBetween(ox - 9, oy - 9, ox + 8, oy - 9);
      return;
    }
    default: {
      const r = isoBox(g, ox, oy, w, dep, h, c);
      // 앞면 장식
      if (['f_shelf', 'f_bookcase'].includes(d.itemId)) {
        for (let k = 1; k < 4; k++) {
          const yy = (h * k) / 4;
          g.lineStyle(2, shade(c, 0.45)).lineBetween(r.D.x, r.D.y + yy, r.C.x, r.C.y + yy);
        }
        const cols = [0x8a3a3a, 0x3a5a8a, 0x8a7a3a, 0x3a6a4a];
        for (let k = 0; k < 6; k++) {
          const t = (k + 0.5) / 6;
          const x = r.D.x + (r.C.x - r.D.x) * t;
          const y = r.D.y + (r.C.y - r.D.y) * t;
          g.fillStyle(cols[k % 4]).fillRect(x - 2, y + h * 0.3, 3, h * 0.18);
        }
      } else if (['f_wardrobe', 'f_dresser'].includes(d.itemId)) {
        g.lineStyle(1, shade(c, 0.4)).lineBetween((r.D.x + r.C.x) / 2, (r.D.y + r.C.y) / 2, (r.D.x + r.C.x) / 2, (r.D.y + r.C.y) / 2 + h);
        g.fillStyle(0xd8b04a).fillRect((r.D.x + r.C.x) / 2 - 4, (r.D.y + r.C.y) / 2 + h / 2, 2, 3).fillRect((r.D.x + r.C.x) / 2 + 2, (r.D.y + r.C.y) / 2 + h / 2, 2, 3);
      } else if (d.itemId === 'f_crate') {
        g.lineStyle(1, shade(c, 0.55)).lineBetween(r.D.x, r.D.y, r.C.x, r.C.y + h).lineBetween(r.C.x, r.C.y, r.D.x, r.D.y + h);
      } else if (['f_stove', 'f_gas_range'].includes(d.itemId)) {
        const cx = (r.A.x + r.C.x) / 2;
        const cy = (r.A.y + r.C.y) / 2;
        g.fillStyle(0x222222).fillEllipse(cx - 7, cy, 9, 5).fillEllipse(cx + 7, cy, 9, 5);
        g.fillStyle(a).fillEllipse(cx - 7, cy, 4, 2);
      } else if (['f_tv', 'f_aquarium', 'f_medcab', 'f_piano', 'f_workbench', 'f_planter', 'f_rain', 'f_vanity', 'f_barricade', 'f_desk', 'f_table'].includes(d.itemId)) {
        // 앞면 패널 / 위면 강조
        if (d.itemId === 'f_tv' || d.itemId === 'f_aquarium') poly(g, [{ x: r.D.x + 3, y: r.D.y + 4 }, { x: r.C.x - 3, y: r.C.y + 4 }, { x: r.C.x - 3, y: r.C.y + h - 4 }, { x: r.D.x + 3, y: r.D.y + h - 4 }], a, 0.85);
        if (d.itemId === 'f_medcab') {
          const mx = (r.D.x + r.C.x) / 2;
          const my = (r.D.y + r.C.y) / 2 + h / 2;
          g.fillStyle(a).fillRect(mx - 2, my - 6, 4, 12).fillRect(mx - 6, my - 2, 12, 4);
        }
        if (d.itemId === 'f_planter') poly(g, [topPt(ox, oy, h, 0.15, 0.15), topPt(ox, oy, h, w - 0.15, 0.15), topPt(ox, oy, h, w - 0.15, dep - 0.15), topPt(ox, oy, h, 0.15, dep - 0.15)], 0x3b2a1a);
        if (d.itemId === 'f_piano') poly(g, [{ x: r.D.x, y: r.D.y + h * 0.45 }, { x: r.C.x, y: r.C.y + h * 0.45 }, { x: r.C.x, y: r.C.y + h * 0.6 }, { x: r.D.x, y: r.D.y + h * 0.6 }], a);
        if (d.itemId === 'f_workbench') g.fillStyle(0xaa3333).fillRect((r.A.x + r.C.x) / 2 - 6, (r.A.y + r.C.y) / 2 - 2, 12, 3);
        if (d.itemId === 'f_vanity') isoBox(g, (r.A.x + r.B.x) / 2 - 2, (r.A.y + r.B.y) / 2, 0.15, 0.6, 22, a);
      }
    }
  }
  void H;
}

/** 가구 텍스처 키 (회전에 따라 가로/세로가 바뀐다) */
export const isoFurnKey = (itemId: string, rot: number) => `iso_${itemId}_${rot % 2}`;

/** 텍스처 안에서 바닥면 위 꼭짓점의 위치 */
export function isoFurnAnchor(itemId: string, rot: number) {
  const d = FURNITURE[itemId];
  const w = rot % 2 === 0 ? d.w : d.h;
  const dep = rot % 2 === 0 ? d.h : d.w;
  const H = (HEIGHT[itemId] ?? 16) + 40;
  return { x: dep * HW, y: H, w, dep, H };
}

export function generateIsoTextures(scene: Phaser.Scene) {
  const diamond = (g: G, color: number) => poly(g, [{ x: HW, y: 0 }, { x: TW, y: HH }, { x: HW, y: TH }, { x: 0, y: HH }], color);

  // 바깥 땅
  gen(scene, 'iso_grass', TW, TH, (g) => {
    diamond(g, 0x2c3624);
    g.fillStyle(0x34402b);
    for (let i = 0; i < 6; i++) g.fillRect(14 + ((i * 13) % 34), 8 + ((i * 7) % 16), 2, 1);
  });
  gen(scene, 'iso_dirt', TW, TH, (g) => {
    diamond(g, 0x3a3127);
    g.fillStyle(0x45392c);
    for (let i = 0; i < 5; i++) g.fillRect(16 + ((i * 11) % 30), 9 + ((i * 5) % 14), 2, 1);
  });
  // 바닥재
  for (const f of FLOORS) {
    gen(scene, `iso_${f.id}`, TW, TH, (g) => {
      diamond(g, f.color);
      const a = f.accent ?? shade(f.color, 0.85);
      g.lineStyle(1, a, 1);
      if (f.id === 'floor_wood') {
        for (let k = 1; k < 4; k++) g.lineBetween(HW - k * 8, k * 4, TW - k * 8, HH + k * 4);
      } else if (f.id === 'floor_tile') {
        g.lineBetween(HW / 2, HH / 2, HW + HW / 2, HH + HH / 2);
        g.lineBetween(HW + HW / 2, HH / 2, HW / 2, HH + HH / 2);
      } else {
        g.fillStyle(a).fillRect(24, 12, 2, 1).fillRect(38, 18, 2, 1).fillRect(30, 22, 2, 1);
      }
      g.lineStyle(1, 0x000000, 0.18);
      g.strokePoints([{ x: HW, y: 0 }, { x: TW, y: HH }, { x: HW, y: TH }, { x: 0, y: HH }] as Phaser.Types.Math.Vector2Like[], true);
    });
  }
  // 벽 (높은 것 / 낮은 것)
  for (const w of WALLS) {
    for (const [suffix, h] of [['', WALL_H], ['_low', LOW_H]] as const) {
      gen(scene, `iso_${w.id}${suffix}`, TW, TH + h, (g) => {
        const top = w.kind === 'door' ? 0x3a2e24 : shade(w.color, 0.9);
        const r = isoBox(g, HW, h, 1, 1, h, top, shade(w.color, 1), shade(w.color, 0.72));
        const accent = w.accent ?? shade(w.color, 0.75);
        if (h > 20) {
          if (w.kind === 'window') {
            // 양쪽 면에 창
            poly(g, [{ x: r.D.x + 6, y: r.D.y + 22 }, { x: r.C.x - 6, y: r.C.y + 22 - 3 }, { x: r.C.x - 6, y: r.C.y + 48 - 3 }, { x: r.D.x + 6, y: r.D.y + 48 }], accent);
            poly(g, [{ x: r.C.x + 6, y: r.C.y + 22 - 3 }, { x: r.B.x - 6, y: r.B.y + 22 }, { x: r.B.x - 6, y: r.B.y + 48 }, { x: r.C.x + 6, y: r.C.y + 48 - 3 }], shade(accent, 0.8));
          } else if (w.kind === 'door') {
            poly(g, [{ x: r.D.x + 8, y: r.D.y + 18 }, { x: r.C.x - 8, y: r.C.y + 18 - 4 }, { x: r.C.x - 8, y: r.C.y + h }, { x: r.D.x + 8, y: r.D.y + h }], w.color);
            poly(g, [{ x: r.C.x + 8, y: r.C.y + 18 - 4 }, { x: r.B.x - 8, y: r.B.y + 18 }, { x: r.B.x - 8, y: r.B.y + h }, { x: r.C.x + 8, y: r.C.y + h }], shade(w.color, 0.75));
          } else if (w.id === 'wall_wood') {
            for (let k = 1; k < 5; k++) {
              g.lineStyle(1, accent, 0.8).lineBetween(r.D.x, r.D.y + k * 14, r.C.x, r.C.y + k * 14).lineBetween(r.C.x, r.C.y + k * 14, r.B.x, r.B.y + k * 14);
            }
          } else if (w.id.startsWith('wall_paper')) {
            g.fillStyle(accent);
            for (let k = 0; k < 6; k++) {
              g.fillRect(r.D.x + 4 + k * 5, r.D.y + 16 + k * 2.5 + (k % 2) * 14, 2, 2);
              g.fillRect(r.C.x + 4 + k * 5, r.C.y + 16 - k * 2.5 + (k % 2) * 14, 2, 2);
            }
          }
        } else if (w.kind === 'door') {
          poly(g, [r.A, r.B, r.C, r.D], w.color);
        }
      });
    }
  }
  // 가구
  for (const d of Object.values(FURNITURE)) {
    for (const rot of [0, 1]) {
      const an = isoFurnAnchor(d.itemId, rot);
      const texW = (an.w + an.dep) * HW;
      const texH = (an.w + an.dep) * HH + an.H;
      gen(scene, isoFurnKey(d.itemId, rot), texW, texH, (g) => drawFurnitureIso(g, d, an.w, an.dep, an.H, an.x, an.y));
    }
  }
}
