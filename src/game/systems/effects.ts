import type { Character, GameState } from '../types';
import { isCold } from './weather';
import { store } from '../store';

/**
 * 버프·디버프.
 * - 시간 효과: 먹거나 마시거나 잠을 자서 생기고, 정해진 시간이 지나면 사라진다 (c.effects)
 * - 상태 효과: 수치 때문에 생기고, 수치가 회복되면 사라진다 (배고픔·탈진·출혈 …)
 */

export interface Mods {
  /** 기력이 줄어드는 속도 배수 */
  energyDrain: number;
  hungerDrain: number;
  thirstDrain: number;
  /** 자연 회복 배수 */
  regen: number;
  /** 전투 명중 (더하기) */
  hit: number;
  /** 도주 성공 (더하기) */
  flee: number;
}

interface EffectDef {
  name: string;
  icon: string;
  kind: 'buff' | 'debuff';
  /** 효과 설명 (화면 표시) */
  desc: string;
  mods?: Partial<Mods>;
  /** 시간 효과: 지속 시간(분) */
  minutes?: number;
  /** 해소 방법 (디버프) */
  cure?: string;
}

export const EFFECTS: Record<string, EffectDef> = {
  // ── 시간 효과
  well_fed: { name: '든든함', icon: '🍲', kind: 'buff', minutes: 240, desc: '기력 소모 -25%, 자연 회복 +30%', mods: { energyDrain: 0.75, regen: 1.3 } },
  caffeine: { name: '카페인', icon: '☕', kind: 'buff', minutes: 120, desc: '기력 소모 -40%, 명중 +5%', mods: { energyDrain: 0.6, hit: 0.05 } },
  sugar: { name: '당 충전', icon: '🍫', kind: 'buff', minutes: 60, desc: '기력 소모 -20%', mods: { energyDrain: 0.8 } },
  refreshed: { name: '개운함', icon: '🌤️', kind: 'buff', minutes: 180, desc: '기력 소모 -20%, 명중 +5%, 도주 +5%', mods: { energyDrain: 0.8, hit: 0.05, flee: 0.05 } },
  painkiller: { name: '진통제', icon: '💊', kind: 'buff', minutes: 240, desc: '통증을 느끼지 않는다 (통증 효과 무시)' },
  food_poison: { name: '배탈', icon: '🤢', kind: 'debuff', minutes: 360, desc: '수분 소모 ×2, 자연 회복 없음', mods: { thirstDrain: 2, regen: 0 }, cure: '약초·구급상자를 쓰면 바로 낫는다. 끓인 물·생수를 마시면 남은 시간이 절반으로' },
  shaken: { name: '겁에 질림', icon: '😨', kind: 'debuff', minutes: 180, desc: '명중 -10%, 도주 +5%', mods: { hit: -0.1, flee: 0.05 }, cure: '누가 위로해 주거나(근처 사람 → 위로하기), 1시간 이상 자고 일어나면 사라진다' },
  cheered: { name: '기분 좋음', icon: '😊', kind: 'buff', minutes: 360, desc: '기력 소모 -15%, 명중 +3%', mods: { energyDrain: 0.85, hit: 0.03 } },
  // ── 상태 효과
  trusted: { name: '든든한 동료', icon: '💛', kind: 'buff', desc: '믿는 사람이 곁에 있다: 기력 소모 -10%, 명중 +5%', mods: { energyDrain: 0.9, hit: 0.05 } },
  sleeping: { name: '수면 중', icon: '💤', kind: 'buff', desc: '기력 회복, 배고픔·목마름이 천천히 줄어든다' },
  hungry: { name: '굶주림', icon: '🍽️', kind: 'debuff', desc: '기력 소모 +30%. 포만이 0이면 체력이 줄어든다', mods: { energyDrain: 1.3 }, cure: '음식을 먹는다 (창고에 있으면 거점에서 자동으로 먹음)' },
  thirsty: { name: '심한 갈증', icon: '💧', kind: 'debuff', desc: '기력 소모 +30%. 수분이 0이면 체력이 줄어든다', mods: { energyDrain: 1.3 }, cure: '물을 마신다 (끓인 물·생수, 더러운 물은 배탈 위험)' },
  exhausted: { name: '탈진', icon: '😵', kind: 'debuff', desc: '명중 -15%, 도주 -20%', mods: { hit: -0.15, flee: -0.2 }, cure: '재우기, 또는 커피·초콜릿·에너지바로 잠깐 버티기' },
  bleeding: { name: '출혈', icon: '🩸', kind: 'debuff', desc: '체력이 계속 줄고 감염 위험이 오른다', cure: '상처에 붕대 감기 (몸 상태에서 다친 부위를 눌러 치료)' },
  pain: { name: '통증', icon: '🤕', kind: 'debuff', desc: '명중 -8%, 기력 소모 +15%', mods: { hit: -0.08, energyDrain: 1.15 }, cure: '진통제를 먹으면 4시간 동안 사라진다. 상처가 다 나으면 없어진다' },
  infected: { name: '감염', icon: '🦠', kind: 'debuff', desc: '감염이 진행된다. 60 이상이면 체력이 줄어든다', cure: '항생제(-25), 소독약(-12), 약초·구급상자(-5). 30 아래로 내려가면 몸이 스스로 이겨낸다' },
  wet: { name: '젖음', icon: '💦', kind: 'debuff', minutes: 120, desc: '기력 소모 +15%', mods: { energyDrain: 1.15 }, cure: '거점에 불(모닥불·벽난로·스토브)이 있으면 돌아와서 바로 마른다. 아니면 시간이 지나면' },
  cold: { name: '추위', icon: '🥶', kind: 'debuff', desc: '기력 소모 +20%, 배고픔 +20%', mods: { energyDrain: 1.2, hungerDrain: 1.2 }, cure: '거점에 불(모닥불·벽난로·캠핑 스토브·가스레인지) 놓기, 탐험 중엔 상의 입기. 한파가 끝나면 사라짐' },
  hot: { name: '더위', icon: '🥵', kind: 'debuff', desc: '목마름 ×1.5', mods: { thirstDrain: 1.5 }, cure: '물을 자주 마시자. 폭염이 끝나면 사라짐' },
  wounded: { name: '중상', icon: '❤️‍🩹', kind: 'debuff', desc: '명중 -10%', mods: { hit: -0.1 }, cure: '배고프지 않고 출혈이 없으면 쉬면서 회복 (자면 더 빠름, 의료 캐비닛이 있으면 +30%), 구급상자' },
};

