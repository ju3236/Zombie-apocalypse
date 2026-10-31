import { ITEMS, itemDef } from './data/items';
import type { ItemStack } from './types';
import { uid } from './util';

export function isDurable(itemId: string): boolean {
  return ITEMS[itemId]?.durability !== undefined;
}

export function makeStack(itemId: string, qty = 1): ItemStack {
  const d = itemDef(itemId);
  if (d.durability !== undefined) return { uid: uid('s'), itemId, qty: 1, durability: d.durability };
  return { uid: uid('s'), itemId, qty };
}

/** 인벤토리에 아이템 추가. 내구도 물건은 개별 슬롯. */
export function addItem(inv: ItemStack[], itemId: string, qty = 1): void {
  if (qty <= 0) return;
  if (isDurable(itemId)) {
    for (let i = 0; i < qty; i++) inv.push(makeStack(itemId));
    return;
  }
  const s = inv.find((x) => x.itemId === itemId);
  if (s) s.qty += qty;
  else inv.push(makeStack(itemId, qty));
}

/** 이미 만들어진 스택(내구도 유지)을 추가 */
export function addStack(inv: ItemStack[], stack: ItemStack): void {
  if (stack.durability !== undefined) inv.push(stack);
  else addItem(inv, stack.itemId, stack.qty);
}

export function countItem(inv: ItemStack[], itemId: string): number {
  return inv.reduce((s, x) => (x.itemId === itemId ? s + x.qty : s), 0);
}

/** 수량만큼 제거. 부족하면 false, 아무것도 제거하지 않음 */
export function removeItem(inv: ItemStack[], itemId: string, qty = 1): boolean {
  if (countItem(inv, itemId) < qty) return false;
  let left = qty;
  // 내구도 낮은 것부터 소모
  const stacks = inv.filter((x) => x.itemId === itemId).sort((a, b) => (a.durability ?? 0) - (b.durability ?? 0));
  for (const s of stacks) {
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
    if (left <= 0) break;
  }
  for (let i = inv.length - 1; i >= 0; i--) if (inv[i].qty <= 0) inv.splice(i, 1);
  return true;
}

/** 특정 스택(uid) 꺼내기 */
export function takeStack(inv: ItemStack[], stackUid: string, qty?: number): ItemStack | null {
  const i = inv.findIndex((x) => x.uid === stackUid);
  if (i < 0) return null;
  const s = inv[i];
  const n = qty === undefined ? s.qty : Math.min(qty, s.qty);
  if (n >= s.qty) {
    inv.splice(i, 1);
    return s;
  }
  s.qty -= n;
  return { ...s, uid: uid('s'), qty: n };
}

export function hasTag(inv: ItemStack[], tag: string): boolean {
  return inv.some((s) => ITEMS[s.itemId]?.tags?.includes(tag));
}

export function totalWeight(inv: ItemStack[]): number {
  return Math.round(inv.reduce((s, x) => s + (ITEMS[x.itemId]?.weight ?? 0) * x.qty, 0) * 10) / 10;
}

export function sortInventory(inv: ItemStack[]): ItemStack[] {
  const order = ['food', 'drink', 'medical', 'weapon', 'tool', 'backpack', 'material', 'furniture', 'prop', 'rare'];
  return [...inv].sort((a, b) => {
    const da = ITEMS[a.itemId];
    const db = ITEMS[b.itemId];
    const c = order.indexOf(da.category) - order.indexOf(db.category);
    return c !== 0 ? c : da.name.localeCompare(db.name, 'ko');
  });
}
