import { FURNITURE } from '../data/furniture';
import { ITEMS } from '../data/items';
import { JOB_BY_ID, type JobDef } from '../data/jobs';
import { LOCATION_BY_ID } from '../data/locations';
import { exclusive, MAX_TRAITS, TRAIT_BY_ID, TRAITS, WHEN_LABEL, type Mods, type TraitDef, type TraitWhen } from '../data/traits';
import { store } from '../store';
import type { Character, GameState } from '../types';
import { chance, hourOf } from '../util';

/**
 * 직업 + 특성 효과를 합친다. 수치만 바꾸고, 캐릭터의 말·행동은 오너가 정한다.
 */

type NumKey = Exclude<keyof Mods, 'find' | 'craftBonus' | 'xpSkill'>;

function carrying(c: Character, itemId: string): boolean {
  return c.inventory.some((x) => x.itemId === itemId) || c.weapon?.itemId === itemId || Object.values(c.wear ?? {}).some((x) => x?.itemId === itemId);
}

function condition(c: Character, w: TraitWhen, s: GameState): boolean {
  const e = s.expeditions?.[c.id];
  const there = e && e.phase === 'there';
  switch (w) {
    case 'cold':
      return s.weather?.kind === 'cold' && (c.status === 'base' ? !Object.values(s.bases[c.homeId]?.furniture ?? []).some((f) => ['f_campfire', 'f_fireplace', 'f_stove', 'f_gas_range'].includes(f.itemId)) : !c.wear?.top);
    case 'hot':
      return s.weather?.kind === 'heat';
    case 'wet':
      return !!c.effects?.some((x) => x.id === 'wet' && x.until > s.time);
    case 'night': {
      const h = hourOf(s.time);
      return h >= 21 || h < 5;
    }
    case 'expedition':
      return !!e;
    case 'base':
      return c.status === 'base';
    case 'solo':
      return !!e && !c.partyId;
    case 'dusty': {
      if (!there) return false;
      const loc = LOCATION_BY_ID[e.locationId];
      return !!loc && (/공장|공단|창고|화학|물류|공사/.test(loc.kind + loc.name) || !!loc.zones.find((z) => z.id === e.zoneId)?.toxic);
    }
    case 'poorBed': {
      const b = s.bases[c.homeId];
      const beds = b?.furniture.filter((f) => FURNITURE[f.itemId]?.use === 'sleep') ?? [];
      const bed = beds.find((f) => f.ownerId === c.id) ?? beds[0];
      return !bed || (FURNITURE[bed.itemId]?.sleepQuality ?? 0.7) < 0.8;
    }
    case 'firstVisit':
      return !!e && (s.locations[e.locationId]?.visits ?? 0) <= 1;
    case 'bleeding':
      return c.injuries.some((i) => !i.bandaged);
    case 'dark':
      return !!there && !!LOCATION_BY_ID[e.locationId]?.zones.find((z) => z.id === e.zoneId)?.spots.some((sp) => sp.dark);
  }
}

/** 이 특성이 지금 꺼져 있는 이유 (보완했거나 조건이 아님) */
export function traitInactive(c: Character, t: TraitDef, s: GameState = store.s): string | null {
  if (t.negate) {
    if (t.negate.item && carrying(c, t.negate.item)) return `${ITEMS[t.negate.item]?.name ?? ''} 덕분에 괜찮다`;
    if (t.negate.ownBed && s.bases[c.homeId]?.furniture.some((f) => f.ownerId === c.id && FURNITURE[f.itemId]?.use === 'sleep')) return '자기 침대가 있어 괜찮다';
    if (t.negate.effect && c.effects?.some((x) => x.id === t.negate!.effect && x.until > s.time)) return '약 기운으로 괜찮다';
  }
  if (t.when && !condition(c, t.when, s)) return `${WHEN_LABEL[t.when]}만`;
  return null;
}

function addMods(out: Mods, m: Mods) {
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === 'number') (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + v;
    else if (v && typeof v === 'object') {
      const key = k as 'find' | 'craftBonus' | 'xpSkill';
      const dst = (out[key] ??= {}) as Record<string, number>;
      for (const [kk, vv] of Object.entries(v as Record<string, number>)) dst[kk] = (dst[kk] ?? 0) + vv;
    }
  }
}

/** 지금 걸려 있는 직업·특성 효과 합계 */
export function modsOf(c: Character | undefined, s: GameState | null = store.has ? store.s : null): Mods {
  const out: Mods = {};
  if (!c) return out;
  const job = JOB_BY_ID[c.job];
  if (job) addMods(out, job.mods);
  if (!s) return out;
  for (const id of c.traits ?? []) {
    const t = TRAIT_BY_ID[id];
    if (!t || traitInactive(c, t, s)) continue;
    addMods(out, t.mods);
  }
  return out;
}

