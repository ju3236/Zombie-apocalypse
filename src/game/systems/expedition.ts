import { ITEMS, itemDef } from '../data/items';
import { LOCATION_BY_ID, type LocationDef, type ZoneDef } from '../data/locations';
import { addStack, countItem, hasTag, makeStack, removeItem, takeStack } from '../inventory';
import { addNews, store, withBase } from '../store';
import { bus } from '../bus';
import type { Character, Encounter, Expedition, ItemStack, Zombie } from '../types';
import { chance, clamp, fixJosa, pick, pickWeighted, rand, uid } from '../util';
import { addInjury, addXp, carriedWeight, carryCapacity, damage, level, consumeFrom } from './character';
import { clockTarget } from './clock';
import { bondUp } from './rp';
import { addEffect, effectMods } from './effects';
import { weatherOf } from './weather';
import { starterPos, travelBase } from '../world/cityGen';
import { PART_LABEL, protectionFor, randomHitPart, wearDamage } from './body';
import { addMemory, braveStep, noteDay, rollClue, traumatize } from './story';

type LogKind = 'good' | 'bad' | 'info' | undefined;

/** 자리를 비운 동안의 일을 따라잡을 때, 그 일이 실제로 일어난 시각(ms) */
let logAt: number | null = null;

function log(e: Expedition, text: string, kind?: LogKind) {
  const s = store.s;
  const t = logAt === null ? s.time : Math.min(s.time, Math.floor(clockTarget(s, logAt)));
  e.log.push({ t, text: fixJosa(text), kind });
  if (e.log.length > 120) e.log.splice(0, e.log.length - 120);
}

function charOf(e: Expedition): Character {
  return store.s.characters[e.characterId];
}

function zoneDef(e: Expedition): ZoneDef {
  return LOCATION_BY_ID[e.locationId].zones.find((z) => z.id === e.zoneId)!;
}

/**
 * 행동에 드는 수고. 시계는 실시간으로 흐르므로 행동이 시간을 넘기지 않고,
 * 대신 그만큼 기력·배고픔·목마름이 더 줄어든다. 캐릭터가 아직 탐험 중이면 true
 */
function passTime(e: Expedition, min: number): boolean {
  const c = charOf(e);
  const h = min / 60;
  c.energy = clamp(c.energy - 4 * h, 0, 100);
  c.hunger = clamp(c.hunger - 2 * h, 0, 100);
  c.thirst = clamp(c.thirst - 3 * h, 0, 100);
  return !!store.s.expeditions[e.characterId];
}

/** 현장에서 직접 탐사 중인 탐험만 (이동 중·장기 탐사 중에는 직접 행동 불가) */
function here(charId: string): Expedition | undefined {
  const e = store.s.expeditions[charId];
  return e && e.phase === 'there' && e.mode === 'manual' ? e : undefined;
}

// ───────────── 이동 시간 / 이동수단 ─────────────

/** 장기 탐사 한 번의 자동 수색 간격 (실제 시간) */
const AUTO_ROUND_MS = 15 * 60000;
export const AUTO_HOURS = [1, 3, 6, 12];

/** 편도 이동 시간(실제 분). 걸어서 3~27분 정도, 이동수단이면 그만큼 빨라진다 */
export function travelMinutes(loc: LocationDef, vehicleItemId?: string | null, from?: { x: number; y: number }): number {
  const speed = vehicleItemId ? (ITEMS[vehicleItemId]?.vehicle?.speed ?? 1) : 1;
  const base = loc.far ? loc.travel : from ? travelBase(from, loc.pos) : loc.travel;
  return Math.max(1, Math.round(base / 5 / speed));
}

/** 거점의 지도 위치 */
export function basePos(baseId: string | undefined): { x: number; y: number } {
  const b = baseId ? store.s.bases[baseId] : undefined;
  return starterPos(b?.starter ?? 0);
}

export function vehiclesIn(stacks: ItemStack[]): ItemStack[] {
  return stacks.filter((x) => ITEMS[x.itemId]?.vehicle);
}

function levelUpMsg(e: Expedition, msg: string | null) {
  if (msg) log(e, `⭐ ${msg}`, 'good');
}

export interface Loadout {
  weaponUid?: string;
  backpackUid?: string;
  items: { uid: string; qty: number }[];
}

export function canStart(c: Character, loc: LocationDef): string | null {
  return withBase(c.homeId, () => canStartAtHome(c, loc));
}

function canStartAtHome(c: Character, loc: LocationDef): string | null {
  const s = store.s;
  if (c.status === 'dead') return '이 캐릭터는 세상을 떠났다.';
  if (c.status === 'down') return '요양 중이라 움직일 수 없다.';
  if (c.status === 'expedition') return '이미 탐험 중이다.';
  if (c.status === 'moving') return '이사하는 중이다.';
  if (c.status === 'away') return '심부름 중이다.';
  if (c.crafting) return '제작 중이다. 먼저 제작을 그만두게 하자.';
  if (c.energy < 15) return '너무 지쳐서 나갈 수 없다. (기력 15 이상 필요)';
  if (c.health < 20) return '부상이 심하다. (체력 20 이상 필요)';
  const ls = s.locations[loc.id];
  if (!ls || !ls.discovered) return '아직 위치를 모른다.';
  if (loc.requires && countItem(s.storage, loc.requires.itemId) + countItem(c.inventory, loc.requires.itemId) === 0)
    return loc.requires.text;
  return null;
}

export interface ExpeditionOptions {
  mode: 'manual' | 'auto';
  /** 장기 탐사: 현장에 머무를 시간 */
  hours?: number;
  vehicleUid?: string;
  /** 파티로 같이 갈 때: 앞장선 사람과 같은 이동 시간 */
  travelMs?: number;
}

/** 이동수단 연료 확인 (휘발유) */
export function fuelProblem(c: Character, vehicleItemId: string | null | undefined, loc?: LocationDef): string | null {
  return withBase(c.homeId, () => fuelProblemAtHome(c, vehicleItemId, loc));
}

/** 이동수단이 드는 휘발유 (먼 원정지는 두 배) */
export const fuelNeed = (vehicleItemId: string | null | undefined, loc?: LocationDef) =>
  (vehicleItemId ? (ITEMS[vehicleItemId]?.vehicle?.fuel ?? 0) : 0) * (loc?.far ? 2 : 1);

/** 먼 원정지에 갈 수 있는 이동수단인지 */
export const farCapable = (vehicleItemId: string | null | undefined) => (vehicleItemId ? (ITEMS[vehicleItemId]?.vehicle?.speed ?? 0) >= 3 : false);

function fuelProblemAtHome(c: Character, vehicleItemId: string | null | undefined, loc?: LocationDef): string | null {
  const need = fuelNeed(vehicleItemId, loc);
  if (!need) return null;
  const have = countItem(store.s.storage, 'gasoline') + countItem(c.inventory, 'gasoline');
  return have >= need ? null : `${ITEMS[vehicleItemId!].name}을(를) 타려면 휘발유 ${need}통이 필요하다.`;
}

