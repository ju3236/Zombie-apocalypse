import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { createHome, residentsOf, starterLabel } from '../homes';
import { addStack, countItem, removeItem, takeStack, totalWeight } from '../inventory';
import { addNews, store, withBase } from '../store';
import type { Character, ItemStack } from '../types';
import { starterPos, travelBase } from '../world/cityGen';
import { basePos } from './expedition';

/**
 * 이사: 지금 집 창고에서 짐을 골라 다른 거점(또는 빈 집)으로 옮긴다.
 * 실제 시간으로 이동하고, 짐이 들 수 있는 것보다 많으면 여러 번 왕복한 만큼 오래 걸린다.
 */

export type MoveTarget = { kind: 'base'; baseId: string } | { kind: 'starter'; starter: number };

export interface MovePlan {
  minutes: number;
  trips: number;
  weight: number;
  capacity: number;
  error: string | null;
}

function targetPos(t: MoveTarget) {
  return t.kind === 'base' ? basePos(t.baseId) : starterPos(t.starter);
}

/** 한 번에 들 수 있는 무게: 몸 12kg + 가방 + 이동수단 */
function moveCapacity(c: Character, vehicleItemId?: string | null) {
  const bag = c.backpack ? (ITEMS[c.backpack.itemId]?.backpack ?? 0) : 0;
  const trunk = vehicleItemId ? (ITEMS[vehicleItemId]?.vehicle?.carry ?? 0) : 0;
  return 12 + bag + trunk;
}

export function planMove(c: Character, t: MoveTarget, picks: { uid: string; qty: number }[], vehicleUid?: string): MovePlan {
  const s = store.s;
  const home = s.bases[c.homeId];
  const vehicle = vehicleUid ? home?.storage.find((x) => x.uid === vehicleUid) : undefined;
  const weight =
    Math.round(
      picks.reduce((w, p) => {
        const st = home?.storage.find((x) => x.uid === p.uid);
        return w + (st ? ITEMS[st.itemId].weight * Math.min(p.qty, st.qty) : 0);
      }, 0) * 10,
    ) / 10;
  const capacity = moveCapacity(c, vehicle?.itemId);
  const trips = Math.max(1, Math.ceil(weight / capacity));
  const speed = vehicle ? (ITEMS[vehicle.itemId].vehicle?.speed ?? 1) : 1;
  const oneWay = Math.max(1, Math.round(travelBase(basePos(c.homeId), targetPos(t)) / 5 / speed));
  // 짐을 나르려면 (왕복 × (횟수-1)) + 편도
  const minutes = oneWay * (trips * 2 - 1);
  let error: string | null = null;
  if (c.status !== 'base') error = `${c.name}은(는) 지금 거점에 없다.`;
  else if (c.crafting) error = '제작 중이다. 먼저 그만두게 하자.';
  else if (t.kind === 'base' && t.baseId === c.homeId) error = '이미 이 집에 산다.';
  else if (t.kind === 'starter' && Object.values(s.bases).some((b) => b.starter === t.starter)) error = '그 집에는 이미 누가 산다.';
  const fuel = vehicle ? (ITEMS[vehicle.itemId].vehicle?.fuel ?? 0) : 0;
  if (!error && fuel && countItem(home?.storage ?? [], 'gasoline') < fuel) error = `${ITEMS[vehicle!.itemId].name}을(를) 타려면 휘발유 ${fuel}통이 필요하다.`;
  return { minutes, trips, weight, capacity, error };
}

export function startMove(c: Character, t: MoveTarget, picks: { uid: string; qty: number }[], vehicleUid?: string): string | null {
  const plan = planMove(c, t, picks, vehicleUid);
  if (plan.error) return plan.error;
  const s = store.s;
  return withBase(c.homeId, () => {
    const items: ItemStack[] = [];
    for (const p of picks) {
      const st = takeStack(s.storage, p.uid, p.qty);
      if (st) items.push(st);
    }
    const vehicle = vehicleUid ? takeStack(s.storage, vehicleUid, 1) : null;
    const fuel = vehicle ? (ITEMS[vehicle.itemId].vehicle?.fuel ?? 0) : 0;
    if (fuel) removeItem(s.storage, 'gasoline', fuel);
    delete c.sleepUntil;
    const now = Date.now();
    c.move = {
      ...(t.kind === 'base' ? { toBaseId: t.baseId } : { toStarter: t.starter }),
      fromBaseId: c.homeId,
      arriveAt: now + plan.minutes * 60000,
      startedAt: now,
      items,
      vehicle,
    };
    c.status = 'moving';
    addNews(`📦 ${c.name}이(가) 짐 ${items.reduce((n, x) => n + x.qty, 0)}개를 챙겨 ${moveTargetName(t)}(으)로 이사를 떠났다. (${plan.minutes}분)`);
    store.commit();
    return null;
  });
}

