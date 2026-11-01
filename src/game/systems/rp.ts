import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { addNews, sessionStore, store } from '../store';
import type { RpKind, RpMessage } from '../types';
import { fixJosa, uid } from '../util';
import { addXp, injuryName } from './character';
import { addBond, tierUpText } from './bonds';
import { addEffect } from './effects';
import { basePos } from './expedition';
import { travelBase } from '../world/cityGen';
import { BANDAGE_ITEMS, bandageWound, DISINFECT_ITEMS, disinfectWound, PART_LABEL, supplyCount, worstWound } from './body';

export function postRp(kind: RpKind, text: string, characterId?: string, targetId?: string, extra?: Pick<RpMessage, 'emote' | 'anim' | 'deliverAt'>): RpMessage | null {
  const s = store.s;
  const t = text.trim();
  if (!t) return null;
  const m: RpMessage = {
    id: uid('m'),
    t: s.time,
    real: Date.now(),
    kind,
    characterId,
    targetId,
    owner: sessionStore.get().player,
    text: kind === 'system' ? fixJosa(t) : t,
    ...(extra ?? {}),
  };
  s.rpLog.push(m);
  if (s.rpLog.length > 2000) s.rpLog.splice(0, s.rpLog.length - 2000);
  // 말풍선은 거점 화면이 채팅 기록을 보고 띄운다 (같이 사는 친구 화면에도 뜨도록)
  store.commit();
  return m;
}

/** 치료하기: 창고의 붕대/소독약을 사용해 다른 캐릭터를 돌본다 */
export function treat(healerId: string, targetId: string): string {
  const s = store.s;
  const healer = s.characters[healerId];
  const target = s.characters[targetId];
  if (!healer || !target) return '';
  // 가장 심한 상처부터: 소독 → 붕대 (치료자의 소지품·창고에서)
  const parts: string[] = [];
  const dirty = worstWound(target, 'disinfect');
  const disItem = DISINFECT_ITEMS.find((id) => supplyCount(healer, id) > 0);
  if (dirty && disItem) {
    disinfectWound(target, dirty.id, disItem, healer);
    parts.push(`${PART_LABEL[dirty.part ?? 'torso']} ${injuryName(dirty.type)}을(를) 소독했다`);
  }
  const wound = worstWound(target, 'bandage');
  if (wound) {
    const bItem = BANDAGE_ITEMS.find((id) => supplyCount(healer, id) > 0);
    if (!bItem) return parts.length ? `${parts.join(', ')}. 붕대가 없다.` : '붕대도 천 조각도 없다.';
    bandageWound(target, wound.id, bItem, healer);
    parts.push(`${PART_LABEL[wound.part ?? 'torso']} ${injuryName(wound.type)}에 ${ITEMS[bItem].name}을(를) 감아주었다`);
  }
  if (!parts.length) {
    target.health = Math.min(100, target.health + 3);
    parts.push('상태를 살펴주었다');
  }
  const msg = addXp(healer, 'medical', 6);
  if (msg) addNews(msg, 'good');
  const text = `${healer.name}이(가) ${target.name}을(를) 치료했다: ${parts.join(', ')}.`;
  postRp('system', text, healerId, targetId);
  bondUp(healerId, targetId, 4, 'heal', 30);
  return text;
}

export function sitTogether(aId: string, bId: string) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  bus.emit('sitTogether', { a: aId, b: bId });
  postRp('system', `${a.name}이(가) ${b.name}의 옆에 함께 앉았다.`, aId, bId);
  bondUp(aId, bId, 2, 'sit');
}

export function support(aId: string, bId: string) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  b.energy = Math.min(100, b.energy + 5);
  a.energy = Math.max(0, a.energy - 3);
  postRp('system', `${a.name}이(가) ${b.name}을(를) 부축했다.`, aId, bId);
  bondUp(aId, bId, 3, 'support');
}