export function startExpedition(charId: string, locId: string, loadout: Loadout, opts: ExpeditionOptions = { mode: 'manual' }): string | null {
  return withBase(store.s.characters[charId]?.homeId, () => startExpeditionAtHome(charId, locId, loadout, opts));
}

function startExpeditionAtHome(charId: string, locId: string, loadout: Loadout, opts: ExpeditionOptions = { mode: 'manual' }): string | null {
  const s = store.s;
  const c = s.characters[charId];
  const loc = LOCATION_BY_ID[locId];
  const err = canStart(c, loc);
  if (err) return err;
  const vehicleSt = opts.vehicleUid ? s.storage.find((x) => x.uid === opts.vehicleUid && ITEMS[x.itemId].vehicle) : undefined;
  if (loc.far && !opts.travelMs && !farCapable(vehicleSt?.itemId)) return '먼 원정지는 스쿠터나 자동차가 있어야 갈 수 있다.';
  const fuelErr = fuelProblem(c, vehicleSt?.itemId, loc);
  if (fuelErr) return fuelErr;

  // 장비 지급 (창고 → 캐릭터)
  if (loadout.weaponUid && loadout.weaponUid !== c.weapon?.uid) {
    const st = takeStack(s.storage, loadout.weaponUid, 1);
    if (st) {
      if (c.weapon) addStack(s.storage, c.weapon);
      c.weapon = st;
    }
  }
  if (loadout.backpackUid && loadout.backpackUid !== c.backpack?.uid) {
    const st = takeStack(s.storage, loadout.backpackUid, 1);
    if (st) {
      if (c.backpack) addStack(s.storage, c.backpack);
      c.backpack = st;
    }
  }
  for (const it of loadout.items) {
    const st = takeStack(s.storage, it.uid, it.qty);
    if (st) addStack(c.inventory, st);
  }
  // 이동수단과 연료
  const vehicle = vehicleSt ? takeStack(s.storage, vehicleSt.uid, 1) : null;
  const fuel = vehicle ? fuelNeed(vehicle.itemId, loc) : 0;
  if (fuel && !removeItem(s.storage, 'gasoline', fuel)) removeItem(c.inventory, 'gasoline', fuel);

  const ls = s.locations[locId];
  ls.visits++;
  c.status = 'expedition';
  c.stats.expeditions++;
  const firstZone = loc.zones.find((z) => ls.zones[z.id]?.unlocked) ?? loc.zones[0];
  const now = Date.now();
  const travelMs = opts.travelMs ?? Math.round(travelMinutes(loc, vehicle?.itemId, basePos(c.homeId)) * weatherOf(s).travel) * 60000;
  const e: Expedition = {
    characterId: c.id,
    locationId: locId,
    zoneId: firstZone.id,
    noise: 0,
    encounter: null,
    found: null,
    log: [],
    startedAt: s.time,
    mode: opts.mode,
    phase: 'going',
    phaseEnds: now + travelMs,
    travelMs,
    vehicle,
    autoHours: opts.mode === 'auto' ? (opts.hours ?? 3) : undefined,
  };
  s.expeditions[c.id] = e;
  if (loc.requires) log(e, `${itemDef(loc.requires.itemId).name}로 보안문을 열었다.`, 'info');
  const how = vehicle ? `${ITEMS[vehicle.itemId].icon} ${ITEMS[vehicle.itemId].name}을(를) 타고` : '걸어서';
  log(e, `${c.name}이(가) ${how} ${loc.name}(으)로 출발했다. (도착까지 ${Math.round(travelMs / 60000)}분)`);
  addNews(`${c.name}이(가) ${loc.name}${opts.mode === 'auto' ? `(으)로 ${e.autoHours}시간 장기 탐사를` : ' 탐험을'} 떠났다.`);
  store.commit();
  return null;
}

/** 방금 일어난 일이면 알림 (자리를 비운 동안의 일을 한꺼번에 따라잡을 때는 조용히) */
function alertFor(e: Expedition, title: string, text: string, kind: 'good' | 'bad' | 'info') {
  if (logAt !== null && Date.now() - logAt > 120000) return;
  bus.emit('alert', { characterId: e.characterId, title, text, kind });
}

/** 도착 */
function arrive(e: Expedition, at: number) {
  const loc = LOCATION_BY_ID[e.locationId];
  const z = zoneDef(e);
  e.phase = 'there';
  log(e, `${loc.name}에 도착했다. ${loc.desc}`, 'info');
  log(e, `[${z.name}] ${z.desc}`);
  // 시끄러운 이동수단은 좀비를 끌어들인다
  const vn = e.vehicle ? (ITEMS[e.vehicle.itemId].vehicle?.noise ?? 0) : 0;
  if (vn) {
    addNoise(e, vn);
    log(e, '엔진 소리가 주변에 울려 퍼졌다…', 'bad');
  }
  if (e.mode === 'auto') {
    e.phaseEnds = at + (e.autoHours ?? 3) * 3600000;
    e.autoNext = at + 60000;
    log(e, `${e.autoHours}시간 동안 둘러보고 돌아갈 생각이다.`);
  }
  if (!bossCheck(e)) rollEncounter(e, 0.6);
  if (e.mode === 'auto' && e.encounter) autoFight(e);
  if (e.mode === 'manual') alertFor(e, `📍 ${charOf(e).name} 도착`, `${loc.name}에 도착했다.${e.encounter ? ' 근처에 좀비가 있다!' : ''}`, e.encounter ? 'bad' : 'info');
}

/** 돌아가기 시작 */
function startReturn(e: Expedition, at: number) {
  if (e.phase === 'returning') return;
  // 가는 길이었다면 온 만큼만 되돌아간다
  const back = e.phase === 'going' ? Math.max(0, e.travelMs - (e.phaseEnds - at)) : e.travelMs;
  e.phase = 'returning';
  e.phaseEnds = at + back;
  e.encounter = null;
  e.found = null;
  log(e, `거점으로 돌아가는 길에 올랐다. (도착까지 ${Math.max(1, Math.round(back / 60000))}분)`);
}

/** 귀환 완료: 짐을 창고에 정리 */
function finishReturn(e: Expedition) {
  const s = store.s;
  const c = charOf(e);
  const loc = LOCATION_BY_ID[e.locationId];
  const items = c.inventory.reduce((n, x) => n + x.qty, 0);
  for (const st of c.inventory) addStack(s.storage, st);
  c.inventory = [];
  if (e.vehicle) addStack(s.storage, e.vehicle);
  c.status = 'base';
  delete s.expeditions[e.characterId];
  addNews(`${c.name}이(가) ${loc.name}에서 무사히 귀환했다. (물품 ${items}개 창고에 정리)`, 'good');
  noteDay(c, `${loc.name}에 다녀왔다.${items ? ` 물건 ${items}개를 챙겨 왔다.` : ''}`);
  alertFor(e, `🏠 ${c.name} 귀환`, `${loc.name}에서 돌아왔다. 물품 ${items}개`, 'good');
  // 같은 곳에 함께 다녀온 파티원과 정이 든다
  for (const m of partyMates(e.characterId)) {
    const me = s.expeditions[m.id];
    if (!me || me.locationId === e.locationId) bondUp(e.characterId, m.id, 3, 'expedition', 120);
  }
  if (logAt !== null) s.news[0].t = Math.min(s.time, Math.floor(clockTarget(s, logAt)));
}

