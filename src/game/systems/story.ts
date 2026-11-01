import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { LOCATION_BY_ID, LOCATIONS } from '../data/locations';
import { addItem } from '../inventory';
import { addNews, store } from '../store';
import type { Character, GameState, Memory, MemoryKind } from '../types';
import { chance, dayOf, fixJosa, pick } from '../util';
import { addEffect } from './effects';

/**
 * 캐릭터 이야기: 자동 일기 · 기억과 트라우마 · 개인 목표.
 */

// ───────────── 오늘 있었던 일 → 일기 ─────────────

/** 오늘 있었던 일을 적어 둔다 (하루가 지나면 일기가 된다) */
export function noteDay(c: Character | undefined, text: string) {
  if (!c || c.status === 'dead') return;
  c.today ??= [];
  const t = fixJosa(text);
  if (c.today.includes(t)) return;
  c.today.push(t);
  if (c.today.length > 8) c.today.splice(0, c.today.length - 8);
}

const OPENERS: [number, string[]][] = [
  [75, ['오늘은 꽤 괜찮은 하루였다.', '오랜만에 숨 돌릴 틈이 있었다.', '이런 날만 계속되면 좋겠다.']],
  [45, ['그럭저럭 버틴 하루.', '별일 없이 하루가 갔다. 그게 다행이다.', '오늘도 살아남았다.']],
  [0, ['힘든 하루였다.', '몸도 마음도 무겁다.', '언제까지 이렇게 버틸 수 있을까.']],
];

function mood(c: Character): number {
  return (c.health + c.hunger + c.thirst + c.energy) / 4 - c.infection / 3 - c.injuries.length * 6;
}

/** 하루가 끝나면 일기를 쓴다 */
export function writeDiaries(s: GameState, endedDay: number) {
  for (const id of s.characterOrder) {
    const c = s.characters[id];
    if (!c || c.status === 'dead') continue;
    const m = mood(c);
    const opener = pick(OPENERS.find(([min]) => m >= min)![1]);
    const lines = [opener];
    const today = c.today ?? [];
    if (today.length) lines.push(...today.slice(-5));
    else lines.push(pick(['창밖만 한참 바라봤다.', '하루 종일 거점을 지켰다.', '조용했다. 너무 조용해서 오히려 불안했다.']));
    if (c.hunger < 25) lines.push('배가 너무 고프다.');
    if (c.injuries.length) lines.push(`상처가 ${c.injuries.length}곳. 욱신거린다.`);
    if (c.infection >= 30) lines.push('열이 오르는 것 같다. 아무에게도 말하지 못했다.');
    const fear = Object.keys(c.fears ?? {})[0];
    if (fear && chance(0.5)) lines.push(`${LOCATION_BY_ID[fear]?.name ?? '그곳'}의 일이 자꾸 떠오른다.`);
    const best = [...(c.relations ?? [])].sort((a, b) => (b.bond ?? 0) - (a.bond ?? 0))[0];
    const bo = best && (best.bond ?? 0) >= 40 ? s.characters[best.targetId] : undefined;
    if (bo && bo.status !== 'dead') lines.push(pick([`${bo.name}이(가) 있어서 다행이다.`, `${bo.name}에게 고맙다는 말을 못 했다.`, `내일은 ${bo.name}와(과) 좀 더 이야기해야지.`]));
    if (c.goal && !c.goal.done) lines.push(`'${c.goal.text}' — 잊지 않았다.`);
    c.diary ??= [];
    c.diary.push({ day: endedDay, text: fixJosa(lines.join(' ')) });
    if (c.diary.length > 60) c.diary.splice(0, c.diary.length - 60);
    c.today = [];
  }
}

// ───────────── 기억 ─────────────

export const MEMORY_ICON: Record<MemoryKind, string> = { trauma: '🖤', resolve: '🔥', joy: '🌼', loss: '🕯️', goal: '⭐', bond: '💞' };

export function addMemory(c: Character, kind: MemoryKind, text: string, locationId?: string) {
  c.memories ??= [];
  const m: Memory = { t: store.s.time, kind, text: fixJosa(text), locationId };
  c.memories.push(m);
  if (c.memories.length > 30) c.memories.splice(0, c.memories.length - 30);
}

/** 트라우마 극복에 필요한 성공 횟수 */
const FEAR_STEPS = 3;

/** 끔찍한 일을 겪은 장소가 두려워진다 */
export function traumatize(c: Character, locationId: string, what: string) {
  if (c.status === 'dead') return;
  c.fears ??= {};
  const had = locationId in c.fears;
  c.fears[locationId] = FEAR_STEPS;
  if (!had) {
    const loc = LOCATION_BY_ID[locationId]?.name ?? '그곳';
    addMemory(c, 'trauma', `${loc}에서 ${what}`, locationId);
    noteDay(c, `${loc}에서 ${what}. 다시는 가고 싶지 않다.`);
  }
}