export const mod = (c: Character | undefined, k: NumKey): number => (modsOf(c)[k] as number | undefined) ?? 0;

/** 물건 종류별 추가 발견 */
export function findBonus(c: Character, itemId: string): number {
  const f = modsOf(c).find;
  if (!f) return 0;
  const cat = itemId.startsWith('ammo_') ? 'ammo' : ITEMS[itemId]?.category;
  return (cat ? (f[cat] ?? 0) : 0) + (cat === 'drink' ? 0 : 0);
}

/** 거점 주민 중 가장 높은 값 (생산 시설 보너스) */
export function bestAt(s: GameState, baseId: string, k: NumKey): number {
  let best = 0;
  for (const id of s.characterOrder) {
    const c = s.characters[id];
    if (c && c.homeId === baseId && c.status === 'base') best = Math.max(best, mod(c, k));
  }
  return best;
}

/** 담력이 낮으면 좀비를 보는 순간 겁에 질릴 수 있다 */
export function nerveCheck(c: Character): boolean {
  const n = mod(c, 'nerve');
  return n < 0 && chance(-n);
}

// ───────────── 설명 ─────────────

const LABEL: Record<NumKey, [string, 'pct' | 'pctInv' | 'kg' | 'pt' | 'flag']> = {
  hp: ['받는 피해', 'pctInv'], regen: ['체력 회복', 'pct'], heal: ['상처 회복 속도', 'pct'], sick: ['배탈·병 확률', 'pctInv'], infect: ['감염 진행', 'pctInv'],
  energy: ['기력 소모', 'pctInv'], hunger: ['배고픔', 'pctInv'], thirst: ['목마름', 'pctInv'], sleep: ['수면 회복', 'pct'], carry: ['소지 무게', 'kg'],
  travel: ['이동 시간', 'pctInv'], flee: ['도주', 'pct'], dodge: ['좀비에게 맞을 확률', 'pctInv'], hit: ['명중', 'pct'], melee: ['근접 명중', 'pct'], firearm: ['사격 명중', 'pct'],
  shove: ['밀쳐내기', 'pct'], wear: ['무기 내구 소모', 'pctInv'], noise: ['내는 소음', 'pctInv'], loot: ['수색 시 추가 발견', 'pct'], rare: ['희귀품 발견', 'pct'],
  secret: ['숨은 공간 발견', 'pct'], dark: ['어둠 속 놓침', 'pctInv'], detect: ['좀비 먼저 발견', 'pct'], clue: ['목표 단서 발견', 'pct'], nerve: ['담력', 'pct'],
  firstVisit: ['처음 가는 곳 추가 발견', 'pct'], cover: ['파티 엄호', 'pct'], med: ['치료 효과', 'pct'], care: ['남을 치료할 때 효과', 'pct'], medSave: ['약품 아낄 확률', 'pct'],
  craftSave: ['제작 재료 아낄 확률', 'pct'], xp: ['숙련 경험치', 'pct'], farm: ['텃밭·온실 생산', 'pct'], water: ['물 생산', 'pct'], facility: ['거점 생산 전체', 'pct'],
  trade: ['세력 호감 상승', 'pct'], bond: ['호감 상승', 'pct'], defense: ['습격 방어력', 'pt'], lockpick: ['자물쇠 따기', 'pct'], comfort: ['자는 침대 아늑함', 'pt'], carsick: ['먼 길을 차로 가면 멀미', 'flag'],
};
const CAT_LABEL: Record<string, string> = { food: '음식', drink: '음료', medical: '의약품', weapon: '무기', tool: '도구', material: '재료', furniture: '가구', prop: '소품', clothing: '옷', ammo: '탄약', backpack: '가방', rare: '희귀품' };
const GROUP_LABEL: Record<string, string> = { weapon: '무기', medical: '의료', food: '요리', furniture: '가구', building: '건축 자재', facility: '시설', tool: '도구' };
const SKILL_LABEL: Record<string, string> = { melee: '근접', firearm: '사격', scavenge: '수색', stealth: '은신', crafting: '제작', cooking: '요리', medical: '의료', farming: '농업' };

const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;