/** 실시간 진행: 이동 끝, 장기 탐사 자동 수색, 귀환. 자리를 비운 동안의 몫도 한 번에 처리한다 */
export function processExpedition(charId: string, now = Date.now()): boolean {
  return withBase(store.s.characters[charId]?.homeId, () => processExpeditionAtHome(charId, now));
}

function processExpeditionAtHome(charId: string, now = Date.now()): boolean {
  const s = store.s;
  let changed = false;
  for (let guard = 0; guard < 200; guard++) {
    const e = s.expeditions[charId];
    if (!e) break;
    if (e.phase === 'going' && now >= e.phaseEnds) {
      logAt = e.phaseEnds;
      arrive(e, e.phaseEnds);
    } else if (e.phase === 'there' && e.mode === 'auto') {
      const next = e.autoNext ?? now;
      if (next <= Math.min(now, e.phaseEnds)) {
        e.autoNext = next + AUTO_ROUND_MS;
        logAt = next;
        autoRound(e, next);
      } else if (now >= e.phaseEnds) {
        logAt = e.phaseEnds;
        startReturn(e, e.phaseEnds);
      } else break;
    } else if (e.phase === 'returning' && now >= e.phaseEnds) {
      logAt = e.phaseEnds;
      finishReturn(e);
    } else break;
    logAt = null;
    changed = true;
  }
  logAt = null;
  return changed;
}

/** 장기 탐사 중 불러들이기 / 가는 길에 돌아오기 */
export function recall(charId: string): void {
  return withBase(store.s.characters[charId]?.homeId, () => recallAtHome(charId));
}

function recallAtHome(charId: string): void {
  const e = store.s.expeditions[charId];
  if (!e || e.phase === 'returning' || e.encounter?.engaged) return;
  log(e, '돌아오라는 무전을 받았다.', 'info');
  const now = Date.now();
  startReturn(e, now);
  // 같이 간 파티원도
  for (const m of partyMates(charId)) {
    const me = store.s.expeditions[m.id];
    if (me && me.locationId === e.locationId && me.phase !== 'returning' && !me.encounter?.engaged) startReturn(me, now);
  }
  store.commit();
}

// ───────────── 조우 ─────────────

function effectiveDanger(e: Expedition): number {
  const loc = LOCATION_BY_ID[e.locationId];
  return loc.danger + (zoneDef(e).danger ?? 0);
}

function makeZombie(danger: number, kind?: Zombie['kind']): Zombie {
  const r = Math.random();
  if (!kind) {
    kind = 'walker';
    if (danger >= 4 && r < 0.06) kind = 'brute';
    else if (danger >= 4 && r < 0.14) kind = 'screamer';
    else if (danger >= 3 && r < 0.3) kind = 'runner';
    else if (r > 0.9) kind = 'bloated';
  }
  const hp = kind === 'brute' ? rand(9, 12) : kind === 'screamer' ? 2 : kind === 'bloated' ? rand(4, 5) : kind === 'runner' ? rand(2, 3) : rand(2, 4);
  return { id: uid('z'), hp, maxHp: hp, kind, staggered: false };
}

export const ZOMBIE_NAME: Record<Zombie['kind'], string> = { walker: '배회자', runner: '달리는 감염자', bloated: '부푼 감염자', brute: '거구 감염자', screamer: '비명꾼' };
export const ZOMBIE_ICON: Record<Zombie['kind'], string> = { walker: '🧟', runner: '🏃', bloated: '🧟‍♂️', brute: '👹', screamer: '😱' };

/** 우두머리가 있는 구역에 처음 들어서면 */
function bossCheck(e: Expedition): boolean {
  const z = zoneDef(e);
  const zs = store.s.locations[e.locationId]?.zones[z.id];
  if (!z.boss || !zs || zs.bossDown || e.encounter) return false;
  const d = effectiveDanger(e);
  e.encounter = { zombies: [makeZombie(d, 'brute'), makeZombie(d), makeZombie(d)], engaged: chance(0.5) };
  log(e, `👹 거대한 그림자가 앞을 막아선다. [${z.name}]의 주인, 거구 감염자다!`, 'bad');
  alertFor(e, `👹 ${charOf(e).name}`, `${LOCATION_BY_ID[e.locationId].name}에서 거구 감염자를 만났다!`, 'bad');
  return true;
}

/** 오염 구역에서 한 번 행동할 때: 방독면이 있으면 필터가 닳고, 없으면 다친다 */
function toxicTick(e: Expedition) {
  if (!zoneDef(e).toxic) return;
  const c = charOf(e);
  const mask = c.inventory.find((x) => x.itemId === 'gas_mask');
  if (mask) {
    mask.durability = (mask.durability ?? ITEMS.gas_mask.durability ?? 12) - 1;
    if (mask.durability <= 0) {
      c.inventory = c.inventory.filter((x) => x !== mask);
      log(e, '😷 방독면 필터가 다 됐다! 숨쉬기가 힘들어진다.', 'bad');
    }
    return;
  }
  c.infection = clamp(c.infection + 4, 0, 100);
  log(e, '☣️ 독한 공기에 콜록거렸다. (감염 +4, 체력 -3)', 'bad');
  damage(c, 3);
}

/** 두려운 장소에서 무언가 해냈을 때 */
function brave(e: Expedition) {
  const msg = braveStep(charOf(e), e.locationId);
  if (msg) log(e, msg, 'good');
}

function rollEncounter(e: Expedition, mult = 1): boolean {
  if (e.encounter) return false;
  const d = effectiveDanger(e);
  const p = clamp((0.04 * d + e.noise * 0.004) * mult * weatherOf(store.s).encounter, 0, 0.8);
  if (!chance(p)) return false;
  const n = clamp(1 + rand(0, Math.floor(d / 2)) + Math.floor(e.noise / 35), 1, 7);
  const zs: Zombie[] = Array.from({ length: n }, () => makeZombie(d));
  const enc: Encounter = { zombies: zs, engaged: chance(0.25 + e.noise * 0.005) };
  e.encounter = enc;
  log(
    e,
    enc.engaged
      ? `⚠️ 좀비 ${n}마리가 이쪽으로 달려든다!`
      : `👀 좀비 ${n}마리가 근처를 배회하고 있다. 아직 들키지 않았다.`,
    'bad',
  );
  return true;
}

function addNoise(e: Expedition, n: number) {
  e.noise = clamp(e.noise + n, 0, 100);
}

