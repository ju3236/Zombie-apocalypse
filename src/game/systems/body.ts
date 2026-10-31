import { ITEMS } from '../data/items';
import { addStack, makeStack, removeItem, takeStack, countItem } from '../inventory';
import { store } from '../store';
import type { BodyPart, Character, Injury, ItemStack, WearSlot } from '../types';
import { fixJosa, pickWeighted } from '../util';
import { addXp } from './character';

export const PART_LABEL: Record<BodyPart, string> = {
  head: '머리',
  neck: '목',
  torso: '몸통',
  l_arm: '왼팔',
  r_arm: '오른팔',
  l_hand: '왼손',
  r_hand: '오른손',
  l_leg: '왼다리',
  r_leg: '오른다리',
  l_foot: '왼발',
  r_foot: '오른발',
};
export const PARTS = Object.keys(PART_LABEL) as BodyPart[];

export const SLOT_LABEL: Record<WearSlot, string> = { hat: '모자', top: '상의', gloves: '장갑', bottom: '하의', shoes: '신발' };
export const WEAR_SLOTS = Object.keys(SLOT_LABEL) as WearSlot[];

/** 부위를 지켜주는 옷 칸 (목은 상의 깃이 절반만 막는다) */
export const PART_SLOT: Record<BodyPart, WearSlot> = {
  head: 'hat', neck: 'top', torso: 'top', l_arm: 'top', r_arm: 'top', l_hand: 'gloves', r_hand: 'gloves',
  l_leg: 'bottom', r_leg: 'bottom', l_foot: 'shoes', r_foot: 'shoes',
};

/** 좀비가 노리는 부위 (손과 팔을 가장 많이 다친다) */
const HIT_WEIGHTS: { part: BodyPart; w: number }[] = [
  { part: 'l_hand', w: 10 }, { part: 'r_hand', w: 10 }, { part: 'l_arm', w: 12 }, { part: 'r_arm', w: 12 },
  { part: 'torso', w: 14 }, { part: 'neck', w: 8 }, { part: 'head', w: 6 },
  { part: 'l_leg', w: 9 }, { part: 'r_leg', w: 9 }, { part: 'l_foot', w: 5 }, { part: 'r_foot', w: 5 },
];
export const randomHitPart = (): BodyPart => pickWeighted(HIT_WEIGHTS).part;

export function defaultOutfit(): Partial<Record<WearSlot, ItemStack>> {
  return { top: makeStack('w_tshirt'), bottom: makeStack('w_jeans'), shoes: makeStack('w_sneakers') };
}

/** 부위의 방어: 막을 확률과 그 옷 */
export function protectionFor(c: Character, part: BodyPart): { protect: number; stack: ItemStack | null; slot: WearSlot } {
  const slot = PART_SLOT[part];
  const st = c.wear?.[slot] ?? null;
  let protect = st ? (ITEMS[st.itemId]?.wear?.protect ?? 0) : 0;
  if (part === 'neck') protect *= 0.5;
  return { protect, stack: st, slot };
}

/** 옷이 공격을 받아 닳는다. 찢어지면 메시지 */
export function wearDamage(c: Character, slot: WearSlot, amount: number): string | null {
  const st = c.wear?.[slot];
  if (!st || st.durability === undefined) return null;
  st.durability -= amount;
  if (st.durability <= 0) {
    delete c.wear![slot];
    return `👕 ${ITEMS[st.itemId].name}이(가) 찢어져 버렸다!`;
  }
  return null;
}

// ───────────── 장착 ─────────────

export type EquipSlot = WearSlot | 'weapon' | 'backpack';

export function slotOfItem(itemId: string): EquipSlot | null {
  const d = ITEMS[itemId];
  if (!d) return null;
  if (d.wear) return d.wear.slot;
  if (d.backpack) return 'backpack';
  if (d.weapon) return 'weapon';
  return null;
}

export function equippedIn(c: Character, slot: EquipSlot): ItemStack | null {
  if (slot === 'weapon') return c.weapon;
  if (slot === 'backpack') return c.backpack;
  return c.wear?.[slot] ?? null;
}

function setSlot(c: Character, slot: EquipSlot, st: ItemStack | null) {
  if (slot === 'weapon') c.weapon = st;
  else if (slot === 'backpack') c.backpack = st;
  else {
    c.wear ??= {};
    if (st) c.wear[slot] = st;
    else delete c.wear[slot];
  }
}

const atBase = (c: Character) => c.status === 'base' || c.status === 'down';