/** 효과를 한 줄로 */
export function describeMods(m: Mods): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (typeof v !== 'number' || !v) continue;
    const [label, kind] = LABEL[k as NumKey] ?? [k, 'pct'];
    if (kind === 'pct') out.push(`${label} ${pct(v)}`);
    else if (kind === 'pctInv') out.push(`${label} ${pct(-v)}`);
    else if (kind === 'kg') out.push(`${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}kg`);
    else if (kind === 'pt') out.push(`${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
    else out.push(label);
  }
  for (const [k, v] of Object.entries(m.find ?? {})) if (v) out.push(`${CAT_LABEL[k] ?? k} 발견 ${pct(v)}`);
  for (const [k, v] of Object.entries(m.craftBonus ?? {})) if (v) out.push(`${GROUP_LABEL[k] ?? k} 제작 시 하나 더 ${pct(v)}`);
  for (const [k, v] of Object.entries(m.xpSkill ?? {})) if (v) out.push(`${SKILL_LABEL[k] ?? k} 경험치 ${pct(v)}`);
  return out;
}

export function describeTrait(t: TraitDef): string {
  const parts = describeMods(t.mods);
  for (const [k, v] of Object.entries(t.skills ?? {})) parts.push(`${SKILL_LABEL[k]} 숙련 +${v}`);
  let s = parts.join(', ');
  if (t.when) s = `${WHEN_LABEL[t.when]}: ${s}`;
  if (t.negate) s += ` (${t.negate.text})`;
  return s;
}

export function describeJob(j: JobDef): string {
  const sk = Object.entries(j.skills).map(([k, v]) => `${SKILL_LABEL[k]} ${v}`).join(' · ');
  return [sk, ...describeMods(j.mods), j.pts ? `특성 포인트 +${j.pts}` : ''].filter(Boolean).join(', ');
}

// ───────────── 고르기 ─────────────

/** 남은 포인트 (0 이상이어야 한다) */
export function pointsLeft(jobId: string, traits: string[]): number {
  let p = JOB_BY_ID[jobId]?.pts ?? 0;
  for (const id of traits) {
    const t = TRAIT_BY_ID[id];
    if (!t || t.kind === 'earned') continue;
    p += t.kind === 'neg' ? t.pts : -t.pts;
  }
  return p;
}

export function canAddTrait(_jobId: string, traits: string[], id: string): string | null {
  const t = TRAIT_BY_ID[id];
  if (!t || t.kind === 'earned') return '고를 수 없는 특성';
  if (traits.includes(id)) return null;
  if (traits.length >= MAX_TRAITS) return `특성은 ${MAX_TRAITS}개까지`;
  const ex = traits.find((x) => exclusive(x, id));
  if (ex) return `「${TRAIT_BY_ID[ex].name}」과(와) 함께 고를 수 없다`;
  return null;
}

export function validTraits(jobId: string, traits: string[]): string | null {
  if (pointsLeft(jobId, traits) < 0) return '포인트가 모자란다. 부정 특성을 고르거나 긍정 특성을 빼자.';
  if (traits.length > MAX_TRAITS) return `특성은 ${MAX_TRAITS}개까지`;
  return null;
}

/** 아무렇게나 골라 주기 */
export function randomTraits(jobId: string): string[] {
  const pos = TRAITS.filter((t) => t.kind === 'pos');
  const neg = TRAITS.filter((t) => t.kind === 'neg');
  for (let tries = 0; tries < 50; tries++) {
    const pick: string[] = [];
    const nNeg = 1 + Math.floor(Math.random() * 3);
    const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
    for (const t of shuffle(neg)) {
      if (pick.length >= nNeg) break;
      if (!canAddTrait(jobId, pick, t.id)) pick.push(t.id);
    }
    for (const t of shuffle(pos)) {
      if (pointsLeft(jobId, [...pick, t.id]) < 0) continue;
      if (!canAddTrait(jobId, pick, t.id)) pick.push(t.id);
      if (pick.length >= 6 || pointsLeft(jobId, pick) <= 1) break;
    }
    if (!validTraits(jobId, pick)) return pick;
  }
  return [];
}

/** 시작 숙련에 특성 보정을 더한다 */
export function traitSkills(traits: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of traits) for (const [k, v] of Object.entries(TRAIT_BY_ID[id]?.skills ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

// ───────────── 성장형 ─────────────

const EARN_CHECK: Record<string, (c: Character, s: GameState) => boolean> = {
  veteran: (c) => c.stats.kills >= 50,
  iron_will: (c) => (c.memories ?? []).filter((m) => m.kind === 'resolve').length >= 3,
  scarred: (c) => (c.stats.downs ?? 0) >= 3,
  seasoned_scav: (c) => c.stats.expeditions >= 20,
  survivor: (c, s) => (Date.now() - c.createdAt) / 86400000 >= 30 || s.time / 1440 >= 30,
  anchor: (c) => c.relations.filter((r) => (r.bond ?? 0) >= 60).length >= 3,
  master_crafter: (c) => c.stats.crafted >= 50,
};

/** 얻을 수 있게 된 성장형 특성 (오너가 받을지 고른다) */
export function earnable(c: Character, s: GameState = store.s): TraitDef[] {
  return TRAITS.filter((t) => t.kind === 'earned' && !(c.traits ?? []).includes(t.id) && !(c.declined ?? []).includes(t.id) && EARN_CHECK[t.id]?.(c, s));
}