// ───────────── 이동 / 잠금 ─────────────

export function moveZone(charId: string, zoneId: string): void {
  const s = store.s;
  const e = here(charId);
  if (!e || e.encounter?.engaged) return;
  const loc = LOCATION_BY_ID[e.locationId];
  const z = loc.zones.find((x) => x.id === zoneId);
  const zs = s.locations[e.locationId].zones[zoneId];
  if (!z || !zs?.unlocked) return;
  e.encounter = null; // 들키지 않은 좀비는 따돌린다
  e.found = null;
  e.zoneId = zoneId;
  e.noise = clamp(e.noise - 6, 0, 100);
  log(e, `[${z.name}](으)로 이동했다. ${z.desc}`);
  if (z.toxic) log(e, '☣️ 오염 구역이다. 매캐한 냄새가 코를 찌른다.', 'bad');
  if (!passTime(e, 10)) return store.commit();
  if (!bossCheck(e)) rollEncounter(e, 0.8);
  store.commit();
}

export function unlockZone(charId: string, zoneId: string, method: 'pry' | 'lockpick' | 'key'): void {
  const s = store.s;
  const e = here(charId);
  if (!e || e.encounter) return;
  const c = charOf(e);
  const loc = LOCATION_BY_ID[e.locationId];
  const z = loc.zones.find((x) => x.id === zoneId);
  const zs = s.locations[e.locationId].zones[zoneId];
  if (!z?.locked || !zs || zs.unlocked) return;
  const gear = [...c.inventory, ...(c.weapon ? [c.weapon] : [])];

  if (method === 'pry') {
    if (!z.locked.pry || !hasTag(gear, 'pry')) return;
    const tool = c.weapon && ITEMS[c.weapon.itemId].tags?.includes('pry') ? c.weapon : gear.find((g) => ITEMS[g.itemId].tags?.includes('pry'));
    if (tool?.durability !== undefined) tool.durability = Math.max(1, tool.durability - 3);
    zs.unlocked = true;
    addNoise(e, 25);
    log(e, `쇠지렛대로 [${z.name}]의 문을 억지로 열었다. 쾅! 소리가 크게 울렸다.`, 'info');
    addXp(c, 'melee', 3);
    if (!passTime(e, 10)) return store.commit();
    rollEncounter(e, 1.3);
  } else if (method === 'lockpick') {
    if (!z.locked.lockpick || countItem(c.inventory, 'lockpick') === 0) return;
    const p = clamp(0.45 + level(c, 'stealth') * 0.05 + level(c, 'crafting') * 0.03, 0.1, 0.95);
    if (!passTime(e, 15)) return store.commit();
    addNoise(e, 2);
    if (chance(p)) {
      zs.unlocked = true;
      log(e, `조용히 자물쇠를 땄다. [${z.name}]에 들어갈 수 있다.`, 'good');
      levelUpMsg(e, addXp(c, 'stealth', 8));
    } else if (chance(0.5)) {
      removeItem(c.inventory, 'lockpick', 1);
      log(e, '자물쇠 따개가 부러졌다…', 'bad');
    } else {
      log(e, '자물쇠가 꿈쩍도 않는다. 다시 시도할 수 있다.');
    }
    rollEncounter(e, 0.5);
  } else {
    const key = z.locked.key;
    if (!key || countItem(c.inventory, key) === 0) return;
    zs.unlocked = true;
    log(e, `${itemDef(key).name}로 [${z.name}]을(를) 열었다.`, 'good');
  }
  store.commit();
}

// ───────────── 수색 ─────────────

export function search(charId: string, spotId: string, mode: 'careful' | 'quick'): void {
  const s = store.s;
  const e = here(charId);
  if (!e || e.encounter || e.found) return;
  const c = charOf(e);
  const z = zoneDef(e);
  const sp = z.spots.find((x) => x.id === spotId);
  const ls = s.locations[e.locationId];
  const st = ls.zones[z.id].spots[spotId];
  if (!sp || !st) return;

  const careful = mode === 'careful';
  const minutes = careful ? 30 : 10;
  addNoise(e, careful ? 2 : 9);
  st.searched++;
  if (!passTime(e, minutes)) return store.commit();

  const found: ItemStack[] = [];
  if (st.remaining <= 0) {
    log(e, `[${sp.name}]은(는) 이미 탈탈 털렸다. 아무것도 없다.`);
  } else {
    st.remaining--;
    const { found: got, missed } = rollLoot(c, sp, careful);
    found.push(...got);
    if (missed) log(e, `너무 어두워서 무언가를 놓친 것 같다… (손전등이 있으면 좋겠다)`);
    levelUpMsg(e, addXp(c, 'scavenge', careful ? 6 : 4));
    if (found.length) {
      log(e, `[${sp.name}] 수색: ${found.map((f) => `${ITEMS[f.itemId].icon}${ITEMS[f.itemId].name}${f.qty > 1 ? ` x${f.qty}` : ''}`).join(', ')}`, 'good');
      e.found = { spotId, items: found };
    } else {
      log(e, `[${sp.name}]에서 쓸 만한 것을 찾지 못했다.`);
    }
    if (st.remaining === 0) log(e, `[${sp.name}]은(는) 이제 텅 비었다.`);
    if (found.length) brave(e);
  }
  const clue = rollClue(c, e.locationId, careful ? 0.1 : 0.06);
  if (clue) log(e, clue, 'good');
  toxicTick(e);
  if (!store.s.expeditions[charId]) return store.commit();

  // 숨겨진 공간 발견
  const loc = LOCATION_BY_ID[e.locationId];
  for (const sz of loc.zones) {
    if (sz.secret?.from === z.id && !ls.zones[sz.id].secretFound) {
      const allEmpty = z.spots.every((x) => ls.zones[z.id].spots[x.id].remaining <= 0);
      const p = careful ? 0.12 + level(c, 'scavenge') * 0.03 : 0.04;
      if (allEmpty || chance(p)) {
        ls.zones[sz.id].secretFound = true;
        ls.zones[sz.id].unlocked = true;
        log(e, `🔍 ${sz.secret.text} [${sz.name}]`, 'good');
        ls.notes.push(`${sz.name} 발견`);
        levelUpMsg(e, addXp(c, 'scavenge', 15));
      }
    }
  }

  // 수색 중 사건
  if (!rollEvent(e, careful)) rollEncounter(e);
  store.commit();
}

