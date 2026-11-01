import { LOCATIONS, type LocationDef } from '../data/locations';
import { CITY, MAP_H, MAP_W, Tile } from './cityGen';

/** 물가: 지도에서 물 타일이 가까이(6칸 안) 있는 탐험지 */
let cache: Set<string> | null = null;

function build(): Set<string> {
  const out = new Set<string>();
  const R = 6;
  for (const l of LOCATIONS) {
    if (l.far) continue;
    const cx = Math.round(l.pos.x);
    const cy = Math.round(l.pos.y);
    let found = /항구|부두|어시장|낚시|선착장|수산|해변|강변|호수|저수지/.test(l.name + l.kind);
    for (let dy = -R; dy <= R && !found; dy++)
      for (let dx = -R; dx <= R && !found; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        const t = CITY.tiles[y * MAP_W + x];
        if (t === Tile.Water || t === Tile.DeepWater) found = true;
      }
    if (found) out.add(l.id);
  }
  return out;
}

export function isWaterside(loc: LocationDef | string | undefined): boolean {
  if (!loc) return false;
  cache ??= build();
  return cache.has(typeof loc === 'string' ? loc : loc.id);
}
