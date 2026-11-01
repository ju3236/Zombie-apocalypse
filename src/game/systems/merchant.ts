import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { LOCATION_BY_ID, LOCATIONS } from '../data/locations';
import { addStack, makeStack, takeStack } from '../inventory';
import { makeLocationState } from '../newGame';
import { addNews, store } from '../store';
import type { Character, GameState, ItemStack, Merchant } from '../types';
import { chance, fixJosa, pick, pickWeighted, rand } from '../util';
import { addRep, baseTier } from './baseLevel';
import { carriedWeight, carryCapacity } from './character';
import { mod } from './traits';

/**
 * 유랑 상인: 며칠마다 지도 어딘가에 노점을 편다. 찾아가서 들고 간 물건을 팔아 점수를 쌓고, 그 점수로 산다.
 */

const STAY_DAYS = 2;
const CAT_VALUE: Record<string, number> = { food: 2, drink: 2, medical: 4, weapon: 6, tool: 4, material: 1, furniture: 5, prop: 2, backpack: 6, clothing: 3, rare: 8 };

/** 물건 값 (상인 기준) */
export function valueOf(itemId: string, st?: ItemStack): number {
  const d = ITEMS[itemId];
  if (!d) return 0;
  if (itemId.startsWith('ammo_') || itemId === 'arrow' || itemId === 'bolt_crossbow') return 0.4;
  if (itemId === 'rotten_food') return 0;
  let v = CAT_VALUE[d.category] ?? 1;
  v *= d.rarity === 3 ? 4 : d.rarity === 2 ? 2 : 1;
  if (d.weapon?.ammo) v *= 1.5;
  if (d.vehicle) v = 40;
  if (st?.durability !== undefined && d.durability) v *= 0.3 + 0.7 * (st.durability / d.durability);
  return Math.max(0.5, Math.round(v * 10) / 10);
}

const STOCK_POOL: { itemId: string; w: number; qty?: [number, number] }[] = [
  { itemId: 'antibiotics', w: 3 }, { itemId: 'first_aid', w: 3 }, { itemId: 'suture_kit', w: 2 }, { itemId: 'painkiller', w: 3, qty: [2, 4] },
  { itemId: 'sleeping_pill', w: 2 }, { itemId: 'sedative', w: 2 }, { itemId: 'antihistamine', w: 2 }, { itemId: 'motion_pill', w: 2 }, { itemId: 'vitamins', w: 2 },
  { itemId: 'gasoline', w: 4, qty: [1, 3] }, { itemId: 'ammo_9mm', w: 3, qty: [8, 16] }, { itemId: 'ammo_shell', w: 2, qty: [4, 8] }, { itemId: 'arrow', w: 2, qty: [6, 12] },
  { itemId: 'repair_kit', w: 3 }, { itemId: 'sewing_kit', w: 2 }, { itemId: 'mask_filter', w: 2 }, { itemId: 'gas_mask', w: 1 }, { itemId: 'glasses', w: 2 },
  { itemId: 'fishing_rod', w: 2 }, { itemId: 'compass', w: 1 }, { itemId: 'binoculars', w: 1 }, { itemId: 'headlamp', w: 1 }, { itemId: 'multitool', w: 1 },
  { itemId: 'winter_coat', w: 2 }, { itemId: 'raincoat', w: 2 }, { itemId: 'hiking_pack', w: 2 }, { itemId: 'vest_protective', w: 1 },
  { itemId: 'manual_carpentry', w: 1 }, { itemId: 'manual_cooking', w: 1 }, { itemId: 'manual_medical', w: 1 }, { itemId: 'manual_farming', w: 1 },
  { itemId: 'seed_tomato', w: 2, qty: [2, 4] }, { itemId: 'seed_potato', w: 2, qty: [2, 4] }, { itemId: 'seed_strawberry', w: 1, qty: [1, 3] }, { itemId: 'seeds', w: 2, qty: [3, 6] },
  { itemId: 'canned_meat', w: 2, qty: [2, 3] }, { itemId: 'ration_pack', w: 2, qty: [1, 3] }, { itemId: 'coffee', w: 2, qty: [2, 4] }, { itemId: 'chocolate', w: 2, qty: [2, 4] },
  { itemId: 'p_music_box', w: 1 }, { itemId: 'lucky_charm', w: 1 }, { itemId: 'gift_wrap', w: 1, qty: [2, 3] }, { itemId: 'lab_keycard', w: 1 }, { itemId: 'research_data', w: 1 },
  { itemId: 'crossbow', w: 1 }, { itemId: 'bow', w: 1 }, { itemId: 'machete', w: 1 }, { itemId: 'f_jukebox', w: 1 }, { itemId: 'f_generator', w: 1 }, { itemId: 'v_bicycle', w: 1 },
];

export function merchantHere(c: Character, s: GameState = store.s): Merchant | null {
  const m = s.merchant;
  const e = s.expeditions[c.id];
  return m && e && e.phase === 'there' && e.locationId === m.locationId ? m : null;
}

