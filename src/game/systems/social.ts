import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { addStack, takeStack } from '../inventory';
import { store } from '../store';
import type { Character, ItemStack, RequestKind, SocialRequest } from '../types';
import { uid } from '../util';
import { bondUp, postRp } from './rp';

/**
 * 캐릭터 사이의 일: 근처 사람 · 교환 · 서로 치료 · 파티.
 * 요청은 상대 캐릭터 주인이 수락해야 시작된다 (내 캐릭터끼리는 바로).
 */

export const REQUEST_LABEL: Record<RequestKind, string> = { trade: '교환', heal: '치료', party: '파티 초대' };
/** 대답이 없으면 사라지는 시간 */
const EXPIRE_MS = 20 * 60000;

/** 같은 곳에 있는 사람: 같은 거점에 있거나, 같은 탐험지 현장에 있거나 */
export function nearby(c: Character): Character[] {
  const s = store.s;
  const here = (o: Character) => {
    if (o.id === c.id || o.status === 'dead') return false;
    const atHome = (x: Character) => x.status === 'base' || x.status === 'down';
    if (atHome(c) && atHome(o)) return o.homeId === c.homeId;
    const e1 = s.expeditions[c.id];
    const e2 = s.expeditions[o.id];
    return !!e1 && !!e2 && e1.locationId === e2.locationId && e1.phase === 'there' && e2.phase === 'there';
  };
  return s.characterOrder.map((id) => s.characters[id]).filter((o): o is Character => !!o && here(o));
}

export const partyOf = (c: Character): Character[] =>
  c.partyId ? store.s.characterOrder.map((id) => store.s.characters[id]).filter((o): o is Character => !!o && o.partyId === c.partyId && o.status !== 'dead') : [];

/** 요청 보내기. 내 캐릭터끼리면 바로 수락 */
export function sendRequest(kind: RequestKind, from: Character, to: Character, player: string): string | null {
  const s = store.s;
  if (!nearby(from).some((o) => o.id === to.id)) return `${to.name}은(는) 지금 같은 곳에 없다.`;
  if (kind === 'heal' && !to.injuries.length) return `${to.name}은(는) 다친 곳이 없다.`;
  if (kind === 'party' && from.partyId && from.partyId === to.partyId) return '이미 같은 파티다.';
  const dup = Object.values(s.requests).find((r) => r.kind === kind && r.from === from.id && r.to === to.id && (r.status === 'pending' || r.status === 'accepted'));
  if (dup) return '이미 보낸 요청이 있다.';
  const r: SocialRequest = { id: uid('q'), kind, from: from.id, to: to.id, at: Date.now(), status: 'pending' };
  s.requests[r.id] = r;
  if (to.owner === player) acceptRequest(r.id);
  else bus.emit('alert', { title: '요청을 보냈다', text: `${to.name}에게 ${REQUEST_LABEL[kind]} 요청 (${to.owner}의 대답을 기다리는 중)`, kind: 'info' });
  store.commit();
  return null;
}

export function acceptRequest(id: string) {
  const s = store.s;
  const r = s.requests[id];
  if (!r || r.status !== 'pending') return;
  const a = s.characters[r.from];
  const b = s.characters[r.to];
  if (!a || !b) return void (r.status = 'cancelled');
  if (r.kind === 'party') {
    // 보낸 사람 파티에 들어간다 (없으면 새로 만든다)
    const pid = a.partyId ?? uid('p');
    a.partyId = pid;
    b.partyId = pid;
    r.status = 'done';
    postRp('system', `${b.name}이(가) ${a.name}의 파티에 들어왔다.`, b.id);
    bondUp(a.id, b.id, 5, 'party', 240);
  } else {
    r.status = 'accepted';
    if (r.kind === 'trade') {
      a.offer = { reqId: r.id, items: [], ready: false };
      b.offer = { reqId: r.id, items: [], ready: false };
    }
  }
  store.commit();
}

export function declineRequest(id: string) {
  const r = store.s.requests[id];
  if (!r) return;
  r.status = r.status === 'pending' ? 'declined' : 'cancelled';
  for (const cid of [r.from, r.to]) {
    const c = store.s.characters[cid];
    if (c?.offer?.reqId === id) delete c.offer;
  }
  store.commit();
}

