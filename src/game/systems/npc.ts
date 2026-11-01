import { JOBS } from '../data/jobs';
import { residentsOf } from '../homes';
import { addNews, store } from '../store';
import type { Character, GameState } from '../types';
import { fixJosa, pick, rand } from '../util';
import { addRep } from './baseLevel';
import { createCharacter, isAsleep } from './character';
import { noteDay } from './story';
import { randomTraits } from './traits';

/**
 * NPC 생존자. 사건으로 거점에 합류한다. 누구나 조종할 수 있고, 굶기면 떠난다.
 */

export const NPC_OWNER = 'NPC';
export const MAX_NPC_PER_BASE = 3;

const FAMILY = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = ['민준', '서연', '도윤', '하은', '시우', '지아', '주원', '수아', '예준', '지유', '건우', '채원', '현우', '다은', '우진', '소율', '태오', '나은', '은호', '유나', '정숙', '영철', '말순', '덕배'];
const AGES = ['10대 후반', '20대 초반', '20대 후반', '30대', '40대', '50대', '60대'];
const BIOS = [
  '말수가 적다. 가족 이야기는 꺼내지 않는다.',
  '늘 웃으려 애쓴다. 밤에는 가끔 운다.',
  '사태 전에는 평범한 회사원이었다고 한다.',
  '혼자 오래 버텼다. 사람을 쉽게 믿지 않는다.',
  '손재주가 좋다. 고장 난 건 뭐든 뜯어본다.',
  '노래를 흥얼거리는 버릇이 있다.',
];
const SKINS = ['#f3d2b3', '#e8b98f', '#c98e64', '#a86f48', '#7d4f33'];
const HAIRS = ['#1d1a17', '#3b2a1f', '#6a4630', '#b0894f', '#8a8a8a', '#d9d4c7', '#7a2a2a'];
const SHIRTS = ['#5a7a9a', '#8a4a4a', '#4a7a5a', '#9a8a5a', '#6a5a8a', '#3a3a3a', '#c0a080'];
const PANTS = ['#2f3640', '#3a3a44', '#4a3a2a', '#2a3a4a', '#555b62'];

export const isNpc = (c: Character | undefined) => !!c?.npc;
export const npcsAt = (s: GameState, baseId: string) => residentsOf(s, baseId).filter((c) => c.npc);

export function npcName(s: GameState): string {
  const used = new Set(Object.values(s.characters).map((c) => c.name));
  for (let i = 0; i < 30; i++) {
    const n = pick(FAMILY) + pick(GIVEN);
    if (!used.has(n)) return n;
  }
  return pick(FAMILY) + pick(GIVEN) + rand(2, 9);
}

/** 새 NPC 를 만든다 (거점 자리가 없으면 null) */
export function makeNpc(baseId: string, name?: string): Character | null {
  const s = store.s;
  if (!s.bases[baseId] || npcsAt(s, baseId).length >= MAX_NPC_PER_BASE) return null;
  const job = pick(JOBS.filter((j) => j.id !== 'unemployed'));
  const c = createCharacter({
    name: name ?? npcName(s),
    owner: NPC_OWNER,
    job: job.id,
    age: pick(AGES),
    bio: pick(BIOS),
    appearance: { skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS), pants: pick(PANTS) },
    permadeathAllowed: false,
    homeId: baseId,
    traits: randomTraits(job.id),
  });
  c.npc = true;
  c.hunger = 45;
  c.thirst = 45;
  c.energy = 50;
  c.task = pick(['guard', 'farm', 'water', 'workshop'] as const);
  s.characters[c.id] = c;
  s.characterOrder.push(c.id);
  addRep(s.bases[baseId], 2);
  noteDay(c, `[${s.bases[baseId].name}]에 받아들여졌다. 오랜만에 지붕 아래서 잔다.`);
  return c;
}

/** NPC 가 거점을 떠난다 */
export function npcLeaves(c: Character, why: string) {
  const s = store.s;
  const home = s.bases[c.homeId];
  // 들고 있던 건 두고 간다
  if (home) for (const st of c.inventory) home.storage.push(st);
  c.inventory = [];
  for (const o of Object.values(s.characters)) o.relations = o.relations.filter((r) => r.targetId !== c.id);
  for (const r of Object.values(s.requests)) if (r.from === c.id || r.to === c.id) r.status = 'cancelled';
  delete s.characters[c.id];
  s.characterOrder = s.characterOrder.filter((id) => id !== c.id);
  addRep(home, -3);
  addNews(fixJosa(`🚶 ${c.name}이(가) [${home?.name ?? '거점'}]을(를) 떠났다. ${why}`), 'bad', `🚶 ${c.name}이(가) 떠났다`);
}

/** 매 시간: 굶기면 불만이 쌓이고, 지치면 알아서 잔다 */
export function tickNpc(s: GameState, c: Character, h: number) {
  if (!c.npc || c.status === 'dead') return;
  if (c.hunger < 8 || c.thirst < 8) c.grudge = (c.grudge ?? 0) + h;
  else if (c.grudge) c.grudge = Math.max(0, c.grudge - h * 0.5);
  if ((c.grudge ?? 0) >= 18 && c.status === 'base') {
    npcLeaves(c, '먹을 것도 마실 것도 없는 곳에는 있을 수 없다고 했다.');
    return;
  }
  if (c.status === 'base' && !isAsleep(c) && !c.crafting && c.energy < 25) {
    c.sleepUntil = s.time + 7 * 60;
    c.sleepStart = s.time;
  }
}