function rollEvent(e: Expedition, careful: boolean): boolean {
  if (!chance(careful ? 0.08 : 0.16)) return false;
  const c = charOf(e);
  const ev = pick(['glass', 'fall', 'note', 'stash', 'rat'] as const);
  switch (ev) {
    case 'glass':
      if (careful && chance(0.5)) {
        log(e, '깨진 유리 조각을 미리 발견하고 피했다.');
        return true;
      }
      addInjury(c, 'scratch', chance(0.5) ? 'l_hand' : 'r_hand');
      damage(c, 4);
      log(e, '🩸 깨진 유리에 손을 베였다. (긁힘)', 'bad');
      return true;
    case 'fall':
      addNoise(e, 18);
      log(e, '💥 선반 위 물건이 와르르 떨어졌다! 소음이 퍼진다.', 'bad');
      rollEncounter(e, 1.5);
      return true;
    case 'note': {
      const notes = [
        '벽에 쓰인 메모: "학교 체육관에 사람들이 모여 있었다… 이제는 아무도 없다."',
        '버려진 일기: "병원 원장실 금고에 무언가 중요한 게 있다고 들었다."',
        '찢어진 전단지: "외곽 연구소 — 관계자 외 출입 금지"',
        '아이의 그림: 가족 네 명이 손을 잡고 웃고 있다.',
        '무전기 메모: "북쪽 다리 건너 생존자 캠프… 응답 바람"',
      ];
      const n = pick(notes);
      log(e, `📝 ${n}`, 'info');
      store.s.locations[e.locationId].notes.push(n);
      return true;
    }
    case 'stash': {
      const st = makeStack(pick(['chocolate', 'water_bottle', 'bandage', 'battery', 'duct_tape']));
      const items = e.found ? e.found.items : [];
      items.push(st);
      e.found = { spotId: e.found?.spotId ?? '', items };
      log(e, `🎁 누군가 숨겨둔 ${ITEMS[st.itemId].name}을(를) 발견했다!`, 'good');
      return true;
    }
    case 'rat':
      log(e, '쥐 한 마리가 발밑을 스쳐 지나갔다. 심장이 철렁했다.');
      c.energy = clamp(c.energy - 3, 0, 100);
      return true;
  }
}

/** 발견한 물건 가져가기 */
export function takeFound(charId: string, stackUids: string[] | 'all'): string | null {
  const e = here(charId);
  if (!e?.found) return null;
  const c = charOf(e);
  const cap = carryCapacity(c);
  const list = stackUids === 'all' ? [...e.found.items] : e.found.items.filter((i) => stackUids.includes(i.uid));
  let err: string | null = null;
  for (const st of list) {
    const w = ITEMS[st.itemId].weight * st.qty;
    if (carriedWeight(c) + w > cap + 0.001) {
      err = `너무 무겁다! (${ITEMS[st.itemId].name}) 가방에 더 넣을 수 없다.`;
      continue;
    }
    addStack(c.inventory, st);
    e.found.items = e.found.items.filter((x) => x.uid !== st.uid);
    if (st.itemId === 'area_map') revealMap(e);
  }
  if (e.found.items.length === 0) e.found = null;
  store.commit();
  return err;
}

export function leaveFound(charId: string): void {
  const e = here(charId);
  if (!e) return;
  e.found = null;
  store.commit();
}

export function dropItem(charId: string, stackUid: string): void {
  const e = here(charId);
  if (!e) return;
  const c = charOf(e);
  const st = takeStack(c.inventory, stackUid);
  if (st) log(e, `${ITEMS[st.itemId].name}을(를) 버렸다.`);
  store.commit();
}

function revealMap(e: Expedition) {
  const s = store.s;
  const hidden = Object.entries(s.locations).filter(([, l]) => !l.discovered);
  if (!hidden.length) {
    log(e, '🗺️ 지도에는 이미 아는 곳들만 표시되어 있다.');
    return;
  }
  const [id, l] = pick(hidden);
  l.discovered = true;
  log(e, `🗺️ 지도를 살펴보니 [${LOCATION_BY_ID[id].name}]의 위치가 표시되어 있다! 월드맵에 추가되었다.`, 'good');
  addNews(`새로운 탐험지 발견: ${LOCATION_BY_ID[id].name}`, 'good');
}

// ───────────── 전투 ─────────────

function weaponStats(c: Character) {
  const w = c.weapon ? ITEMS[c.weapon.itemId].weapon : undefined;
  return w ?? { damage: [1, 1] as [number, number], acc: -0.1, noise: 1, wear: 0, skill: 'melee' as const, push: 0 };
}

function doAttack(e: Expedition, zombieId: string): void {
  if (!e.encounter) return;
  const c = charOf(e);
  const enc = e.encounter;
  const z = enc.zombies.find((x) => x.id === zombieId) ?? enc.zombies[0];
  if (!z) return;
  const w = weaponStats(c);
  const ambush = !enc.engaged;
  enc.engaged = true;

  if (w.ammo) {
    if (!removeItem(c.inventory, w.ammo, 1)) {
      log(e, '찰칵… 탄이 없다! 다른 방법을 찾아야 한다.', 'bad');
      zombieTurn(e);
      return;
    }
  }
  const lvl = level(c, w.skill);
  const cond = c.weapon && c.weapon.durability !== undefined ? c.weapon.durability / (ITEMS[c.weapon.itemId].durability ?? 1) : 1;
  const hitP = ambush ? 0.95 : clamp(0.55 + lvl * 0.04 + w.acc + effectMods(c, store.s).hit - (cond < 0.2 ? 0.08 : 0), 0.15, 0.95);
  addNoise(e, w.noise);
  c.energy = clamp(c.energy - (c.weapon ? ITEMS[c.weapon.itemId].weight : 0.5) * 0.8, 0, 100);

  if (chance(hitP)) {
    const dmg = rand(w.damage[0], w.damage[1]) + (z.staggered ? 1 : 0) + (ambush ? 1 : 0) + (lvl >= 5 ? 1 : 0);
    z.hp -= dmg;
    if (z.hp <= 0) {
      enc.zombies = enc.zombies.filter((x) => x.id !== z.id);
      c.stats.kills++;
      log(e, `${ambush ? '기습! ' : ''}${ZOMBIE_NAME[z.kind]}을(를) 쓰러뜨렸다.`, 'good');
      levelUpMsg(e, addXp(c, w.skill, z.kind === 'brute' ? 25 : 8));
      if (z.kind === 'brute') bruteDown(e);
      brave(e);
    } else {
      log(e, `${ZOMBIE_NAME[z.kind]}에게 일격을 가했다. (${z.hp}/${z.maxHp})`);
      levelUpMsg(e, addXp(c, w.skill, 3));
    }
  } else {
    log(e, '빗나갔다!', 'bad');
    addXp(c, w.skill, 1);
  }

  // 무기 내구도
  if (c.weapon && c.weapon.durability !== undefined && w.wear) {
    c.weapon.durability -= w.wear;
    if (c.weapon.durability <= 0) {
      log(e, `💔 ${ITEMS[c.weapon.itemId].name}이(가) 부서졌다!`, 'bad');
      c.weapon = null;
    }
  }

  if (enc.zombies.length === 0) {
    e.encounter = null;
    log(e, '주변이 다시 조용해졌다.', 'good');
    passTime(e, 5);
    return 
  }
  zombieTurn(e);
  
}

