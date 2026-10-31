import { ITEMS, itemDef } from '../data/items';
import { JOB_BY_ID, SKILL_IDS, skillLevel, xpForLevel } from '../data/jobs';
import { addItem, addStack, makeStack, removeItem, totalWeight } from '../inventory';
import { addNews, store } from '../store';
import type { Appearance, Character, Injury, InjuryType, ItemStack, SkillId } from '../types';
import { clamp, uid } from '../util';
import { bus } from '../bus';

export function createCharacter(input: {
  name: string;
  owner: string;
  job: string;
  age: string;
  bio: string;
  appearance: Appearance;
  permadeathAllowed: boolean;
}): Character {
  const job = JOB_BY_ID[input.job] ?? JOB_BY_ID.unemployed;
  const skills = Object.fromEntries(SKILL_IDS.map((s) => [s, xpForLevel(job.skills[s] ?? 0)])) as Record<SkillId, number>;
  const c: Character = {
    id: uid('c'),
    name: input.name.trim() || '이름 없는 생존자',
    owner: input.owner,
    job: job.id,
    age: input.age,
    bio: input.bio,
    appearance: input.appearance,
    health: 100,
    hunger: 80,
    thirst: 80,
    energy: 90,
    infection: 0,
    injuries: [],
    skills,
    weapon: null,
    backpack: null,
    inventory: [],
    status: 'base',
    permadeathAllowed: input.permadeathAllowed,
    relations: [],
    journal: '',
    task: 'free',
    pos: { x: 8, y: 8 },
    createdAt: Date.now(),
    stats: { expeditions: 0, kills: 0, crafted: 0 },
  };
  for (const it of job.startItems) addItem(c.inventory, it.itemId, it.qty);
  return c;
}

export function level(c: Character, s: SkillId): number {
  return skillLevel(c.skills[s]);
}

/** 경험치 추가. 레벨업하면 메시지 반환 */
export function addXp(c: Character, s: SkillId, xp: number): string | null {
  const before = level(c, s);
  // 직업 보정: 학생은 배우는 속도 +25%
  const mult = c.job === 'student' ? 1.25 : 1;
  c.skills[s] += Math.round(xp * mult);
  const after = level(c, s);
  return after > before ? `${c.name}의 숙련도가 올랐다! (${s} Lv.${after})` : null;
}

export function carryCapacity(c: Character): number {
  const bag = c.backpack ? (ITEMS[c.backpack.itemId]?.backpack ?? 0) : 0;
  return 12 + bag;
}

export function carriedWeight(c: Character): number {
  return totalWeight(c.inventory) + (c.weapon ? itemDef(c.weapon.itemId).weight : 0);
}

const INJURY_NAME: Record<InjuryType, string> = { scratch: '긁힘', laceration: '열상', bite: '물림' };
export const injuryName = (t: InjuryType) => INJURY_NAME[t];

export function addInjury(c: Character, type: InjuryType): Injury {
  const inj: Injury = { id: uid('i'), type, bandaged: false, healHours: type === 'scratch' ? 6 : type === 'laceration' ? 24 : 36 };
  c.injuries.push(inj);
  if (type === 'bite') c.infection = clamp(c.infection + 35, 0, 99);
  return inj;
}

export function damage(c: Character, amount: number): void {
  c.health = clamp(c.health - amount, 0, 100);
  if (c.health <= 0) collapse(c);
}

/** 체력이 0이 되었을 때 처리. 영구 사망은 오너가 허용했을 때만. */
export function collapse(c: Character, reason = '쓰러졌다'): void {
  const s = store.s;
  const exp = s.expeditions[c.id];
  if (c.permadeathAllowed) {
    c.status = 'dead';
    c.health = 0;
    addNews(`${c.name}이(가) 세상을 떠났다… (${reason})`, 'bad');
    if (exp) {
      delete s.expeditions[c.id];
      c.inventory = [];
    }
    return;
  }
  c.health = 15;
  c.energy = Math.max(c.energy, 10);
  if (exp) {
    // 소지품 절반을 잃고 동료에게 구조된다
    const kept: ItemStack[] = [];
    let lost = 0;
    for (const st of c.inventory) {
      if (Math.random() < 0.5) kept.push(st);
      else lost += st.qty;
    }
    for (const st of kept) addStack(s.storage, st);
    c.inventory = [];
    delete s.expeditions[c.id];
    addNews(`${c.name}이(가) 탐험 중 ${reason}. 정신을 차려보니 거점이었다. (물건 ${lost}개 분실)`, 'bad');
  } else {
    addNews(`${c.name}이(가) ${reason}. 한동안 안정이 필요하다.`, 'bad');
  }
  c.status = 'down';
}