export function giftFromPersonal(fromId: string, toId: string, stackUid: string): string | null {
  const s = store.s;
  const a = s.characters[fromId];
  const b = s.characters[toId];
  const i = a.inventory.findIndex((x) => x.uid === stackUid);
  if (i < 0) return null;
  const st = a.inventory[i];
  let moved = st;
  if (st.qty > 1) {
    st.qty -= 1;
    moved = { ...st, uid: uid('s'), qty: 1 };
  } else a.inventory.splice(i, 1);
  const ex = b.inventory.find((x) => x.itemId === moved.itemId && x.durability === undefined && moved.durability === undefined);
  if (ex) ex.qty += moved.qty;
  else b.inventory.push(moved);
  const text = `${a.name}이(가) ${b.name}에게 ${ITEMS[moved.itemId].name}을(를) 선물했다.`;
  postRp('system', text, fromId, toId);
  bondUp(fromId, toId, 3, 'gift', 30);
  return text;
}

/** 호감 올리기 + 관계 단계가 오르면 채팅에 남긴다 */
export function bondUp(aId: string, bId: string, amount: number, key?: string, cooldown?: number) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  if (!a || !b) return;
  const up = addBond(a, b, amount, key, cooldown);
  const t = tierUpText(a, b, up);
  if (t) postRp('system', t, aId, bId);
}

export type Interaction = 'hug' | 'highfive' | 'comfort';
export const INTERACTIONS: { id: Interaction; icon: string; label: string; text: (a: string, b: string) => string }[] = [
  { id: 'hug', icon: '🤗', label: '안아 주기', text: (a, b) => `${a}이(가) ${b}을(를) 꼭 안아 주었다.` },
  { id: 'highfive', icon: '✋', label: '하이파이브', text: (a, b) => `${a}이(가) ${b}과(와) 손바닥을 마주쳤다.` },
  { id: 'comfort', icon: '💬', label: '위로하기', text: (a, b) => `${a}이(가) ${b}의 어깨를 토닥이며 위로했다.` },
];

/** 상호작용: 채팅에 남고, 거점 화면에서 둘이 다가가 감정 표현. 호감이 오르고 기분이 좋아진다 */
export function interact(aId: string, bId: string, kind: Interaction) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  if (!a || !b) return;
  const it = INTERACTIONS.find((x) => x.id === kind)!;
  postRp('action', fixJosa(it.text(a.name, b.name)), aId, bId, { emote: it.icon, anim: kind });
  // 위로받으면 겁에 질린 마음이 가라앉는다
  if (kind === 'comfort' && b.effects?.some((e) => e.id === 'shaken')) {
    b.effects = b.effects.filter((e) => e.id !== 'shaken');
    postRp('system', `${b.name}의 떨림이 조금 가라앉았다.`, bId);
  }
  addEffect(b, 'cheered', s.time, `${a.name}의 ${it.label}`, 60);
  if (kind !== 'comfort') addEffect(a, 'cheered', s.time, `${b.name}과(와) ${it.label}`, 60);
  bondUp(aId, bId, 2, kind, 60);
  store.commit();
}

export const EMOTES = ['😊', '😂', '😢', '😡', '😳', '😴', '❤️', '💦', '❗', '❓'];

/** 감정 표현: 머리 위에 큰 말풍선 */
export function emote(cId: string, e: string) {
  postRp('action', e, cId, undefined, { emote: e });
}

/**
 * 편지: 같은 거점이면 바로, 다른 거점이면 걸어서 가는 만큼 실제 시간이 걸린다.
 * 배달 중에는 내용이 보이지 않는다. 돌아오는 시간(분)
 */
export function sendLetter(fromId: string, toId: string, text: string): number {
  const s = store.s;
  const a = s.characters[fromId];
  const b = s.characters[toId];
  if (!a || !b) return 0;
  const near = a.homeId === b.homeId && (b.status === 'base' || b.status === 'down');
  const mins = near ? 0 : Math.max(2, Math.round(travelBase(basePos(a.homeId), basePos(b.homeId)) / 5));
  postRp('letter', text, fromId, toId, mins ? { deliverAt: Date.now() + mins * 60000 } : undefined);
  return mins;
}