function bruteDown(e: Expedition) {
  const s = store.s;
  const c = charOf(e);
  const loc = LOCATION_BY_ID[e.locationId];
  const zs = s.locations[e.locationId]?.zones[e.zoneId];
  if (zoneDef(e).boss && zs) zs.bossDown = true;
  addMemory(c, 'joy', `${loc.name}에서 거구 감염자를 쓰러뜨렸다`, loc.id);
  noteDay(c, `${loc.name}에서 거구 감염자를 쓰러뜨렸다. 아직도 손이 떨린다.`);
  const home = s.bases[c.homeId];
  if (home) home.rep = (home.rep ?? 0) + 2;
  addNews(`👹 ${c.name}이(가) ${loc.name}에서 거구 감염자를 쓰러뜨렸다!`, 'good', `👹 ${c.name}의 무용담`);
  // 거구가 지키던 물건
  const loot = makeStack(pick(['ammo_9mm', 'first_aid', 'antibiotics', 'gasoline', 'hiking_pack']), 1);
  addStack(c.inventory, loot);
  log(e, `거구가 쓰러진 자리에서 ${ITEMS[loot.itemId].icon}${ITEMS[loot.itemId].name}을(를) 주웠다.`, 'good');
}

export function shove(charId: string, zombieId: string): void {
  const e = here(charId);
  if (!e?.encounter) return;
  const c = charOf(e);
  const z = e.encounter.zombies.find((x) => x.id === zombieId) ?? e.encounter.zombies[0];
  e.encounter.engaged = true;
  const w = weaponStats(c);
  c.energy = clamp(c.energy - 1, 0, 100);
  const p = clamp(0.6 + (w.push ?? 0) + level(c, 'melee') * 0.03 - (z.kind === 'bloated' ? 0.25 : z.kind === 'brute' ? 0.45 : 0), 0.1, 0.95);
  if (chance(p)) {
    z.staggered = true;
    log(e, `${ZOMBIE_NAME[z.kind]}을(를) 밀쳐 넘어뜨렸다!`);
    addXp(c, 'melee', 2);
  } else {
    log(e, '밀쳐내지 못했다!', 'bad');
  }
  zombieTurn(e, z.staggered ? z.id : undefined);
  store.commit();
}

/** 좀비 반격 */
function zombieTurn(e: Expedition, skipId?: string) {
  const leader = charOf(e);
  const enc = e.encounter;
  if (!enc) return;
  // 파티원 엄호 사격·타격
  for (const mate of partyHere(e)) {
    const mc = charOf(mate);
    if (!e.encounter || !e.encounter.zombies.length) break;
    if (!chance(0.6)) continue;
    const z = pick(e.encounter.zombies);
    const w = weaponStats(mc);
    if (w.ammo && !removeItem(mc.inventory, w.ammo, 1)) continue;
    const dmg = rand(w.damage[0], w.damage[1]);
    z.hp -= dmg;
    addXp(mc, w.skill, 3);
    if (z.hp <= 0) {
      e.encounter.zombies = e.encounter.zombies.filter((x) => x.id !== z.id);
      mc.stats.kills++;
      log(e, `🤝 ${mc.name}이(가) 엄호하며 ${ZOMBIE_NAME[z.kind]}을(를) 쓰러뜨렸다!`, 'good');
      log(mate, `🤝 ${leader.name}을(를) 엄호하며 ${ZOMBIE_NAME[z.kind]}을(를) 쓰러뜨렸다.`, 'good');
      bondUp(leader.id, mc.id, 2, 'cover', 30);
    } else log(e, `🤝 ${mc.name}이(가) 엄호했다. (${ZOMBIE_NAME[z.kind]} ${z.hp}/${z.maxHp})`);
  }
  if (!e.encounter?.zombies.length) {
    e.encounter = null;
    log(e, '파티와 함께 주변을 정리했다.', 'good');
    return;
  }
  const n = enc.zombies.length;
  for (const z of enc.zombies) {
    if (z.staggered) {
      if (z.id !== skipId) z.staggered = false;
      continue;
    }
    // 비명꾼은 공격 대신 비명을 질러 다른 좀비를 부른다
    if (z.kind === 'screamer') {
      addNoise(e, 10);
      if (chance(0.35) && enc.zombies.length < 8) {
        enc.zombies.push(makeZombie(effectiveDanger(e)));
        log(e, '😱 비명꾼이 찢어지는 비명을 질렀다! 좀비가 몰려온다.', 'bad');
      } else log(e, '😱 비명꾼이 비명을 질렀다…', 'bad');
      continue;
    }
    // 같은 곳에 파티원이 있으면 좀비는 아무나 노린다 (그만큼 공격이 분산된다)
    const crew = [leader, ...partyHere(e).map((x) => charOf(x))].filter((x) => store.s.expeditions[x.id]);
    const c = pick(crew.length ? crew : [leader]);
    const who = c.id === leader.id ? '' : `${c.name}: `;
    const p = (0.2 + (z.kind === 'runner' ? 0.12 : z.kind === 'brute' ? 0.12 : 0) + 0.04 * (n - 1)) * (crew.length > 1 ? 0.85 : 1);
    if (!chance(p)) continue;
    // 맞은 부위와 그 부위의 옷
    const part = randomHitPart();
    const prot = protectionFor(c, part);
    if (prot.stack && chance(prot.protect)) {
      log(e, `🛡️ ${who}${ZOMBIE_NAME[z.kind]}이(가) ${PART_LABEL[part]}을(를) 노렸지만 ${ITEMS[prot.stack.itemId].name}이(가) 막아냈다.`, 'info');
      const torn = wearDamage(c, prot.slot, 2);
      if (torn) log(e, torn, 'bad');
      continue;
    }
    const r = Math.random();
    // 옷이 있으면 물림이 할큄으로 바뀌기 쉽다
    const biteP = 0.1 * (1 - prot.protect * 1.5);
    const type = r < biteP ? 'bite' : r < biteP + 0.3 ? 'laceration' : 'scratch';
    addInjury(c, type, part);
    const base = type === 'scratch' ? rand(4, 8) : type === 'laceration' ? rand(8, 13) : rand(10, 16);
    const dmg = Math.max(1, Math.round(base * (1 - prot.protect * 0.5) * (z.kind === 'brute' ? 1.6 : 1)));
    if (prot.stack) {
      const torn = wearDamage(c, prot.slot, 1);
      if (torn) log(e, torn, 'bad');
    }
    log(
      e,
      type === 'bite'
        ? `🧟 ${who}${ZOMBIE_NAME[z.kind]}에게 ${PART_LABEL[part]}을(를) 물렸다!! 감염이 시작될지도 모른다… (-${dmg}) 😨`
        : `🧟 ${who}${ZOMBIE_NAME[z.kind]}의 공격! ${PART_LABEL[part]}에 ${type === 'scratch' ? '긁힘' : '열상'}. (-${dmg})`,
      'bad',
    );
    damage(c, dmg);
    if (type === 'bite') {
      addEffect(c, 'shaken', store.s.time, `${ZOMBIE_NAME[z.kind]}에게 물렸다`);
      traumatize(c, e.locationId, `${ZOMBIE_NAME[z.kind]}에게 물렸다`);
    }
    if (!store.s.expeditions[leader.id]) return; // 쓰러짐
  }
  // 소음이 크면 증원
  if (e.noise > 55 && chance(0.15 + (e.noise - 55) * 0.005) && enc.zombies.length < 8) {
    enc.zombies.push(makeZombie(effectiveDanger(e)));
    log(e, '소음을 듣고 좀비가 하나 더 다가온다!', 'bad');
  }
}