/** 먹고 마신 것 → 생기는 효과 */
export const ITEM_EFFECT: Record<string, string> = {
  stew: 'well_fed', rice_bowl: 'well_fed', grilled_meat: 'well_fed', grilled_fish: 'well_fed', roasted_veg: 'well_fed',
  coffee: 'caffeine', chocolate: 'sugar', energy_bar: 'sugar', honey: 'sugar', soda: 'sugar', sports_drink: 'sugar',
  painkiller: 'painkiller',
};

export function addEffect(c: Character, id: string, now: number, source: string, minutes?: number) {
  const def = EFFECTS[id];
  const dur = minutes ?? def?.minutes ?? 60;
  c.effects ??= [];
  const ex = c.effects.find((e) => e.id === id);
  if (ex) {
    ex.until = Math.max(ex.until, now + dur);
    ex.source = source;
  } else c.effects.push({ id, until: now + dur, source });
}

export function expireEffects(c: Character, now: number) {
  if (c.effects?.length) c.effects = c.effects.filter((e) => e.until > now);
}

export interface ActiveEffect {
  id: string;
  name: string;
  icon: string;
  kind: 'buff' | 'debuff';
  desc: string;
  /** 생긴 이유 */
  reason: string;
  /** 남은 시간(분) 또는 없어지는 조건 */
  left: number | null;
  until: string;
  /** 해소 방법 */
  cure?: string;
}

const has = (c: Character, id: string, now: number) => !!c.effects?.some((e) => e.id === id && e.until > now);