/** 아이템 효과 적용 (음식/음료/약). 성공 시 메시지 */
export function applyConsumable(c: Character, itemId: string): string {
  const d = itemDef(itemId);
  const e = d.consume;
  const msgs: string[] = [];
  if (d.treat === 'bandage') {
    const target = c.injuries.find((i) => !i.bandaged);
    if (!target) return `${c.name}에게 붕대를 감을 상처가 없다.`;
    target.bandaged = true;
    msgs.push(`${injuryName(target.type)}에 붕대를 감았다.`);
  }
  if (e) {
    if (e.hunger) c.hunger = clamp(c.hunger + e.hunger, 0, 100);
    if (e.thirst) c.thirst = clamp(c.thirst + e.thirst, 0, 100);
    if (e.energy) c.energy = clamp(c.energy + e.energy, 0, 100);
    if (e.health) c.health = clamp(c.health + e.health, 0, 100);
    if (e.infection) c.infection = clamp(c.infection + e.infection, 0, 100);
    if (e.sick && Math.random() < e.sick) {
      c.health = clamp(c.health - 8, 1, 100);
      c.thirst = clamp(c.thirst - 10, 0, 100);
      msgs.push('속이 좋지 않다… (배탈)');
    }
  }
  if (d.treat === 'disinfect') {
    msgs.push('상처를 소독했다.');
  }
  return `${c.name}: ${d.name} 사용. ${msgs.join(' ')}`.trim();
}

/** 인벤토리에서 아이템을 꺼내 사용 */
export function consumeFrom(inv: ItemStack[], c: Character, itemId: string): string | null {
  const d = itemDef(itemId);
  if (!d.consume && !d.treat) return null;
  if (d.treat === 'bandage' && !c.injuries.some((i) => !i.bandaged)) return `${c.name}에게 붕대를 감을 상처가 없다.`;
  if (!removeItem(inv, itemId, 1)) return null;
  const msg = applyConsumable(c, itemId);
  if (d.consume?.leaves) addItem(inv, d.consume.leaves, 1);
  if (d.category === 'medical') addXp(c, 'medical', 4);
  return msg;
}

export function equipFromStorage(c: Character, stackUid: string, slot: 'weapon' | 'backpack'): void {
  const s = store.s;
  const i = s.storage.findIndex((x) => x.uid === stackUid);
  if (i < 0) return;
  const st = s.storage[i];
  const one = st.qty > 1 ? { ...st, qty: 1, uid: uid('s') } : st;
  if (st.qty > 1) st.qty -= 1;
  else s.storage.splice(i, 1);
  const prev = c[slot];
  if (prev) addStack(s.storage, prev);
  c[slot] = one;
  store.commit();
}

export function unequip(c: Character, slot: 'weapon' | 'backpack'): void {
  const prev = c[slot];
  if (!prev) return;
  addStack(store.s.storage, prev);
  c[slot] = null;
  store.commit();
}

export function giveToCharacter(from: 'storage', to: Character, stackUid: string, giverId?: string): string | null {
  const s = store.s;
  void from;
  const i = s.storage.findIndex((x) => x.uid === stackUid);
  if (i < 0) return null;
  const st = s.storage[i];
  let moved: ItemStack;
  if (st.qty > 1) {
    st.qty -= 1;
    moved = st.durability !== undefined ? { ...st, qty: 1, uid: uid('s') } : makeStack(st.itemId, 1);
  } else {
    s.storage.splice(i, 1);
    moved = st;
  }
  addStack(to.inventory, moved);
  const giver = giverId ? s.characters[giverId] : null;
  const name = itemDef(moved.itemId).name;
  return giver ? `${giver.name}이(가) ${to.name}에게 ${name}을(를) 건넸다.` : `${to.name}이(가) ${name}을(를) 챙겼다.`;
}

export function moodText(c: Character): string {
  if (c.status === 'dead') return '사망';
  if (c.status === 'down') return '의식 불명 / 요양 중';
  if (c.infection >= 60) return '감염 악화';
  if (c.health < 30) return '중상';
  if (c.hunger < 15) return '굶주림';
  if (c.thirst < 15) return '심한 갈증';
  if (c.energy < 15) return '탈진';
  if (c.injuries.some((i) => !i.bandaged)) return '출혈 중';
  return '양호';
}

export function emitSpeech(characterId: string, text: string) {
  bus.emit('speech', { characterId, text });
}