function doFlee(e: Expedition): void {
  if (!e.encounter) return;
  const c = charOf(e);
  const n = e.encounter.zombies.filter((z) => !z.staggered).length;
  const runners = e.encounter.zombies.filter((z) => z.kind === 'runner').length;
  const p = clamp(0.8 - 0.07 * n - 0.1 * runners + level(c, 'stealth') * 0.04 + effectMods(c, store.s).flee + (e.encounter.engaged ? 0 : 0.15), 0.15, 0.95);
  c.energy = clamp(c.energy - 4, 0, 100);
  if (chance(p)) {
    e.encounter = null;
    e.found = null;
    e.noise = clamp(e.noise - 12, 0, 100);
    log(e, '🏃 필사적으로 달려 좀비를 따돌렸다.', 'good');
    addXp(c, 'stealth', 4);
    passTime(e, 10);
  } else {
    log(e, '도망치지 못했다! 좀비가 길을 막았다.', 'bad');
    e.encounter.engaged = true;
    zombieTurn(e);
  }
  
}

function doHide(e: Expedition): void {
  if (!e.encounter || e.encounter.engaged) return;
  const c = charOf(e);
  const n = e.encounter.zombies.length;
  const p = clamp(0.5 + level(c, 'stealth') * 0.06 - n * 0.05, 0.1, 0.95);
  if (chance(p)) {
    e.encounter = null;
    log(e, '🤫 숨을 죽이고 기다렸다. 좀비들이 지나갔다.', 'good');
    addXp(c, 'stealth', 6);
    passTime(e, 15);
  } else {
    e.encounter.engaged = true;
    log(e, '들켰다! 좀비들이 이쪽을 본다.', 'bad');
    zombieTurn(e);
  }
  
}

/** 제자리에서 숨죽이고 기다리기: 소음 감소 */
export function waitQuietly(charId: string): void {
  const e = here(charId);
  if (!e || e.encounter) return;
  e.noise = clamp(e.noise - 15, 0, 100);
  log(e, '잠시 숨을 고르며 주변이 조용해지길 기다렸다.');
  if (!passTime(e, 20)) return store.commit();
  rollEncounter(e, 0.4);
  store.commit();
}

export function consumeInField(charId: string, itemId: string): void {
  const e = here(charId);
  if (!e) return;
  const c = charOf(e);
  const msg = consumeFrom(c.inventory, c, itemId);
  if (msg) log(e, msg);
  if (e.encounter?.engaged) zombieTurn(e);
  store.commit();
}

export function attack(charId: string, zombieId: string): void {
  const e = here(charId);
  if (!e?.encounter) return;
  doAttack(e, zombieId);
  store.commit();
}

export function flee(charId: string): void {
  const e = here(charId);
  if (!e?.encounter) return;
  doFlee(e);
  store.commit();
}

export function hide(charId: string): void {
  const e = here(charId);
  if (!e?.encounter || e.encounter.engaged) return;
  doHide(e);
  store.commit();
}

/** 수색 지점 한 곳에서 나온 물건 */
function rollLoot(c: Character, sp: ZoneDef['spots'][number], careful: boolean): { found: ItemStack[]; missed: number } {
  const found: ItemStack[] = [];
  const scav = level(c, 'scavenge');
  let n = rand(sp.rolls[0], sp.rolls[1]) + (scav >= 4 ? 1 : 0) - (careful ? 0 : 1);
  n = Math.max(careful ? 1 : 0, n);
  const hasLight = hasTag(c.inventory, 'light');
  let missed = 0;
  for (let i = 0; i < n; i++) {
    if (sp.dark && !hasLight && chance(0.4)) {
      missed++;
      continue;
    }
    const entry = pickWeighted(sp.loot);
    const q = entry.qty ? rand(entry.qty[0], entry.qty[1]) : 1;
    const existing = found.find((f) => f.itemId === entry.itemId && f.durability === undefined);
    if (existing && ITEMS[entry.itemId].durability === undefined) existing.qty += q;
    else if (ITEMS[entry.itemId].durability !== undefined) for (let k = 0; k < q; k++) found.push(makeStack(entry.itemId));
    else found.push(makeStack(entry.itemId, q));
  }
  return { found, missed };
}

// ───────────── 장기 탐사 (자동) ─────────────

const FIELD_FOOD = (id: string) => ITEMS[id]?.category === 'food' && !ITEMS[id]?.consume?.sick;
const FIELD_DRINK = (id: string) => ITEMS[id]?.category === 'drink' && !ITEMS[id]?.consume?.sick;

/** 장기 탐사 중 좀비를 만나면: 숨거나, 싸우거나, 도망친다 */
function autoFight(e: Expedition) {
  const c = charOf(e);
  for (let i = 0; i < 20 && e.encounter && store.s.expeditions[c.id]; i++) {
    const enc = e.encounter;
    if (!enc.engaged && i === 0 && chance(0.5)) {
      doHide(e);
      continue;
    }
    if (c.health < 35 || enc.zombies.length >= 5) {
      doFlee(e);
      continue;
    }
    doAttack(e, enc.zombies[0].id);
  }
  if (e.encounter && store.s.expeditions[c.id]) {
    e.encounter = null;
    log(e, '간신히 자리를 피했다.');
  }
}