export function moveTargetName(t: MoveTarget | { toBaseId?: string; toStarter?: number }): string {
  const s = store.s;
  const baseId = 'kind' in t ? (t.kind === 'base' ? t.baseId : undefined) : t.toBaseId;
  const starter = 'kind' in t ? (t.kind === 'starter' ? t.starter : undefined) : t.toStarter;
  if (baseId) return s.bases[baseId]?.name ?? '다른 거점';
  const l = starterLabel(starter ?? 0);
  return `${l.area} ${l.kind}`;
}

/** 도착했으면 새 집에 자리 잡기 */
export function processMove(c: Character, now = Date.now()): boolean {
  const m = c.move;
  if (!m || now < m.arriveAt) return false;
  const s = store.s;
  let homeId = m.toBaseId && s.bases[m.toBaseId] ? m.toBaseId : undefined;
  if (!homeId && m.toStarter !== undefined) {
    // 그사이 누가 그 집에 자리 잡았으면 같이 산다
    homeId = Object.values(s.bases).find((b) => b.starter === m.toStarter)?.id ?? createHome(s, c.name, m.toStarter, false);
  }
  homeId ??= s.bases[m.fromBaseId] ? m.fromBaseId : Object.keys(s.bases)[0];
  const b = s.bases[homeId];
  for (const st of m.items) addStack(b.storage, st);
  if (m.vehicle) addStack(b.storage, m.vehicle);
  const n = m.items.reduce((k, x) => k + x.qty, 0);
  const from = s.bases[m.fromBaseId];
  c.homeId = homeId;
  c.status = 'base';
  delete c.move;
  const left = from ? residentsOf(s, from.id).length : 1;
  addNews(`🏠 ${c.name}이(가) [${b.name}](으)로 이사했다. (짐 ${n}개)${from && !left ? ` [${from.name}]은(는) 이제 빈 집이다.` : ''}`, 'good');
  if (now - m.arriveAt < 120000) bus.emit('alert', { characterId: c.id, title: `🏠 ${c.name} 이사 완료`, text: `${b.name}에 도착했다. 짐 ${n}개`, kind: 'good' });
  return true;
}

export const moveWeight = (items: ItemStack[]) => totalWeight(items);

// ───────────── 심부름: 다른 거점에 다녀오기 ─────────────

export interface ErrandPlan {
  minutes: number;
  trips: number;
  weight: number;
  capacity: number;
  error: string | null;
}

const weightOf = (store_: ItemStack[], picks: { uid: string; qty: number }[]) =>
  Math.round(
    picks.reduce((w, p) => {
      const st = store_.find((x) => x.uid === p.uid);
      return w + (st ? ITEMS[st.itemId].weight * Math.min(p.qty, st.qty) : 0);
    }, 0) * 10,
  ) / 10;

/** 가져오기는 손댈 수 있는 집(빈 집·내 집)에서만, 갖다주기는 어디든 */
export function planErrand(c: Character, baseId: string, give: { uid: string; qty: number }[], take: { uid: string; qty: number }[], player: string, vehicleUid?: string): ErrandPlan {
  const s = store.s;
  const home = s.bases[c.homeId];
  const target = s.bases[baseId];
  const vehicle = vehicleUid ? home?.storage.find((x) => x.uid === vehicleUid) : undefined;
  const gw = home ? weightOf(home.storage, give) : 0;
  const tw = target ? weightOf(target.storage, take) : 0;
  const capacity = moveCapacity(c, vehicle?.itemId);
  const weight = Math.max(gw, tw);
  const trips = Math.max(1, Math.ceil(weight / capacity));
  const speed = vehicle ? (ITEMS[vehicle.itemId].vehicle?.speed ?? 1) : 1;
  const oneWay = Math.max(1, Math.round(travelBase(basePos(c.homeId), basePos(baseId)) / 5 / speed));
  const minutes = oneWay * 2 * trips;
  let error: string | null = null;
  if (c.status !== 'base') error = `${c.name}은(는) 지금 거점에 없다.`;
  else if (c.crafting) error = '제작 중이다. 먼저 그만두게 하자.';
  else if (!target || baseId === c.homeId) error = '다녀올 다른 거점을 고르자.';
  else if (take.some((p) => p.qty > 0) && !canEditBase(baseId, player)) error = '남의 집 창고에서는 가져올 수 없다. (갖다주기만 가능)';
  else if (!give.some((p) => p.qty > 0) && !take.some((p) => p.qty > 0)) error = '가져오거나 갖다줄 물건을 고르자.';
  const fuel = vehicle ? (ITEMS[vehicle.itemId].vehicle?.fuel ?? 0) : 0;
  if (!error && fuel && countItem(home?.storage ?? [], 'gasoline') < fuel) error = `${ITEMS[vehicle!.itemId].name}을(를) 타려면 휘발유 ${fuel}통이 필요하다.`;
  return { minutes, trips, weight, capacity, error };
}