export function finishRequest(id: string) {
  const r = store.s.requests[id];
  if (!r) return;
  r.status = 'done';
  if (r.kind === 'heal') {
    const a = store.s.characters[r.from];
    const b = store.s.characters[r.to];
    if (a && b) postRp('system', `${a.name}이(가) ${b.name}의 상처를 돌봐 주었다.`, a.id, b.id);
    bondUp(r.from, r.to, 6, 'heal', 30);
  }
  store.commit();
}

export function leaveParty(c: Character) {
  const was = partyOf(c);
  delete c.partyId;
  // 혼자 남으면 파티 해산
  const left = was.filter((o) => o.id !== c.id);
  if (left.length === 1) delete left[0].partyId;
  postRp('system', `${c.name}이(가) 파티에서 나갔다.`, c.id);
  store.commit();
}

// ───────────── 교환 ─────────────

/** 교환에 올릴 수 있는 물건: 소지품 + (집에 있으면) 그 집 창고 */
export function tradeSources(c: Character): { src: 'inv' | 'storage'; list: ItemStack[] }[] {
  const out: { src: 'inv' | 'storage'; list: ItemStack[] }[] = [{ src: 'inv', list: c.inventory }];
  const home = store.s.bases[c.homeId];
  if ((c.status === 'base' || c.status === 'down') && home) out.push({ src: 'storage', list: home.storage });
  return out;
}

export function setOffer(c: Character, items: TradeItem[]) {
  if (!c.offer) return;
  c.offer.items = items.filter((x) => x.qty > 0);
  // 내용이 바뀌면 양쪽 다 다시 확인해야 한다
  c.offer.ready = false;
  const r = store.s.requests[c.offer.reqId];
  const other = r ? store.s.characters[r.from === c.id ? r.to : r.from] : undefined;
  if (other?.offer) other.offer.ready = false;
  store.commit();
}
export type TradeItem = { uid: string; qty: number; src: 'inv' | 'storage' };

/** 확정. 둘 다 확정하면 서로 물건이 바뀐다 */
export function readyTrade(c: Character): string | null {
  const s = store.s;
  if (!c.offer) return null;
  const r = s.requests[c.offer.reqId];
  if (!r || r.status !== 'accepted') return '교환이 끝났다.';
  const other = s.characters[r.from === c.id ? r.to : r.from];
  c.offer.ready = true;
  if (!other?.offer?.ready) {
    store.commit();
    return null;
  }
  // 둘 다 확정: 물건이 아직 있는지 확인하고 바꾼다
  const pull = (who: Character): ItemStack[] | null => {
    const got: ItemStack[] = [];
    for (const it of who.offer!.items) {
      const src = it.src === 'storage' ? s.bases[who.homeId]?.storage : who.inventory;
      const st = src ? takeStack(src, it.uid, it.qty) : null;
      if (!st) return null;
      got.push(st);
    }
    return got;
  };
  const fromA = pull(c);
  const fromB = fromA ? pull(other) : null;
  if (!fromA || !fromB) {
    // 되돌리기
    for (const st of fromA ?? []) addStack(c.inventory, st);
    c.offer.ready = false;
    store.commit();
    return '올린 물건 중 없어진 것이 있다. 다시 골라 주자.';
  }
  for (const st of fromA) addStack(other.inventory, st);
  for (const st of fromB) addStack(c.inventory, st);
  const names = (l: ItemStack[]) => l.map((x) => `${ITEMS[x.itemId].name}${x.qty > 1 ? ` ${x.qty}개` : ''}`).join(', ') || '없음';
  postRp('system', `🤝 ${c.name}과(와) ${other.name}이(가) 물건을 바꿨다. ${c.name}: ${names(fromA)} ↔ ${other.name}: ${names(fromB)}`, c.id);
  delete c.offer;
  delete other.offer;
  r.status = 'done';
  bondUp(c.id, other.id, 4, 'trade', 30);
  store.commit();
  return null;
}

/** 오래 대답이 없거나 끝난 요청 정리 */
export function cleanupRequests(now = Date.now()): boolean {
  const s = store.s;
  let changed = false;
  for (const [id, r] of Object.entries(s.requests ?? {})) {
    const stale = r.status === 'pending' ? now - r.at > EXPIRE_MS : r.status === 'accepted' ? now - r.at > 3 * EXPIRE_MS : now - r.at > 60000;
    if (stale) {
      for (const cid of [r.from, r.to]) {
        const c = s.characters[cid];
        if (c?.offer?.reqId === id) delete c.offer;
      }
      delete s.requests[id];
      changed = true;
    }
  }
  return changed;
}
