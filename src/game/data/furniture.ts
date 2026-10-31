// 가구 / 건축 정의. sprite 키는 src/phaser/assetManifest.ts 에서 PNG 로 교체할 수 있다.

export type FurnitureUse = 'sleep' | 'sit' | 'work' | 'cook' | 'heal' | 'farm' | 'water' | 'look';

export interface FurnitureDef {
  itemId: string;
  w: number;
  h: number;
  sprite: string;
  /** 'rug' 는 다른 가구 아래에 둘 수 있다 */
  layer: 'rug' | 'normal';
  /** 위에 올릴 수 있는 소품 수 */
  surface?: number;
  use?: FurnitureUse;
  /** 제작 스테이션 id */
  station?: string;
  light?: number;
  /** 실시간 생산 시설 */
  production?: {
    output: string;
    /** 1회 생산에 걸리는 실제 시간(분) */
    minutes: number;
    cap: number;
    /** 씨앗 등 시작 재료 필요 여부 */
    needsSeed?: string;
    yieldPerCycle: number;
  };
  /** 수면 품질 */
  sleepQuality?: number;
  color: number;
  accent?: number;
}

const F = (d: FurnitureDef) => d;

export const FURNITURE: Record<string, FurnitureDef> = Object.fromEntries(
  [
    F({ itemId: 'f_mattress', w: 1, h: 2, sprite: 'furn_mattress', layer: 'normal', use: 'sleep', sleepQuality: 0.7, color: 0xb9b1a0, accent: 0x8a8578 }),
    F({ itemId: 'f_bed', w: 1, h: 2, sprite: 'furn_bed', layer: 'normal', use: 'sleep', sleepQuality: 1, color: 0x6b4a2f, accent: 0x4f78a8 }),
    F({ itemId: 'f_chair', w: 1, h: 1, sprite: 'furn_chair', layer: 'normal', use: 'sit', color: 0x8a5a33 }),
    F({ itemId: 'f_table', w: 2, h: 1, sprite: 'furn_table', layer: 'normal', surface: 3, color: 0x9c6b3e }),
    F({ itemId: 'f_desk', w: 2, h: 1, sprite: 'furn_desk', layer: 'normal', surface: 3, use: 'look', color: 0x704d2e }),
    F({ itemId: 'f_sofa', w: 2, h: 1, sprite: 'furn_sofa', layer: 'normal', use: 'sit', color: 0x6a4c7a, accent: 0x4f3a5c }),
    F({ itemId: 'f_shelf', w: 2, h: 1, sprite: 'furn_shelf', layer: 'normal', surface: 4, use: 'look', color: 0x5d4128 }),
    F({ itemId: 'f_wardrobe', w: 2, h: 1, sprite: 'furn_wardrobe', layer: 'normal', color: 0x4e3622 }),
    F({ itemId: 'f_crate', w: 1, h: 1, sprite: 'furn_crate', layer: 'normal', surface: 1, color: 0xa07a45 }),
    F({ itemId: 'f_rug', w: 2, h: 2, sprite: 'furn_rug', layer: 'rug', color: 0x8c3a3a, accent: 0xc9a25a }),
    F({ itemId: 'f_plant', w: 1, h: 1, sprite: 'furn_plant', layer: 'normal', color: 0x3f8a3a, accent: 0x8a5a33 }),
    F({ itemId: 'f_lamp', w: 1, h: 1, sprite: 'furn_lamp', layer: 'normal', light: 3.5, color: 0xf5d76e }),
    F({ itemId: 'f_tv', w: 2, h: 1, sprite: 'furn_tv', layer: 'normal', use: 'look', color: 0x222222 }),
    F({ itemId: 'f_workbench', w: 2, h: 1, sprite: 'furn_workbench', layer: 'normal', use: 'work', station: 'workbench', surface: 2, color: 0x7a5a3a, accent: 0x777777 }),
    F({ itemId: 'f_stove', w: 1, h: 1, sprite: 'furn_stove', layer: 'normal', use: 'cook', station: 'stove', color: 0x555c66, accent: 0xff7a2a }),
    F({ itemId: 'f_medcab', w: 1, h: 1, sprite: 'furn_medcab', layer: 'normal', use: 'heal', station: 'medical', color: 0xe8e8e8, accent: 0xd03030 }),
    F({ itemId: 'f_rain', w: 1, h: 1, sprite: 'furn_rain', layer: 'normal', use: 'water', color: 0x3a6ea5, production: { output: 'dirty_water', minutes: 20, cap: 6, yieldPerCycle: 1 } }),
    F({ itemId: 'f_planter', w: 2, h: 1, sprite: 'furn_planter', layer: 'normal', use: 'farm', color: 0x6b4a2f, accent: 0x4caf50, production: { output: 'vegetable', minutes: 45, cap: 6, needsSeed: 'seeds', yieldPerCycle: 3 } }),
    F({ itemId: 'f_armchair', w: 1, h: 1, sprite: 'furn_armchair', layer: 'normal', use: 'sit', color: 0x7a3b3b, accent: 0x5a2828 }),
    F({ itemId: 'f_vanity', w: 2, h: 1, sprite: 'furn_vanity', layer: 'normal', surface: 3, use: 'look', color: 0xc9b79a, accent: 0x9fc3cc }),
    F({ itemId: 'f_aquarium', w: 2, h: 1, sprite: 'furn_aquarium', layer: 'normal', use: 'look', light: 2, color: 0x2d5f6b, accent: 0x6fc3cf }),
    F({ itemId: 'f_bookcase', w: 2, h: 1, sprite: 'furn_bookcase', layer: 'normal', surface: 5, use: 'look', color: 0x4a3220, accent: 0x8a3a3a }),
    F({ itemId: 'f_dresser', w: 1, h: 1, sprite: 'furn_dresser', layer: 'normal', surface: 2, color: 0x7a5a3a }),
    F({ itemId: 'f_sleeping_bag', w: 1, h: 2, sprite: 'furn_sleeping_bag', layer: 'normal', use: 'sleep', sleepQuality: 0.55, color: 0x3e5a3a, accent: 0x2c4029 }),
    F({ itemId: 'f_piano', w: 2, h: 1, sprite: 'furn_piano', layer: 'normal', use: 'sit', surface: 2, color: 0x1e1612, accent: 0xe8e2d0 }),
    F({ itemId: 'f_neon', w: 1, h: 1, sprite: 'furn_neon', layer: 'normal', light: 2.5, color: 0xe0407a, accent: 0x40d0e0 }),
    F({ itemId: 'f_barricade', w: 1, h: 1, sprite: 'furn_barricade', layer: 'normal', color: 0x8a6a3a, accent: 0xd6b23a }),
  ].map((d) => [d.itemId, d]),
);