/** 이 캐릭터가 사는 값 (거점 레벨·협상 솜씨만큼 싸진다) */
export function buyPrice(c: Character, price: number): number {
  const s = store.s;
  const tier = s.bases[c.homeId] ? baseTier(s, s.bases[c.homeId]) : 0;
  const k = Math.max(0.6, 1 - mod(c, 'trade') * 0.5 - tier * 0.04);
  return Math.max(1, Math.round(price * k));
}

export function sellPrice(c: Character, st: ItemStack): number {
  return Math.round(valueOf(st.itemId, st) * 0.6 * Math.max(0.5, 1 + mod(c, 'trade') * 0.5) * 10) / 10;
}

/** 새 상인 */
export function spawnMerchant(s: GameState): void {
  if (s.merchant) return;
  const spots = LOCATIONS.filter((l) => l.id.startsWith('merchant_'));
  const def = pick(spots);
  const stock: Merchant['stock'] = [];
  for (let i = 0; i < 40 && stock.length < 10; i++) {
    const e = pickWeighted(STOCK_POOL);
    if (!ITEMS[e.itemId] || stock.some((x) => x.itemId === e.itemId)) continue;
    const qty = e.qty ? rand(e.qty[0], e.qty[1]) : 1;
    stock.push({ itemId: e.itemId, qty, price: Math.max(1, Math.ceil(valueOf(e.itemId) * 1.4)) });
  }
  const ls = makeLocationState(def, true);
  ls.expiresAt = s.time + STAY_DAYS * 1440;
  s.locations[def.id] = ls;
  s.merchant = { locationId: def.id, until: ls.expiresAt, stock, credit: {} };
  addNews(`🧳 유랑 상인이 [${def.name}]에 노점을 폈다! (${STAY_DAYS}일 동안) 들고 간 물건과 바꿀 수 있다.`, 'good', '🧳 유랑 상인이 나타났다');
  bus.emit('alert', { title: '🧳 유랑 상인', text: `[${def.name}]에 노점을 폈다. 지도에서 찾아가 보자.`, kind: 'info' });
}

/** 하루가 지날 때: 떠날 때가 된 상인은 떠나고, 가끔 새 상인이 온다 */
export function merchantDaily(s: GameState, day: number): void {
  const m = s.merchant;
  if (m && s.time >= m.until) {
    const busy = Object.values(s.expeditions).some((e) => e.locationId === m.locationId);
    if (!busy) {
      delete s.locations[m.locationId];
      s.merchant = null;
      addNews('🧳 유랑 상인이 짐을 싸서 떠났다.', 'info');
    }
  } else if (!m && day >= 2 && chance(0.4)) spawnMerchant(s);
}

/** 들고 간 물건 팔기 */
export function sellToMerchant(c: Character, stackUid: string, qty = 1): string | null {
  const s = store.s;
  const m = merchantHere(c);
  if (!m) return '상인이 있는 곳에 있어야 한다.';
  const st = c.inventory.find((x) => x.uid === stackUid);
  if (!st) return null;
  const n = Math.min(qty, st.qty);
  const v = sellPrice(c, st) * n;
  if (v <= 0) return '상인이 고개를 젓는다. "그건 필요 없어."';
  const taken = takeStack(c.inventory, stackUid, n);
  if (!taken) return null;
  m.credit[c.id] = Math.round(((m.credit[c.id] ?? 0) + v) * 10) / 10;
  // 상인도 그 물건을 다시 판다
  const ex = m.stock.find((x) => x.itemId === taken.itemId);
  if (ex) ex.qty += n;
  else if (m.stock.length < 16 && valueOf(taken.itemId) >= 2) m.stock.push({ itemId: taken.itemId, qty: n, price: Math.max(1, Math.ceil(valueOf(taken.itemId) * 1.4)) });
  store.commit();
  void s;
  return null;
}

/** 쌓은 점수로 사기 */
export function buyFromMerchant(c: Character, idx: number): string | null {
  const m = merchantHere(c);
  if (!m) return '상인이 있는 곳에 있어야 한다.';
  const it = m.stock[idx];
  if (!it || it.qty <= 0) return null;
  const price = buyPrice(c, it.price);
  if ((m.credit[c.id] ?? 0) + 1e-6 < price) return `점수가 모자라다. (${price} 필요)`;
  const w = ITEMS[it.itemId].weight;
  if (!ITEMS[it.itemId].vehicle && carriedWeight(c) + w > carryCapacity(c) + 0.001) return '짐이 너무 무겁다.';
  m.credit[c.id] = Math.round(((m.credit[c.id] ?? 0) - price) * 10) / 10;
  it.qty -= 1;
  if (it.qty <= 0) m.stock.splice(idx, 1);
  addStack(c.inventory, makeStack(it.itemId, 1));
  if (chance(0.3)) addRep(store.s.bases[c.homeId], 1);
  store.commit();
  return fixJosa(`${ITEMS[it.itemId].icon} ${ITEMS[it.itemId].name}을(를) 샀다.`);
}

export const merchantName = (s: GameState) => (s.merchant ? LOCATION_BY_ID[s.merchant.locationId]?.name : '');
