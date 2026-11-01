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
import { addMemory, noteDay } from './story';
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
  if (t) {
    postRp('system', t, aId, bId);
    addMemory(a, 'bond', t);
    addMemory(b, 'bond', t);
  }
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
  noteDay(a, it.text(a.name, b.name));
  noteDay(b, it.text(a.name, b.name));
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

// ───────────── 미니게임 ─────────────

export type MiniGame = 'dice' | 'cards' | 'rps';
export const MINIGAMES: { id: MiniGame; icon: string; label: string }[] = [
  { id: 'dice', icon: '🎲', label: '주사위' },
  { id: 'cards', icon: '🃏', label: '카드 뽑기' },
  { id: 'rps', icon: '✊', label: '가위바위보' },
];

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RPS = ['✌️ 가위', '✊ 바위', '🖐️ 보'];

/** 둘이 미니게임을 한 판. 결과가 채팅에 남고, 이긴 쪽은 기분이 좋아진다 */
export function playMiniGame(aId: string, bId: string, game: MiniGame): string {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  if (!a || !b) return '';
  let sa = 0;
  let sb = 0;
  let detail = '';
  for (let round = 0; round < 5 && sa === sb; round++) {
    if (game === 'dice') {
      const ra = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      const rb = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      sa = ra[0] + ra[1];
      sb = rb[0] + rb[1];
      detail = `${a.name} 🎲${ra.join('+')}=${sa} vs ${b.name} 🎲${rb.join('+')}=${sb}`;
    } else if (game === 'cards') {
      const ia = Math.floor(Math.random() * 52);
      let ib = Math.floor(Math.random() * 51);
      if (ib >= ia) ib++;
      sa = (ia % 13) * 4 + Math.floor(ia / 13);
      sb = (ib % 13) * 4 + Math.floor(ib / 13);
      const name = (i: number) => `${SUITS[Math.floor(i / 13)]}${RANKS[i % 13]}`;
      detail = `${a.name} 🃏${name(ia)} vs ${b.name} 🃏${name(ib)}`;
    } else {
      const ia = Math.floor(Math.random() * 3);
      const ib = Math.floor(Math.random() * 3);
      detail = `${a.name} ${RPS[ia]} vs ${b.name} ${RPS[ib]}`;
      if (ia === ib) continue;
      const aWins = (ia + 2) % 3 === ib;
      sa = aWins ? 1 : 0;
      sb = aWins ? 0 : 1;
    }
  }
  const icon = MINIGAMES.find((g) => g.id === game)!.icon;
  const winner = sa > sb ? a : sb > sa ? b : null;
  const text = fixJosa(`${icon} ${detail} — ${winner ? `${winner.name}의 승리!` : '무승부!'}`);
  postRp('action', text, aId, bId, { emote: icon });
  if (winner) addEffect(winner, 'cheered', s.time, `${MINIGAMES.find((g) => g.id === game)!.label}에서 이겼다`, 60);
  bondUp(aId, bId, 1, `game_${game}`, 30);
  noteDay(a, `${b.name}와(과) ${MINIGAMES.find((g) => g.id === game)!.label} 놀이를 했다.${winner === a ? ' 내가 이겼다!' : winner ? ' 졌다. 다음엔 꼭.' : ''}`);
  noteDay(b, `${a.name}와(과) ${MINIGAMES.find((g) => g.id === game)!.label} 놀이를 했다.${winner === b ? ' 내가 이겼다!' : winner ? ' 졌다.' : ''}`);
  store.commit();
  return text;
}