/** 장기 탐사의 자동 수색 한 번 (실제 15분마다) */
function autoRound(e: Expedition, at: number) {
  const s = store.s;
  const c = charOf(e);
  // 챙겨간 음식·물
  if (c.hunger < 40) {
    const food = c.inventory.find((x) => FIELD_FOOD(x.itemId));
    if (food) {
      const msg = consumeFrom(c.inventory, c, food.itemId);
      if (msg) log(e, msg);
    }
  }
  if (c.thirst < 40) {
    const drink = c.inventory.find((x) => FIELD_DRINK(x.itemId));
    if (drink) {
      const msg = consumeFrom(c.inventory, c, drink.itemId);
      if (msg) log(e, msg);
    }
  }
  // 몸이 버티지 못하면 일찍 돌아간다
  if (c.health < 35 || c.energy < 12 || c.thirst < 8 || c.hunger < 8) {
    log(e, '몸이 버티지 못할 것 같아 일찍 돌아가기로 했다.', 'bad');
    alertFor(e, `⚠️ ${c.name}`, '몸이 버티지 못해 일찍 돌아오는 중', 'bad');
    return startReturn(e, at);
  }
  const cap = carryCapacity(c);
  if (carriedWeight(c) >= cap - 0.3) {
    log(e, '짐이 가득 찼다. 돌아가자.', 'info');
    return startReturn(e, at);
  }
  // 물건이 남은 구역으로 옮겨 다닌다 (잠긴 곳은 열쇠가 있으면 연다)
  const loc = LOCATION_BY_ID[e.locationId];
  const ls = s.locations[e.locationId];
  const left = (z: ZoneDef) => z.spots.filter((sp) => (ls.zones[z.id]?.spots[sp.id]?.remaining ?? 0) > 0);
  // 잠긴 구역: 열쇠 → 자물쇠 따개(조용히, 실패할 수 있음) → 쇠지렛대(확실하지만 시끄러움). 한 번에 한 곳만
  const gear = [...c.inventory, ...(c.weapon ? [c.weapon] : [])];
  for (const z of loc.zones) {
    const zs = ls.zones[z.id];
    if (!zs || zs.unlocked || !z.locked || (z.secret && !zs.secretFound)) continue;
    if (z.locked.key && countItem(c.inventory, z.locked.key) > 0) {
      zs.unlocked = true;
      log(e, `${itemDef(z.locked.key).name}로 [${z.name}]을(를) 열었다.`, 'good');
      continue;
    }
    if (z.locked.lockpick && countItem(c.inventory, 'lockpick') > 0) {
      const p = clamp(0.45 + level(c, 'stealth') * 0.05 + level(c, 'crafting') * 0.03, 0.1, 0.95);
      passTime(e, 15);
      if (chance(p)) {
        zs.unlocked = true;
        log(e, `조용히 [${z.name}]의 자물쇠를 땄다.`, 'good');
        levelUpMsg(e, addXp(c, 'stealth', 8));
      } else if (chance(0.5)) {
        removeItem(c.inventory, 'lockpick', 1);
        log(e, `[${z.name}] 자물쇠를 따다 따개가 부러졌다.`, 'bad');
      } else log(e, `[${z.name}] 자물쇠가 꿈쩍도 않는다.`);
      break;
    }
    if (z.locked.pry && hasTag(gear, 'pry')) {
      zs.unlocked = true;
      addNoise(e, 25);
      log(e, `쇠지렛대로 [${z.name}]의 문을 억지로 열었다. 쾅!`, 'info');
      addXp(c, 'melee', 3);
      if (rollEncounter(e, 1.3)) autoFight(e);
      break;
    }
  }
  if (!store.s.expeditions[e.characterId]) return;
  let z = zoneDef(e);
  const masked = c.inventory.some((x) => x.itemId === 'gas_mask');
  if (!left(z).length || (z.toxic && !masked)) {
    const next = loc.zones.find((x) => ls.zones[x.id]?.unlocked && left(x).length && (!x.toxic || masked) && (!x.boss || ls.zones[x.id]?.bossDown));
    if (!next) {
      log(e, '더 뒤질 곳이 없다. 돌아가자.', 'info');
      return startReturn(e, at);
    }
    e.zoneId = next.id;
    z = next;
    log(e, `[${z.name}](으)로 옮겼다.`);
    if (bossCheck(e)) {
      autoFight(e);
      return;
    }
  }
  const sp = pick(left(z));
  const st = ls.zones[z.id].spots[sp.id];
  st.searched++;
  st.remaining--;
  addNoise(e, 3);
  const { found } = rollLoot(c, sp, true);
  levelUpMsg(e, addXp(c, 'scavenge', 5));
  // 가벼운 것부터 담는다
  found.sort((a, b) => ITEMS[a.itemId].weight * a.qty - ITEMS[b.itemId].weight * b.qty);
  const taken: string[] = [];
  let leftBehind = 0;
  for (const it of found) {
    if (carriedWeight(c) + ITEMS[it.itemId].weight * it.qty > cap + 0.001) {
      leftBehind++;
      continue;
    }
    addStack(c.inventory, it);
    taken.push(`${ITEMS[it.itemId].icon}${ITEMS[it.itemId].name}${it.qty > 1 ? ` x${it.qty}` : ''}`);
    if (it.itemId === 'area_map') revealMap(e);
  }
  if (taken.length) {
    log(e, `[${sp.name}] ${taken.join(', ')}`, 'good');
    brave(e);
  } else log(e, `[${sp.name}]에서 쓸 만한 것을 찾지 못했다.`);
  const clue = rollClue(c, e.locationId, 0.07);
  if (clue) log(e, clue, 'good');
  toxicTick(e);
  if (!store.s.expeditions[e.characterId]) return;
  if (leftBehind) log(e, `무거워서 ${leftBehind}개는 두고 왔다.`);
  passTime(e, 15);
  e.noise = clamp(e.noise - 4, 0, 100);
  if (rollEncounter(e, 0.9)) autoFight(e);
}

export function returnHome(charId: string): void {
  const e = here(charId);
  if (!e || e.encounter?.engaged) return;
  const now = Date.now();
  startReturn(e, now);
  // 같은 곳에 온 파티원도 같이 돌아간다 (싸우는 중이 아니면)
  for (const m of partyMates(charId)) {
    const me = store.s.expeditions[m.id];
    if (me && me.locationId === e.locationId && me.phase === 'there' && me.mode === 'manual' && !me.encounter?.engaged) {
      log(me, `파티와 함께 돌아가기로 했다.`);
      startReturn(me, now);
    }
  }
  store.commit();
}

/** 같은 파티의 다른 사람 */
function partyMates(charId: string) {
  const s = store.s;
  const c = s.characters[charId];
  if (!c?.partyId) return [];
  return Object.values(s.characters).filter((o) => o.id !== charId && o.partyId === c.partyId);
}

/** 같은 탐험지 현장에 있는 파티원들의 탐험 */
function partyHere(e: Expedition): Expedition[] {
  const s = store.s;
  const c = s.characters[e.characterId];
  if (!c?.partyId) return [];
  return Object.values(s.expeditions).filter((x) => x.characterId !== e.characterId && x.locationId === e.locationId && x.phase === 'there' && s.characters[x.characterId]?.partyId === c.partyId);
}

/** 쓰러진 파티원을 업고 돌아갈 사람 (같은 현장에 있는 파티원) */
export function rescuerFor(charId: string): Character | null {
  const e = store.s.expeditions[charId];
  if (!e) return null;
  const mate = partyHere(e).find((x) => !x.encounter?.engaged && (store.s.characters[x.characterId]?.health ?? 0) > 20);
  return mate ? store.s.characters[mate.characterId] : null;
}

/** 쓰러진 파티원을 업고 귀환 시작 */
export function carryHome(rescuerId: string, downedName: string) {
  const e = store.s.expeditions[rescuerId];
  if (!e) return;
  log(e, `🫂 쓰러진 ${downedName}을(를) 업고 거점으로 향한다.`, 'bad');
  startReturn(e, Date.now());
}