/** 소지품(inv) 또는 창고(storage)에서 장착. 원래 장비는 같은 곳으로 돌아간다 */
export function equipItem(c: Character, from: 'inv' | 'storage', stackUid: string): string | null {
  const s = store.s;
  if (from === 'storage' && !atBase(c)) return '거점에 있어야 창고 물건을 장착할 수 있다.';
  const src = from === 'inv' ? c.inventory : s.storage;
  const st0 = src.find((x) => x.uid === stackUid);
  if (!st0) return null;
  const slot = slotOfItem(st0.itemId);
  if (!slot) return '장착할 수 없는 물건이다.';
  const st = takeStack(src, stackUid, 1);
  if (!st) return null;
  const prev = equippedIn(c, slot);
  if (prev) addStack(src, prev);
  setSlot(c, slot, st);
  store.commit();
  return null;
}

export function unequipSlot(c: Character, slot: EquipSlot): void {
  const prev = equippedIn(c, slot);
  if (!prev) return;
  addStack(atBase(c) ? store.s.storage : c.inventory, prev);
  setSlot(c, slot, null);
  store.commit();
}

/** 장착 후보 (소지품 + 거점이면 창고) */
export function equipCandidates(c: Character, slot: EquipSlot): { st: ItemStack; from: 'inv' | 'storage' }[] {
  const out: { st: ItemStack; from: 'inv' | 'storage' }[] = [];
  for (const st of c.inventory) if (slotOfItem(st.itemId) === slot) out.push({ st, from: 'inv' });
  if (atBase(c)) for (const st of store.s.storage) if (slotOfItem(st.itemId) === slot) out.push({ st, from: 'storage' });
  return out;
}

// ───────────── 치료 ─────────────

const SEVERITY: Record<Injury['type'], number> = { bite: 3, laceration: 2, scratch: 1 };

/** 치료 재료가 있는 곳: 소지품 먼저, 거점이면 창고 */
function supplySources(c: Character): ItemStack[][] {
  return atBase(c) ? [c.inventory, store.s.storage] : [c.inventory];
}
export function supplyCount(c: Character, itemId: string): number {
  return supplySources(c).reduce((n, inv) => n + countItem(inv, itemId), 0);
}
function useSupply(c: Character, itemId: string): boolean {
  for (const inv of supplySources(c)) if (removeItem(inv, itemId, 1)) return true;
  return false;
}

export const BANDAGE_ITEMS = ['bandage', 'cloth'];
export const DISINFECT_ITEMS = ['disinfectant', 'herbs'];

/** 특정 상처에 붕대 감기. bandage = 깨끗한 붕대, cloth = 찢은 천(더러움) */
export function bandageWound(c: Character, injId: string, itemId: string, healer: Character = c): string {
  const inj = c.injuries.find((i) => i.id === injId);
  if (!inj) return '';
  if (inj.bandaged && !inj.dirtyBandage) return '이미 깨끗한 붕대를 감았다.';
  if (!useSupply(healer === c ? c : healer, itemId)) return `${ITEMS[itemId].name}이(가) 없다.`;
  inj.bandaged = true;
  inj.dirtyBandage = itemId === 'cloth';
  const msg = addXp(healer, 'medical', 4);
  store.commit();
  return fixJosa(
    `${healer.name}: ${PART_LABEL[inj.part ?? 'torso']}에 ${ITEMS[itemId].name}을(를) 감았다.${inj.dirtyBandage ? ' (깨끗하지 않아 감염 위험이 남는다)' : ''}${msg ? ` ⭐${msg}` : ''}`,
  );
}

export function disinfectWound(c: Character, injId: string, itemId: string, healer: Character = c): string {
  const inj = c.injuries.find((i) => i.id === injId);
  if (!inj) return '';
  if (inj.disinfected) return '이미 소독했다.';
  if (!useSupply(healer, itemId)) return `${ITEMS[itemId].name}이(가) 없다.`;
  inj.disinfected = true;
  c.infection = Math.max(0, c.infection - (itemId === 'disinfectant' ? 8 : 3));
  addXp(healer, 'medical', 3);
  store.commit();
  return fixJosa(`${healer.name}: ${PART_LABEL[inj.part ?? 'torso']} 상처를 ${ITEMS[itemId].name}(으)로 소독했다.`);
}

/** 가장 심한 상처부터 (붕대 안 감긴 것 우선) */
export function worstWound(c: Character, need: 'bandage' | 'disinfect'): Injury | undefined {
  return [...c.injuries]
    .filter((i) => (need === 'bandage' ? !i.bandaged || i.dirtyBandage : !i.disinfected))
    .sort((a, b) => SEVERITY[b.type] - SEVERITY[a.type])[0];
}

/** 부위 상태 요약 */
export function partWounds(c: Character, part: BodyPart): Injury[] {
  return c.injuries.filter((i) => (i.part ?? 'torso') === part);
}

/** 예전 세이브 정리 */
export function migrateBody(c: Character) {
  c.wear ??= defaultOutfit();
  for (const i of c.injuries) i.part ??= 'torso';
}

