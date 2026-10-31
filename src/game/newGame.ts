import { LOCATIONS, type LocationDef } from './data/locations';
import { addItem } from './inventory';
import type { BaseState, GameState, LocationState, PlacedFurniture } from './types';
import { uid } from './util';

export const BASE_W = 30;
export const BASE_H = 20;
export const GAME_VERSION = 1;

export function makeLocationState(def: LocationDef, discovered = def.startDiscovered): LocationState {
  const zones: LocationState['zones'] = {};
  for (const z of def.zones) {
    const spots: Record<string, { remaining: number; searched: number }> = {};
    for (const sp of z.spots) spots[sp.id] = { remaining: sp.capacity, searched: 0 };
    zones[z.id] = { unlocked: !z.locked && !z.secret, spots, secretFound: false };
  }
  return { discovered, visits: 0, zones, notes: [] };
}

function makeBase(): BaseState {
  const W = BASE_W;
  const H = BASE_H;
  const floor = new Array<string>(W * H).fill('');
  const walls = new Array<string>(W * H).fill('');
  const at = (x: number, y: number) => y * W + x;

  // 작은 단층집: x 5..18, y 3..12
  const x0 = 5, x1 = 18, y0 = 3, y1 = 12;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (edge) walls[at(x, y)] = 'wall_concrete';
      else floor[at(x, y)] = x < 12 ? 'floor_wood' : 'floor_concrete';
    }
  // 내부 벽
  for (let y = y0; y <= y1; y++) walls[at(12, y)] = 'wall_concrete';
  walls[at(12, 8)] = 'door_wood';
  floor[at(12, 8)] = 'floor_wood';
  // 현관
  walls[at(9, y1)] = 'door_wood';
  floor[at(9, y1)] = 'floor_wood';
  walls[at(15, y1)] = 'door_wood';
  floor[at(15, y1)] = 'floor_concrete';
  // 창문
  walls[at(8, y0)] = 'window_wood';
  walls[at(15, y0)] = 'window_wood';

  const f = (itemId: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): PlacedFurniture => ({
    uid: uid('f'), itemId, x, y, rot, props: [],
  });
  const furniture: PlacedFurniture[] = [
    f('f_mattress', 6, 4),
    f('f_mattress', 8, 4),
    f('f_mattress', 10, 4),
    f('f_rug', 7, 8),
    f('f_table', 14, 6),
    f('f_chair', 14, 7),
    f('f_chair', 15, 7),
    f('f_crate', 17, 11),
    f('f_crate', 16, 11),
  ];
  furniture[4].props.push('p_candle');

  return { width: W, height: H, floor, walls, furniture, claimed: { x0: 3, y0: 1, x1: 22, y1: 16 } };
}

export function createWorld(worldName: string, player: string): GameState {
  const storage: GameState['storage'] = [];
  const start: [string, number][] = [
    ['canned_beans', 8], ['canned_tuna', 3], ['water_bottle', 10], ['chips', 2], ['dirty_water', 3],
    ['bandage', 3], ['painkiller', 1], ['plank', 10], ['nails', 16], ['cloth', 4], ['scrap', 4], ['gas_can', 1],
    ['hammer', 1], ['bat', 1], ['kitchen_knife', 1], ['seeds', 2], ['lighter', 1],
    ['p_mug', 1], ['p_book', 1],
  ];
  for (const [id, q] of start) addItem(storage, id, q);

  const locations: GameState['locations'] = {};
  for (const l of LOCATIONS) if (!l.temporary) locations[l.id] = makeLocationState(l);

  return {
    version: GAME_VERSION,
    worldName,
    createdAt: Date.now(),
    lastRealTime: Date.now(),
    time: 8 * 60, // 1일차 08:00
    players: [player],
    characters: {},
    characterOrder: [],
    storage,
    base: makeBase(),
    locations,
    expeditions: {},
    rpLog: [],
    news: [{ t: 8 * 60, text: '이 집을 거점으로 삼기로 했다. 오늘부터 살아남는다.', kind: 'info' }],
    settings: { autoConsume: true },
  };
}