/** 두려운 장소에서 무언가 해냈다 → 조금씩 극복 */
export function braveStep(c: Character, locationId: string): string | null {
  const left = c.fears?.[locationId];
  if (left === undefined || !c.fears) return null;
  const loc = LOCATION_BY_ID[locationId]?.name ?? '그곳';
  if (left <= 1) {
    delete c.fears[locationId];
    addMemory(c, 'resolve', `${loc}의 두려움을 이겨냈다`, locationId);
    noteDay(c, `${loc}에서 더는 손이 떨리지 않았다. 이겨냈다.`);
    addEffect(c, 'resolve', store.s.time, `${loc}의 트라우마를 극복했다`);
    bus.emit('alert', { characterId: c.id, title: `🔥 ${c.name}`, text: `${loc}의 트라우마를 극복했다!`, kind: 'good' });
    return `🔥 ${loc}의 두려움을 이겨냈다!`;
  }
  c.fears[locationId] = left - 1;
  return `떨리는 손을 붙잡고 버텼다. (트라우마 극복까지 ${left - 1}번)`;
}

/** 지금 두려운 장소에 있는지 */
export function afraidHere(c: Character): string | null {
  const e = store.has ? store.s.expeditions[c.id] : undefined;
  if (!e || e.phase !== 'there') return null;
  return c.fears?.[e.locationId] !== undefined ? e.locationId : null;
}

// ───────────── 개인 목표 ─────────────

const CLUES = [
  '벽에 휘갈긴 낙서 속에서 낯익은 글씨를 봤다',
  '버려진 수첩 한 장에 실마리가 적혀 있었다',
  '무전기 잡음 사이로 익숙한 이름이 들렸다',
  '피난민 명단에서 단서를 찾았다',
  '누군가 남긴 쪽지에 지도가 그려져 있었다',
  '사진 뒷면에 장소가 적혀 있었다',
];

export function setGoal(c: Character, text: string) {
  const t = text.trim();
  if (!t) {
    delete c.goal;
    return;
  }
  c.goal = { text: t, clues: 0, notes: [] };
}

/** 수색할 때마다 단서를 찾을 수 있다. 찾은 내용(로그용)을 돌려준다 */
export function rollClue(c: Character, locationId: string, p = 0.08): string | null {
  const g = c.goal;
  if (!g || g.done) return null;
  const s = store.s;
  // 목적지에 왔다 → 목표 이룸
  if (g.target && g.target === locationId) return completeGoal(c);
  if (g.clues >= 3 || !chance(p)) return null;
  g.clues++;
  const where = LOCATION_BY_ID[locationId]?.name ?? '';
  let msg = `🔎 ${pick(CLUES)}. ('${g.text}' 단서 ${g.clues}/3)`;
  g.notes.push(`${where}: ${pick(CLUES)}`);
  if (g.clues >= 3) {
    const options = LOCATIONS.filter((l) => !l.temporary && !l.far && l.id !== locationId && s.locations[l.id]);
    const target = pick(options);
    g.target = target.id;
    if (!s.locations[target.id].discovered) s.locations[target.id].discovered = true;
    msg += ` 단서들이 한 곳을 가리킨다: [${target.name}]!`;
    bus.emit('alert', { characterId: c.id, title: `🔎 ${c.name}의 목표`, text: `단서가 [${target.name}]을(를) 가리킨다.`, kind: 'info' });
  }
  noteDay(c, msg.replace('🔎 ', ''));
  return fixJosa(msg);
}

const GOAL_REWARD = ['first_aid', 'antibiotics', 'hiking_pack', 'p_photo', 'ration_pack'];

function completeGoal(c: Character): string {
  const g = c.goal!;
  g.done = true;
  const s = store.s;
  const reward = pick(GOAL_REWARD);
  addItem(c.inventory, reward, 1);
  addMemory(c, 'goal', `목표를 이뤘다: ${g.text}`, g.target);
  addEffect(c, 'cheered', s.time, `목표를 이뤘다: ${g.text}`, 1440);
  noteDay(c, `드디어 찾았다. '${g.text}'. 이 날을 잊지 못할 것이다.`);
  const home = s.bases[c.homeId];
  if (home) home.rep = (home.rep ?? 0) + 3;
  addNews(fixJosa(`⭐ ${c.name}이(가) 목표를 이뤘다: '${g.text}'`), 'good', `⭐ ${c.name}의 목표`);
  return fixJosa(`⭐ 여기다. 마침내 '${g.text}'의 끝에 닿았다. (${ITEMS[reward].icon}${ITEMS[reward].name}을(를) 손에 쥐었다)`);
}

export const dayLabel = (t: number) => `${dayOf(t)}일차`;
