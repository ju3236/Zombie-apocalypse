import { makeClock } from './systems/clock';
import { LOCATION_BY_ID, LOCATIONS, type LocationDef } from './data/locations';
import { addItem, addStack } from './inventory';
import type { BaseState, GameState, LocationState, PlacedFurniture } from './types';
import { uid } from './util';
import { migrateBody } from './systems/body';

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

  // 시작은 방 한 칸짜리 낡은 오두막 (내부 4x3)
  const x0 = 12, x1 = 17, y0 = 8, y1 = 12;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (edge) walls[at(x, y)] = 'wall_wood';
      else floor[at(x, y)] = 'floor_wood';
    }
  walls[at(14, y1)] = 'door_wood';
  floor[at(14, y1)] = 'floor_wood';
  walls[at(15, y0)] = 'window_wood';

  const f = (itemId: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): PlacedFurniture => ({
    uid: uid('f'), itemId, x, y, rot, props: [],
  });
  const furniture: PlacedFurniture[] = [f('f_mattress', 13, 9), f('f_crate', 16, 11)];
  furniture[1].props.push('p_candle');

  return { width: W, height: H, floor, walls, furniture, claimed: { x0: 9, y0: 6, x1: 20, y1: 15 } };
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

  const w: GameState = {
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
    settings: { autoConsume: true, clockMode: 'real', raids: 'normal' },
    raid: null,
    weather: { kind: 'clear', until: 0 },
    clock: { anchorReal: 0, anchorGame: 0, scale: 1 },
  };
  // 실시간: 1일차, 지금 현실 시각에서 시작
  const d = new Date();
  w.time = d.getHours() * 60 + d.getMinutes();
  w.news[0].t = w.time;
  w.weather = { kind: 'clear', until: w.time + 180 };
  w.clock = makeClock(w);
  return w;
}

/**
 * 세이브를 현재 월드 데이터에 맞춘다.
 * 새로 생긴 장소/구역/수색 지점을 추가하고, 사라진 장소는 정리한다.
 */
export function syncWorld(s: GameState): void {
  // 실시간 시계 (예전 세이브는 현실 시계 모드로 옮긴다)
  s.settings.clockMode ??= 'real';
  s.settings.raids ??= 'normal';
  s.raid ??= null;
  s.weather ??= { kind: 'clear', until: s.time + 180 };
  if (!s.clock || !s.clock.scale) s.clock = makeClock(s);
  for (const e of Object.values(s.expeditions)) {
    e.mode ??= 'manual';
    e.phase ??= 'there';
    e.phaseEnds ??= 0;
    e.travelMs ??= 5 * 60000;
    e.vehicle ??= null;
  }
  for (const c of Object.values(s.characters)) migrateBody(c);
  for (const def of LOCATIONS) {
    if (def.temporary) continue;
    const ls = s.locations[def.id];
    if (!ls) {
      s.locations[def.id] = makeLocationState(def);
      continue;
    }
    if (def.startDiscovered) ls.discovered = true;
    const fresh = makeLocationState(def);
    for (const [zid, z] of Object.entries(fresh.zones)) {
      if (!ls.zones[zid]) ls.zones[zid] = z;
      else for (const [spid, sp] of Object.entries(z.spots)) ls.zones[zid].spots[spid] ??= sp;
    }
  }
  for (const id of Object.keys(s.locations)) {
    if (LOCATION_BY_ID[id]) continue;
    if (Object.values(s.expeditions).some((e) => e.locationId === id)) continue;
    delete s.locations[id];
  }
  // 없는 장소에서 진행 중인 탐험은 귀환 처리
  for (const [cid, e] of Object.entries(s.expeditions)) {
    if (LOCATION_BY_ID[e.locationId]) continue;
    const c = s.characters[cid];
    if (c) {
      for (const st of c.inventory) addStack(s.storage, st);
      c.inventory = [];
      c.status = 'base';
    }
    delete s.expeditions[cid];
  }
}
