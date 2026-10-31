import Phaser from 'phaser';
import { FLOORS, FURNITURE, WALLS, type FurnitureDef } from '../game/data/furniture';

export const T = 32;

type G = Phaser.GameObjects.Graphics;

function shade(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

function gen(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function outline(g: G, x: number, y: number, w: number, h: number, c = 0x1a1410) {
  g.lineStyle(2, c, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawFurniture(g: G, d: FurnitureDef) {
  const W = d.w * T;
  const H = d.h * T;
  const c = d.color;
  const a = d.accent ?? shade(c, 0.7);
  const p = 3;
  switch (d.itemId) {
    case 'f_mattress':
      g.fillStyle(c).fillRect(p, p, W - p * 2, H - p * 2);
      g.fillStyle(0xeeeeee).fillRect(p + 3, p + 3, W - p * 2 - 6, 12);
      g.fillStyle(a).fillRect(p, H / 2, W - p * 2, H / 2 - p);
      outline(g, p, p, W - p * 2, H - p * 2);
      break;
    case 'f_bed':
      g.fillStyle(c).fillRect(1, 1, W - 2, H - 2);
      g.fillStyle(0xf2f2f2).fillRect(4, 5, W - 8, 12);
      g.fillStyle(a).fillRect(3, 22, W - 6, H - 26);
      g.fillStyle(shade(a, 1.2)).fillRect(3, 22, W - 6, 4);
      outline(g, 1, 1, W - 2, H - 2);
      break;
    case 'f_chair':
      g.fillStyle(shade(c, 0.8)).fillRect(7, 3, 18, 7);
      g.fillStyle(c).fillRect(7, 10, 18, 16);
      outline(g, 7, 3, 18, 23);
      break;
    case 'f_table':
    case 'f_desk':
      g.fillStyle(c).fillRect(2, 3, W - 4, H - 6);
      g.fillStyle(shade(c, 1.15)).fillRect(2, 3, W - 4, 4);
      if (d.itemId === 'f_desk') g.fillStyle(shade(c, 0.7)).fillRect(W - 22, H - 12, 16, 6);
      outline(g, 2, 3, W - 4, H - 6);
      break;
    case 'f_sofa':
      g.fillStyle(a).fillRect(1, 2, W - 2, H - 4);
      g.fillStyle(c).fillRect(5, 9, W - 10, H - 13);
      g.lineStyle(1, a).lineBetween(W / 2, 9, W / 2, H - 4);
      outline(g, 1, 2, W - 2, H - 4);
      break;
    case 'f_shelf':
      g.fillStyle(c).fillRect(1, 2, W - 2, H - 4);
      g.fillStyle(shade(c, 0.6)).fillRect(3, 6, W - 6, 5).fillRect(3, 17, W - 6, 5);
      outline(g, 1, 2, W - 2, H - 4);
      break;
    case 'f_wardrobe':
      g.fillStyle(c).fillRect(1, 1, W - 2, H - 2);
      g.lineStyle(2, shade(c, 0.6)).lineBetween(W / 2, 3, W / 2, H - 3);
      g.fillStyle(0xd8b04a).fillRect(W / 2 - 5, H / 2 - 2, 3, 4).fillRect(W / 2 + 2, H / 2 - 2, 3, 4);
      outline(g, 1, 1, W - 2, H - 2);
      break;
    case 'f_crate':
      g.fillStyle(c).fillRect(3, 3, W - 6, H - 6);
      g.lineStyle(2, shade(c, 0.65)).lineBetween(4, 4, W - 4, H - 4).lineBetween(W - 4, 4, 4, H - 4);
      outline(g, 3, 3, W - 6, H - 6);
      break;
    case 'f_rug':
      g.fillStyle(c, 0.95).fillRect(2, 2, W - 4, H - 4);
      g.lineStyle(2, a).strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle(a).fillRect(W / 2 - 4, H / 2 - 4, 8, 8);
      break;
    case 'f_plant':
      g.fillStyle(a).fillRect(10, 18, 12, 11);
      g.fillStyle(c).fillCircle(16, 13, 9);
      g.fillStyle(shade(c, 1.3)).fillCircle(12, 10, 4).fillCircle(20, 14, 3);
      break;
    case 'f_lamp':
      g.fillStyle(0x444444).fillRect(14, 16, 4, 12).fillRect(10, 26, 12, 3);
      g.fillStyle(c).fillTriangle(8, 17, 24, 17, 16, 5);
      break;
    case 'f_tv':
      g.fillStyle(0x3a3a3a).fillRect(4, 6, W - 8, H - 10);
      g.fillStyle(c).fillRect(7, 9, W - 14, H - 16);
      g.fillStyle(0x556677, 0.6).fillRect(9, 11, 10, 3);
      break;
    case 'f_workbench':
      g.fillStyle(c).fillRect(1, 3, W - 2, H - 6);
      g.fillStyle(a).fillRect(6, 7, 12, 4).fillRect(W - 16, 12, 10, 8);
      g.fillStyle(0xaa3333).fillRect(24, 14, 10, 4);
      outline(g, 1, 3, W - 2, H - 6);
      break;
    case 'f_stove':
      g.fillStyle(c).fillRect(4, 6, 24, 22);
      g.fillStyle(0x222222).fillCircle(16, 16, 7);
      g.fillStyle(a).fillCircle(16, 16, 4);
      outline(g, 4, 6, 24, 22);
      break;
    case 'f_medcab':
      g.fillStyle(c).fillRect(4, 2, 24, 27);
      g.fillStyle(a).fillRect(14, 8, 4, 14).fillRect(9, 13, 14, 4);
      outline(g, 4, 2, 24, 27);
      break;
    case 'f_rain':
      g.fillStyle(c).fillCircle(16, 16, 12);
      g.fillStyle(shade(c, 0.6)).fillCircle(16, 16, 8);
      g.lineStyle(2, 0x1a1410).strokeCircle(16, 16, 12);
      break;
    case 'f_planter':
      g.fillStyle(c).fillRect(1, 4, W - 2, H - 8);
      g.fillStyle(0x3b2a1a).fillRect(4, 7, W - 8, H - 14);
      outline(g, 1, 4, W - 2, H - 8);
      break;
    case 'f_barricade':
      g.fillStyle(c).fillRect(2, 8, 28, 6).fillRect(2, 18, 28, 6);
      g.fillStyle(a).fillRect(4, 8, 4, 16).fillRect(24, 8, 4, 16);
      break;
    case 'f_campfire':
      g.fillStyle(0x5a5a5a).fillCircle(16, 18, 11);
      g.fillStyle(0x2a2420).fillCircle(16, 18, 7);
      g.fillStyle(0x6b4a2f).fillRect(9, 17, 14, 3).fillRect(14, 11, 3, 13);
      g.fillStyle(a).fillTriangle(10, 20, 22, 20, 16, 5);
      g.fillStyle(0xffd060).fillTriangle(13, 20, 19, 20, 16, 10);
      break;
    case 'f_armchair':
      g.fillStyle(a).fillRect(4, 3, 24, 26);
      g.fillStyle(c).fillRect(8, 10, 16, 15);
      outline(g, 4, 3, 24, 26);
      break;
    case 'f_vanity':
      g.fillStyle(c).fillRect(2, 8, W - 4, H - 10);
      g.fillStyle(a).fillRect(W / 2 - 9, 1, 18, 9);
      outline(g, 2, 8, W - 4, H - 10);
      break;
    case 'f_aquarium':
      g.fillStyle(0x222222).fillRect(2, 4, W - 4, H - 8);
      g.fillStyle(a, 0.8).fillRect(4, 6, W - 8, H - 12);
      g.fillStyle(0x3a7a3a).fillRect(8, H - 10, 4, 4).fillRect(W - 14, H - 11, 3, 5);
      break;
    case 'f_bookcase':
      g.fillStyle(c).fillRect(1, 1, W - 2, H - 2);
      for (let i = 0; i < 9; i++) g.fillStyle([0x8a3a3a, 0x3a5a8a, 0x8a7a3a, 0x3a6a4a][i % 4]).fillRect(4 + i * 6, 5, 4, H - 10);
      outline(g, 1, 1, W - 2, H - 2);
      break;
    case 'f_dresser':
      g.fillStyle(c).fillRect(3, 3, 26, 26);
      g.fillStyle(shade(c, 0.7)).fillRect(5, 11, 22, 2).fillRect(5, 19, 22, 2);
      outline(g, 3, 3, 26, 26);
      break;
    case 'f_sleeping_bag':
      g.fillStyle(c).fillRect(6, 3, W - 12, H - 6);
      g.fillStyle(a).fillRect(6, 3, W - 12, 12);
      break;
    case 'f_piano':
      g.fillStyle(c).fillRect(1, 2, W - 2, H - 4);
      g.fillStyle(a).fillRect(4, H - 12, W - 8, 8);
      for (let i = 0; i < 8; i++) g.fillStyle(0x111111).fillRect(7 + i * 7, H - 12, 3, 5);
      break;
    case 'f_neon':
      g.fillStyle(0x111111).fillRect(4, 8, 24, 16);
      g.lineStyle(2, c).strokeRect(7, 11, 18, 10);
      g.lineStyle(1, a).lineBetween(10, 16, 22, 16);
      break;
    default:
      g.fillStyle(c).fillRect(2, 2, W - 4, H - 4);
      outline(g, 2, 2, W - 4, H - 4);
  }
}

/** 모든 임시 스프라이트를 생성한다. ASSET_MANIFEST 로 로드된 키는 건너뛴다. */
export function generatePlaceholders(scene: Phaser.Scene) {
  // 바깥 땅
  gen(scene, 'ground_grass', T, T, (g) => {
    g.fillStyle(0x2f3a27).fillRect(0, 0, T, T);
    g.fillStyle(0x38452d);
    for (let i = 0; i < 6; i++) g.fillRect((i * 13) % 29, (i * 7 + 3) % 29, 2, 3);
  });
  gen(scene, 'ground_dirt', T, T, (g) => {
    g.fillStyle(0x3a3127).fillRect(0, 0, T, T);
    g.fillStyle(0x45392c);
    for (let i = 0; i < 5; i++) g.fillRect((i * 11 + 4) % 29, (i * 9 + 5) % 29, 3, 2);
  });
  // 바닥
  for (const f of FLOORS) {
    gen(scene, f.sprite, T, T, (g) => {
      g.fillStyle(f.color).fillRect(0, 0, T, T);
      g.lineStyle(1, f.accent ?? shade(f.color, 0.85), 1);
      if (f.id === 'floor_wood') {
        g.lineBetween(0, 8, T, 8).lineBetween(0, 16, T, 16).lineBetween(0, 24, T, 24);
        g.lineBetween(12, 0, 12, 8).lineBetween(24, 8, 24, 16).lineBetween(6, 16, 6, 24).lineBetween(20, 24, 20, 32);
      } else if (f.id === 'floor_tile') {
        g.strokeRect(0, 0, 16, 16).strokeRect(16, 0, 16, 16).strokeRect(0, 16, 16, 16).strokeRect(16, 16, 16, 16);
      } else if (f.id === 'floor_carpet') {
        g.fillStyle(f.accent ?? 0).fillRect(4, 4, 2, 2).fillRect(20, 12, 2, 2).fillRect(10, 24, 2, 2);
      } else {
        g.fillStyle(f.accent ?? 0).fillRect(5, 7, 2, 2).fillRect(22, 18, 3, 2).fillRect(13, 27, 2, 2);
      }
    });
  }
  // 벽
  for (const w of WALLS) {
    gen(scene, w.sprite, T, T, (g) => {
      const a = w.accent ?? shade(w.color, 0.8);
      if (w.kind === 'door') {
        g.fillStyle(0x3a2e24).fillRect(0, 0, T, T);
        g.fillStyle(w.color).fillRect(4, 2, T - 8, T - 4);
        g.fillStyle(a).fillCircle(T - 9, T / 2, 2);
        return;
      }
      g.fillStyle(w.color).fillRect(0, 0, T, T);
      g.fillStyle(shade(w.color, 1.2)).fillRect(0, 0, T, 6);
      g.fillStyle(shade(w.color, 0.75)).fillRect(0, T - 4, T, 4);
      if (w.kind === 'window') {
        g.fillStyle(a).fillRect(6, 8, T - 12, T - 16);
        g.lineStyle(2, w.color).lineBetween(T / 2, 8, T / 2, T - 8);
      } else if (w.id === 'wall_wood') {
        g.lineStyle(1, a).lineBetween(0, 14, T, 14).lineBetween(0, 22, T, 22);
      } else if (w.id === 'wall_paper_flower') {
        g.fillStyle(a).fillCircle(8, 14, 2).fillCircle(22, 20, 2).fillCircle(14, 24, 1.5);
      } else if (w.id === 'wall_paper_stripe') {
        g.fillStyle(a).fillRect(4, 6, 3, T - 10).fillRect(14, 6, 3, T - 10).fillRect(24, 6, 3, T - 10);
      } else {
        g.lineStyle(1, a).lineBetween(0, 18, T, 18).lineBetween(T / 2, 6, T / 2, 18);
      }
    });
  }
  // 가구
  for (const d of Object.values(FURNITURE)) gen(scene, d.sprite, d.w * T, d.h * T, (g) => drawFurniture(g, d));

  // 캐릭터 파츠 (흰색 → 틴트)
  gen(scene, 'char_legs', 16, 10, (g) => {
    g.fillStyle(0xffffff).fillRect(2, 0, 5, 10).fillRect(9, 0, 5, 10);
  });
  gen(scene, 'char_body', 18, 13, (g) => {
    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 18, 13, 3);
  });
  gen(scene, 'char_head', 14, 14, (g) => {
    g.fillStyle(0xffffff).fillCircle(7, 7, 7);
  });
  gen(scene, 'char_hair', 16, 9, (g) => {
    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 16, 9, { tl: 7, tr: 7, bl: 2, br: 2 });
  });
  gen(scene, 'char_shadow', 20, 8, (g) => {
    g.fillStyle(0x000000, 0.35).fillEllipse(10, 4, 20, 8);
  });

  // 조명 브러시 (어둠 지우기용)
  const brush = (key: string, r: number) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, r * 2, r * 2);
    if (!tex) return;
    const ctx = tex.getContext();
    const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, r * 2, r * 2);
    tex.refresh();
  };
  brush('light_big', 120);
  brush('light_small', 48);
  brush('light_char', 40);
}

export const SPRITE_KEYS = [
  'ground_grass',
  'ground_dirt',
  ...FLOORS.map((f) => f.sprite),
  ...WALLS.map((w) => w.sprite),
  ...Object.values(FURNITURE).map((f) => f.sprite),
  'char_legs',
  'char_body',
  'char_head',
  'char_hair',
];