export function furnitureDef(itemId: string): FurnitureDef | undefined {
  return FURNITURE[itemId];
}

/** 회전 반영한 점유 크기 */
export function footprint(itemId: string, rot: number): { w: number; h: number } {
  const d = FURNITURE[itemId];
  if (!d) return { w: 1, h: 1 };
  return rot % 2 === 0 ? { w: d.w, h: d.h } : { w: d.h, h: d.w };
}

// ───────────── 건축 (벽 / 바닥) ─────────────

export interface BuildDef {
  id: string;
  name: string;
  kind: 'wall' | 'floor' | 'door' | 'window';
  cost: { itemId: string; qty: number }[];
  color: number;
  accent?: number;
  sprite: string;
}

export const WALLS: BuildDef[] = [
  { id: 'wall_concrete', name: '콘크리트 벽', kind: 'wall', cost: [{ itemId: 'scrap', qty: 1 }, { itemId: 'plank', qty: 1 }], color: 0x6f7378, accent: 0x5a5e63, sprite: 'wall_concrete' },
  { id: 'wall_wood', name: '나무 벽', kind: 'wall', cost: [{ itemId: 'plank', qty: 2 }, { itemId: 'nails', qty: 2 }], color: 0x7b5634, accent: 0x5f4127, sprite: 'wall_wood' },
  { id: 'wall_paper_flower', name: '꽃무늬 벽지', kind: 'wall', cost: [{ itemId: 'wallpaper_roll', qty: 1 }], color: 0xd9b8b8, accent: 0xb07a8a, sprite: 'wall_paper_flower' },
  { id: 'wall_paper_stripe', name: '줄무늬 벽지', kind: 'wall', cost: [{ itemId: 'wallpaper_roll', qty: 1 }], color: 0xa8c0b0, accent: 0x7d9a88, sprite: 'wall_paper_stripe' },
  { id: 'door_wood', name: '나무 문', kind: 'door', cost: [{ itemId: 'plank', qty: 2 }, { itemId: 'nails', qty: 2 }], color: 0x9b6b3d, accent: 0xd8b04a, sprite: 'door_wood' },
  { id: 'window_wood', name: '창문', kind: 'window', cost: [{ itemId: 'plank', qty: 1 }, { itemId: 'nails', qty: 1 }], color: 0x7b5634, accent: 0x9fd3f0, sprite: 'window_wood' },
];

export const FLOORS: BuildDef[] = [
  { id: 'floor_wood', name: '나무 바닥', kind: 'floor', cost: [{ itemId: 'plank', qty: 1 }], color: 0xa77b4f, accent: 0x936a42, sprite: 'floor_wood' },
  { id: 'floor_tile', name: '타일 바닥', kind: 'floor', cost: [{ itemId: 'tile_pack', qty: 1 }], color: 0xcfd2d4, accent: 0xb3b7ba, sprite: 'floor_tile' },
  { id: 'floor_carpet', name: '카펫 바닥', kind: 'floor', cost: [{ itemId: 'cloth', qty: 2 }], color: 0x5a6e9a, accent: 0x4c5f86, sprite: 'floor_carpet' },
  { id: 'floor_concrete', name: '콘크리트 바닥', kind: 'floor', cost: [{ itemId: 'scrap', qty: 1 }], color: 0x8d8f91, accent: 0x7d7f81, sprite: 'floor_concrete' },
];

export const BUILD_BY_ID: Record<string, BuildDef> = Object.fromEntries(
  [...WALLS, ...FLOORS].map((b) => [b.id, b]),
);

export function isPassableWall(wallId: string): boolean {
  return wallId === '' || wallId.startsWith('door_');
}