/** 지금 걸려 있는 모든 효과 (시간 효과 + 상태 효과) */
export function activeEffects(c: Character, s: Pick<GameState, 'time'> & Partial<Pick<GameState, 'weather' | 'base' | 'bases'>>): ActiveEffect[] {
  const now = s.time;
  const out: ActiveEffect[] = [];
  const push = (id: string, reason: string, left: number | null, until: string) => {
    const d = EFFECTS[id];
    out.push({ id, name: d.name, icon: d.icon, kind: d.kind, desc: d.desc, reason, left, until, cure: d.cure });
  };
  if ((c.sleepUntil ?? 0) > now && c.status === 'base') push('sleeping', '직접 재웠다', c.sleepUntil! - now, '정한 시간이 지나거나 깨우면');
  for (const e of c.effects ?? []) if (e.until > now && EFFECTS[e.id]) push(e.id, e.source, e.until - now, '시간이 지나면');
  const buddy = trustedNearby(c);
  if (buddy) push('trusted', `${buddy.name}이(가) 곁에 있다`, null, '함께 있는 동안 (호감 60 이상인 사람)');
  if (c.hunger < 15) push('hungry', `포만 ${Math.round(c.hunger)}`, null, '포만 15 이상');
  if (c.thirst < 15) push('thirsty', `수분 ${Math.round(c.thirst)}`, null, '수분 15 이상');
  if (c.energy < 25) push('exhausted', `기력 ${Math.round(c.energy)}`, null, '기력 25 이상 (자거나 커피·단것)');
  if (c.health < 30) push('wounded', `체력 ${Math.round(c.health)}`, null, '체력 30 이상');
  const open = c.injuries.filter((i) => !i.bandaged).length;
  if (open) push('bleeding', `붕대 안 감은 상처 ${open}곳`, null, '상처에 붕대 감기');
  if (c.injuries.length && !has(c, 'painkiller', now)) push('pain', `상처 ${c.injuries.length}곳`, null, '상처가 낫거나 진통제');
  if (isCold(c, s)) push('cold', c.status === 'expedition' ? '한파에 상의 없이 밖에 있다' : '한파인데 거점에 불이 없다', null, '불 피우기 / 상의 입기 / 한파가 끝나면');
  if (s.weather?.kind === 'heat' && c.status !== 'dead') push('hot', '폭염', null, '폭염이 끝나면');
  if (c.infection >= 30) push('infected', `감염 ${Math.round(c.infection)}`, null, '감염 30 미만 (항생제)');
  return out;
}

/** 효과를 모두 합친 배수 */
export function effectMods(c: Character, s: Pick<GameState, 'time'> & Partial<Pick<GameState, 'weather' | 'base' | 'bases'>>): Mods {
  const m: Mods = { energyDrain: 1, hungerDrain: 1, thirstDrain: 1, regen: 1, hit: 0, flee: 0 };
  for (const e of activeEffects(c, s)) {
    const d = EFFECTS[e.id].mods;
    if (!d) continue;
    if (d.energyDrain !== undefined) m.energyDrain *= d.energyDrain;
    if (d.hungerDrain !== undefined) m.hungerDrain *= d.hungerDrain;
    if (d.thirstDrain !== undefined) m.thirstDrain *= d.thirstDrain;
    if (d.regen !== undefined) m.regen *= d.regen;
    if (d.hit) m.hit += d.hit;
    if (d.flee) m.flee += d.flee;
  }
  return m;
}

export function formatLeft(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분` : `${m}분`;
}

/** 먹거나 써서 디버프를 푸는 아이템. 풀렸으면 메시지 */
export function cureByItem(c: Character, itemId: string, now: number): string | null {
  const fp = c.effects?.find((e) => e.id === 'food_poison' && e.until > now);
  if (!fp || !c.effects) return null;
  if (itemId === 'herbs' || itemId === 'first_aid') {
    c.effects = c.effects.filter((e) => e !== fp);
    return '배탈이 가라앉았다.';
  }
  if (itemId === 'boiled_water' || itemId === 'water_bottle') {
    fp.until = now + Math.ceil((fp.until - now) / 2);
    return '깨끗한 물을 마시니 속이 조금 나아졌다.';
  }
  return null;
}

/** 잠에서 깰 때: 1시간 이상 잤으면 겁에 질림이 풀린다 */
export function cureBySleep(c: Character, slept: number) {
  if (slept >= 60 && c.effects) c.effects = c.effects.filter((e) => e.id !== 'shaken');
}

/** 같은 곳에 호감 60 이상인 사람이 있는지 */
function trustedNearby(c: Character): Character | undefined {
  if (!store.has || !c.relations?.length) return undefined;
  const s = store.s;
  const atHome = (x: Character) => x.status === 'base' || x.status === 'down';
  for (const r of c.relations) {
    if ((r.bond ?? 0) < 60) continue;
    const o = s.characters[r.targetId];
    if (!o || o.status === 'dead') continue;
    if (atHome(c) && atHome(o) && o.homeId === c.homeId) return o;
    const e1 = s.expeditions?.[c.id];
    const e2 = s.expeditions?.[o.id];
    if (e1 && e2 && e1.locationId === e2.locationId && e1.phase === 'there' && e2.phase === 'there') return o;
  }
  return undefined;
}
