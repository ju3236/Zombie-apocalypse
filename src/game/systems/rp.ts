import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { removeItem } from '../inventory';
import { addNews, sessionStore, store } from '../store';
import type { RpKind, RpMessage } from '../types';
import { fixJosa, uid } from '../util';
import { addXp, injuryName } from './character';

export function postRp(kind: RpKind, text: string, characterId?: string, targetId?: string): RpMessage | null {
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
  };
  s.rpLog.push(m);
  if (s.rpLog.length > 2000) s.rpLog.splice(0, s.rpLog.length - 2000);
  if (characterId && (kind === 'say' || kind === 'action')) {
    bus.emit('speech', { characterId, text: kind === 'action' ? `*${t}*` : t });
  }
  store.commit();
  return m;
}

/** 치료하기: 창고의 붕대/소독약을 사용해 다른 캐릭터를 돌본다 */
export function treat(healerId: string, targetId: string): string {
  const s = store.s;
  const healer = s.characters[healerId];
  const target = s.characters[targetId];
  if (!healer || !target) return '';
  const wound = target.injuries.find((i) => !i.bandaged);
  const parts: string[] = [];
  if (wound) {
    if (!removeItem(s.storage, 'bandage', 1)) return '창고에 붕대가 없다.';
    wound.bandaged = true;
    parts.push(`${injuryName(wound.type)}에 붕대를 감아주었다`);
  }
  if (target.infection > 0 && removeItem(s.storage, 'disinfectant', 1)) {
    target.infection = Math.max(0, target.infection - 12);
    parts.push('상처를 소독했다');
  }
  if (!parts.length) {
    target.health = Math.min(100, target.health + 3);
    parts.push('상태를 살펴주었다');
  }
  const msg = addXp(healer, 'medical', 6);
  if (msg) addNews(msg, 'good');
  const text = `${healer.name}이(가) ${target.name}을(를) 치료했다: ${parts.join(', ')}.`;
  postRp('system', text, healerId, targetId);
  return text;
}

export function sitTogether(aId: string, bId: string) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  bus.emit('sitTogether', { a: aId, b: bId });
  postRp('system', `${a.name}이(가) ${b.name}의 옆에 함께 앉았다.`, aId, bId);
}

export function support(aId: string, bId: string) {
  const s = store.s;
  const a = s.characters[aId];
  const b = s.characters[bId];
  b.energy = Math.min(100, b.energy + 5);
  a.energy = Math.max(0, a.energy - 3);
  postRp('system', `${a.name}이(가) ${b.name}을(를) 부축했다.`, aId, bId);
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
  return text;
}