function canEditBase(baseId: string, player: string) {
  const who = residentsOf(store.s, baseId);
  return who.filter((c) => !c.npc).length === 0 || who.some((c) => c.owner === player);
}

export function startErrand(c: Character, baseId: string, give: { uid: string; qty: number }[], take: { uid: string; qty: number }[], player: string, vehicleUid?: string): string | null {
  const plan = planErrand(c, baseId, give, take, player, vehicleUid);
  if (plan.error) return plan.error;
  const s = store.s;
  const home = s.bases[c.homeId];
  const target = s.bases[baseId];
  const gave: ItemStack[] = [];
  for (const p of give) {
    if (p.qty <= 0) continue;
    const st = takeStack(home.storage, p.uid, p.qty);
    if (st) gave.push(st);
  }
  const took: ItemStack[] = [];
  for (const p of take) {
    if (p.qty <= 0) continue;
    const st = takeStack(target.storage, p.uid, p.qty);
    if (st) took.push(st);
  }
  const vehicle = vehicleUid ? takeStack(home.storage, vehicleUid, 1) : null;
  const fuel = vehicle ? (ITEMS[vehicle.itemId].vehicle?.fuel ?? 0) : 0;
  if (fuel) removeItem(home.storage, 'gasoline', fuel);
  delete c.sleepUntil;
  const now = Date.now();
  const ms = plan.minutes * 60000;
  c.errand = { baseId, startedAt: now, arriveAt: now + ms / 2, returnAt: now + ms, give: gave, take: took, delivered: false, vehicle };
  c.status = 'away';
  const what = [gave.length ? `${gave.reduce((n, x) => n + x.qty, 0)}개 갖다주기` : '', took.length ? `${took.reduce((n, x) => n + x.qty, 0)}개 가져오기` : ''].filter(Boolean).join(', ');
  addNews(`🚚 ${c.name}이(가) [${target.name}]에 다녀온다. (${what}, 왕복 ${plan.minutes}분)`);
  store.commit();
  return null;
}

/** 도착하면 물건을 내려놓고, 돌아오면 가져온 것을 집 창고에 */
export function processErrand(c: Character, now = Date.now()): boolean {
  const e = c.errand;
  if (!e) return false;
  const s = store.s;
  let changed = false;
  if (!e.delivered && now >= e.arriveAt) {
    const target = s.bases[e.baseId] ?? s.bases[c.homeId];
    for (const st of e.give) addStack(target.storage, st);
    if (e.give.length) addNews(`📦 ${c.name}이(가) [${target.name}]에 물건 ${e.give.reduce((n, x) => n + x.qty, 0)}개를 갖다 놓았다.`, 'good');
    e.give = [];
    e.delivered = true;
    changed = true;
  }
  if (now >= e.returnAt) {
    const home = s.bases[c.homeId] ?? Object.values(s.bases)[0];
    for (const st of e.take) addStack(home.storage, st);
    if (e.vehicle) addStack(home.storage, e.vehicle);
    const n = e.take.reduce((k, x) => k + x.qty, 0);
    addNews(`🏠 ${c.name}이(가) 심부름에서 돌아왔다.${n ? ` (가져온 물건 ${n}개)` : ''}`, 'good');
    if (now - e.returnAt < 120000) bus.emit('alert', { characterId: c.id, title: `🏠 ${c.name} 귀가`, text: n ? `물건 ${n}개를 가져왔다.` : '심부름을 마쳤다.', kind: 'good' });
    delete c.errand;
    c.status = 'base';
    changed = true;
  }
  return changed;
}
