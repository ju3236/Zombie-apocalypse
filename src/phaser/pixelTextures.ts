import Phaser from 'phaser';
import { FLOORS, FURNITURE, WALLS } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import {
  CHAR_SIZE, furnSize, HH, HW, LOW_H, paintCharacter, paintFloor, paintFurniture, paintWallStrip, shadeHex, shearWall, TH, TW, WALL_H, WALL_T,
} from './pixel';

/**
 * 도트 텍스처 준비.
 * - 리소스 PNG(assetManifest)가 있으면 그것을, 없으면 임시 도트를 그려서 쓴다.
 * - 리소스 키는 데이터의 sprite 이름 그대로: furn_bed, furn_bed_r1, floor_wood, wall_concrete …
 */

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, Math.max(1, w), Math.max(1, h));
  if (!t) return;
  const c = t.getContext();
  c.imageSmoothingEnabled = false;
  draw(c);
  t.refresh();
}

/** 가구 텍스처 키 (회전 1·3 은 좌우 반전) */
export function furnTexture(scene: Phaser.Scene, itemId: string, rot: number): { key: string; flip: boolean } {
  const sprite = FURNITURE[itemId]?.sprite ?? itemId;
  const odd = rot % 2 === 1;
  if (odd && scene.textures.exists(`${sprite}_r1`)) return { key: `${sprite}_r1`, flip: false };
  if (scene.textures.exists(sprite)) return { key: sprite, flip: odd };
  return { key: `gen_${itemId}`, flip: odd };
}

export const floorKey = (scene: Phaser.Scene, id: string) => (scene.textures.exists(id) ? id : `gen_${id}`);
/** 벽판 텍스처 키. 문·창문은 윗면을 옆 벽 색으로 마감한 판을 따로 둔다 (cap = 옆 벽 id) */
export const panelKey = (wallId: string, dir: 'x' | 'y', h: number, cap?: string) => `panel_${wallId}_${dir}_${h}${cap ? `__${cap}` : ''}`;
export const PANEL_HEIGHTS = [WALL_H, LOW_H, 35];

export function buildPixelTextures(scene: Phaser.Scene) {
  // 바깥 땅
  canvasTex(scene, 'gen_ground_grass', TW, TH, (c) => paintFloor(c, 'grass', 0x2c3624, 0x34402b));
  canvasTex(scene, 'gen_ground_dirt', TW, TH, (c) => paintFloor(c, 'dirt', 0x3a3127, 0x45392c));
  for (const f of FLOORS) if (!scene.textures.exists(f.id)) canvasTex(scene, `gen_${f.id}`, TW, TH, (c) => paintFloor(c, f.id, f.color, f.accent));

  // 벽: 정면 띠(PNG 또는 임시) → 기울인 판
  for (const w of WALLS) {
    let strip: CanvasImageSource;
    if (scene.textures.exists(w.id)) strip = scene.textures.get(w.id).getSourceImage() as CanvasImageSource;
    else {
      canvasTex(scene, `gen_strip_${w.id}`, HW, WALL_H, (c) => paintWallStrip(c, w.color, w.accent, w.kind, w.id));
      strip = scene.textures.get(`gen_strip_${w.id}`).getSourceImage() as CanvasImageSource;
    }
    const capOf = (color: number) => shadeHex('#' + color.toString(16).padStart(6, '0'), 0.45);
    const caps: [string | undefined, string][] = [[undefined, capOf(w.color)]];
    // 문·창문: 이어진 벽과 같은 색 윗면
    if (w.kind !== 'wall') for (const o of WALLS) if (o.kind === 'wall') caps.push([o.id, capOf(o.color)]);
    for (const [capId, cap] of caps)
      for (const h of PANEL_HEIGHTS)
        for (const dir of ['x', 'y'] as const)
          canvasTex(scene, panelKey(w.id, dir, h, capId), HW + WALL_T, h + HH + WALL_T, (c) => shearWall(c, strip, dir, h, cap, dir === 'y' ? 0.82 : 1));
  }

  // 가구
  for (const d of Object.values(FURNITURE)) {
    if (scene.textures.exists(d.sprite)) continue;
    const s = furnSize(d.itemId);
    canvasTex(scene, `gen_${d.itemId}`, s.width, s.height, (c) => paintFurniture(c, d.itemId));
  }

  // 소품: 이모지를 작게 그려 도트처럼
  for (const it of Object.values(ITEMS)) {
    if (it.category !== 'prop') continue;
    const key = `prop_${it.id}`;
    if (scene.textures.exists(key)) continue;
    canvasTex(scene, key, 12, 12, (c) => {
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(it.icon, 6, 7);
    });
  }

  // 좀비 (리소스 키 'zombie' 로 교체 가능)
  if (!scene.textures.exists('zombie'))
    canvasTex(scene, 'gen_zombie', CHAR_SIZE.width, CHAR_SIZE.height, (c) => paintCharacter(c, { skin: '#7d9a6a', hair: '#26231f', shirt: '#4e4236', pants: '#2f3236' }));

  // 그림자 / 선택 고리 / 조명
  canvasTex(scene, 'px_shadow', 16, 6, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(3, 1, 10, 4);
    c.fillRect(1, 2, 14, 2);
  });
  canvasTex(scene, 'px_ring', 22, 10, (c) => {
    c.fillStyle = '#ffd84a';
    c.fillRect(5, 0, 12, 1);
    c.fillRect(5, 9, 12, 1);
    c.fillRect(2, 1, 3, 1);
    c.fillRect(17, 1, 3, 1);
    c.fillRect(2, 8, 3, 1);
    c.fillRect(17, 8, 3, 1);
    c.fillRect(0, 2, 2, 6);
    c.fillRect(20, 2, 2, 6);
  });
  const brush = (key: string, r: number) => {
    if (scene.textures.exists(key)) return;
    canvasTex(scene, key, r * 2, r * 2, (c) => {
      const g = c.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, r * 2, r * 2);
    });
  };
  brush('px_light_big', 60);
  brush('px_light_small', 22);
}

/** 캐릭터 텍스처: 업로드한 도트가 있으면 그것, 없으면 색으로 칠한 기본 도트 */
export function characterTexture(
  scene: Phaser.Scene,
  c: { id: string; sprite?: string; appearance: { skin: string; hair: string; shirt: string; pants: string } },
  onReady: (key: string) => void,
): string {
  const sig = (c.sprite ? c.sprite.length + c.sprite.slice(-24) : '') + JSON.stringify(c.appearance);
  let h = 0;
  for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
  const key = `char_${c.id}_${(h >>> 0).toString(36)}`;
  const fallback = `charbase_${c.id}_${(h >>> 0).toString(36)}`;
  if (!scene.textures.exists(fallback)) canvasTex(scene, fallback, CHAR_SIZE.width, CHAR_SIZE.height, (ctx) => paintCharacter(ctx, c.appearance));
  if (!c.sprite) return fallback;
  if (scene.textures.exists(key)) return key;
  const img = new Image();
  img.onload = () => {
    if (!scene.textures.exists(key)) {
      scene.textures.addImage(key, img);
      // 도트는 또렷하게, 큰 일러스트는 부드럽게 줄여 보이게
      scene.textures.get(key).setFilter(img.height <= 96 ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR);
    }
    onReady(key);
  };
  img.src = c.sprite;
  return fallback;
}
