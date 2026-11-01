import { bus } from '../bus';
import { powerOf } from './power';
import { ITEMS } from '../data/items';
import { LOCATION_BY_ID } from '../data/locations';
import { residentsOf } from '../homes';
import { addItem, countItem, removeItem } from '../inventory';
import { onlinePlayers } from '../online';
import { addNews, store, withBase } from '../store';
import type { Character, GameEvent, GameState } from '../types';
import { chance, dayOf, fixJosa, hourOf, pick, pickWeighted, rand, uid } from '../util';
import { JOB_BY_ID } from '../data/jobs';
import { addRep, baseTier, hasFacility } from './baseLevel';
import { attitude, shiftFaction } from './factions';
import { MAX_NPC_PER_BASE, makeNpc, npcsAt } from './npc';
import { currentSeason, type Season } from './season';
import { noteDay } from './story';
import { defenseScore } from './raid';
import { addInjury, damage, isAsleep } from './character';
import { addEffect } from './effects';
import { RAID_WARN_MS } from './raid';
import { bondUp, postRp } from './rp';

/**
 * 랜덤 사건. 가끔 거점에 일이 생기고, 접속한 사람들이 선택지에 투표한다.
 * 다 투표하거나 10분이 지나면 가장 많이 고른 쪽으로 정해진다 (아무도 안 고르면 기본 선택).
 */

const VOTE_MS = 10 * 60000;

interface Ctx {
  s: GameState;
  base: GameState['base'];
  people: Character[];
  /** 사건에 휘말린 캐릭터 */
  cast: Character[];
}
interface Option {
  id: string;
  label: string;
  desc: string;
  apply: (x: Ctx) => string;
}
export interface EventDef {
  title: string;
  icon: string;
  /** names: 휘말린 캐릭터 이름 ({A}, {B}) */
  text: (baseName: string, names: string[]) => string;
  /** 휘말리는 캐릭터 수 (거점에 깨어 있는 사람 중에서) */
  cast?: number;
  options: Option[];
  /** 아무도 고르지 않았을 때 */
  fallback: string;
  can?: (x: Ctx) => boolean;
  /** 계절 행사 기간에만 (그때는 자주) */
  season?: Season['id'];
  /** 뽑힐 가중치 (기본 1) */
  weight?: (x: Ctx) => number;
}

const FOODS = (x: Ctx) => x.base.storage.filter((st) => ITEMS[st.itemId]?.category === 'food');
const foodCount = (x: Ctx) => FOODS(x).reduce((n, st) => n + st.qty, 0);
function spendFood(x: Ctx, n: number): number {
  let left = n;
  for (const st of FOODS(x)) {
    const k = Math.min(st.qty, left);
    removeItem(x.base.storage, st.itemId, k);
    left -= k;
    if (left <= 0) break;
  }
  return n - left;
}
const give = (x: Ctx, items: [string, number][]) => {
  for (const [id, q] of items) addItem(x.base.storage, id, q);
  return items.map(([id, q]) => `${ITEMS[id].icon}${ITEMS[id].name} ${q}`).join(', ');
};
const cheer = (x: Ctx, minutes: number, why: string) => x.people.forEach((c) => addEffect(c, 'cheered', x.s.time, why, minutes));
const awake = (x: Ctx) => x.people.filter((c) => c.status === 'base' && !isAsleep(c));
function hurt(c: Character, why: string) {
  addInjury(c, chance(0.5) ? 'laceration' : 'scratch');
  damage(c, rand(5, 12));
  addEffect(c, 'shaken', store.s.time, why);
}
function startRaidHere(x: Ctx, size: number) {
  if (x.s.raid) return '';
  const now = Date.now();
  x.s.raid = { baseId: x.base.id, arriveAt: now + RAID_WARN_MS, warnedAt: now, size };
  return ` 🧟 좀비 ${size}마리가 몰려온다! (10분 뒤)`;
}

const radio = (x: Ctx) => hasFacility(x.base, 'f_radio_tower') || hasFacility(x.base, 'f_radio_desk');
const tierOf = (x: Ctx) => baseTier(x.s, x.base);
const meds = (x: Ctx) => ['bandage', 'painkiller', 'disinfectant', 'antibiotics', 'first_aid'].reduce((n, id) => n + countItem(x.base.storage, id), 0);
function spendMeds(x: Ctx, n: number): number {
  let left = n;
  for (const id of ['bandage', 'painkiller', 'disinfectant', 'antibiotics', 'first_aid']) {
    while (left > 0 && removeItem(x.base.storage, id, 1)) left--;
  }
  return n - left;
}
function joinNpc(x: Ctx, intro: string): string {
  const c = makeNpc(x.base.id);
  if (!c) return '거점에 더 들일 자리가 없어 아쉽게 돌려보냈다.';
  for (const p of x.people) bondUp(p.id, c.id, 10, 'join', 60);
  addRep(x.base, 1);
  return `${intro} ${c.name}(${JOB_BY_ID[c.job]?.name ?? '생존자'}, ${c.age})이(가) [${x.base.name}]에 합류했다! 이제 누구나 조종할 수 있다.`;
}

export const EVENTS: Record<string, EventDef> = {
  stranger: {
    title: '낯선 생존자',
    icon: '🚪',
    text: (b) => `[${b}] 문을 두드리는 소리. 지친 얼굴의 낯선 생존자가 하룻밤만 재워 달라고 한다.`,
    fallback: 'refuse',
    options: [
      {
        id: 'accept', label: '들여보낸다', desc: '식량 2개. 무언가 돌아올 수도, 잃을 수도',
        apply: (x) => {
          const used = spendFood(x, 2);
          const r = Math.random();
          if (r < 0.45) return `식량 ${used}개를 나눠 먹었다. 떠나면서 고맙다며 ${give(x, [[pick(['bandage', 'battery', 'lighter', 'painkiller']), 2], ['canned_beans', 1]])}을(를) 두고 갔다.`;
          if (r < 0.75) {
            const hidden = Object.entries(x.s.locations).filter(([, l]) => !l.discovered);
            if (hidden.length) {
              const [id, l] = pick(hidden);
              l.discovered = true;
              return `식량 ${used}개를 나눠 먹으며 이야기를 들었다. [${LOCATION_BY_ID[id].name}]의 위치를 알게 되었다!`;
            }
            return `식량 ${used}개를 나눠 먹으며 바깥 소식을 들었다.`;
          }
          const st = pick(x.base.storage.filter((t) => !ITEMS[t.itemId]?.vehicle));
          if (st) removeItem(x.base.storage, st.itemId, Math.min(st.qty, 3));
          return `아침에 일어나 보니 사라졌다. 식량 ${used}개와 ${st ? ITEMS[st.itemId].name : '물건'} 몇 개가 없어졌다…`;
        },
      },
      { id: 'share', label: '먹을 것만 나눠 준다', desc: '식량 1개, 모두 기분 좋음', apply: (x) => (cheer(x, 180, '낯선 이에게 친절을 베풀었다'), `식량 ${spendFood(x, 1)}개를 건넸다. 고맙다는 인사를 남기고 떠났다. 마음이 따뜻하다.`) },
      { id: 'refuse', label: '돌려보낸다', desc: '아무 일도… 없을까?', apply: (x) => (chance(0.25) ? `문을 걸어 잠갔다. 멀리서 욕설이 들렸다…${startRaidHere(x, 4 + rand(0, 3))}` : '문을 걸어 잠갔다. 발소리가 멀어졌다.') },
    ],
  },
  radio: {
    title: '무전 구조 요청',
    icon: '📻',
    text: (b) => `[${b}] 무전기에서 다급한 목소리가 들린다. "누구든… 근처 약국에 갇혀 있어요…"`,
    fallback: 'ignore',
    can: (x) => awake(x).length > 0,
    options: [
      {
        id: 'go', label: '구하러 간다', desc: '깨어 있는 한 명이 다녀온다. 위험하지만 보상이 크다',
        apply: (x) => {
          const c = pick(awake(x));
          if (chance(0.6)) {
            cheer(x, 360, '사람을 구했다');
            return `${c.name}이(가) 생존자를 구해 왔다! 감사의 표시로 ${give(x, [['first_aid', 1], ['canned_tuna', 2], ['water_bottle', 2]])}을(를) 받았다.`;
          }
          hurt(c, '구조 요청은 함정이었다');
          return `함정이었다! ${c.name}이(가) 다쳐서 겨우 돌아왔다.`;
        },
      },
      { id: 'ignore', label: '못 들은 척한다', desc: '안전하지만 마음이 무겁다', apply: () => '무전기를 껐다. 한동안 아무도 말이 없었다.' },
    ],
  },
  supply: {
    title: '근처에 떨어진 보급 상자',
    icon: '📦',
    text: (b) => `[${b}] 헬기 소리와 함께 보급 상자가 근처 공터에 떨어졌다. 좀비들도 소리를 들었을 것이다.`,
    fallback: 'wait',
    options: [
      { id: 'now', label: '지금 바로 가져온다', desc: '많이 챙기지만 좀비를 끌고 올 수 있다', apply: (x) => `상자를 통째로 끌고 왔다: ${give(x, [['water_bottle', 3], ['canned_beans', 3], ['battery', 2], ['bandage', 2]])}.${chance(0.35) ? startRaidHere(x, 5 + rand(0, 3)) : ''}` },
      { id: 'wait', label: '밤까지 기다린다', desc: '안전하지만 남은 것만', apply: (x) => `조용해진 뒤 가 보니 반쯤 털려 있었다: ${give(x, [['water_bottle', 1], ['canned_beans', 2]])}.` },
    ],
  },
  dog: {
    title: '떠돌이 개',
    icon: '🐕',
    text: (b) => `[${b}] 마른 개 한 마리가 문 앞을 떠나지 않는다. 꼬리를 조심스럽게 흔든다.`,
    fallback: 'shoo',
    options: [
      {
        id: 'adopt', label: '거둔다', desc: '식량 2개 (반려동물 사료가 있으면 그걸로), 오래 기분 좋음, 서로 가까워짐',
        apply: (x) => {
          if (!removeItem(x.base.storage, 'pet_food', 1)) spendFood(x, 2);
          cheer(x, 720, '개가 생겼다');
          addItem(x.base.storage, 'p_pet_bowl', 1);
          for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 3, 'dog', 600);
          return '이름을 지어 주었다. 거점이 한결 밝아졌다. (반려동물 밥그릇 획득)';
        },
      },
      { id: 'feed', label: '먹을 것만 준다', desc: '식량 1개, 잠깐 기분 좋음', apply: (x) => (spendFood(x, 1), cheer(x, 180, '개에게 밥을 주었다'), '허겁지겁 먹고는 고맙다는 듯 한 번 짖고 떠났다.') },
      { id: 'shoo', label: '쫓아 보낸다', desc: '아무 일 없음', apply: () => '돌을 던지는 시늉을 하자 낑낑대며 사라졌다.' },
    ],
  },
  leak: {
    title: '비가 샌다',
    icon: '💧',
    text: (b) => `[${b}] 빗물이 천장에서 뚝뚝 떨어져 창고 쪽으로 번지고 있다.`,
    fallback: 'ignore',
    can: (x) => x.s.weather?.kind === 'rain' || x.s.weather?.kind === 'storm',
    options: [
      { id: 'fix', label: '판자로 막는다', desc: '판자 2개', apply: (x) => (removeItem(x.base.storage, 'plank', 2) ? '판자를 덧대 새는 곳을 막았다.' : `판자가 없어 막지 못했다. 식량 ${spendFood(x, 2)}개가 젖어 버렸다.`) },
      { id: 'ignore', label: '양동이만 받친다', desc: '물건이 조금 젖을 수 있다', apply: (x) => `밤새 물이 번져 식량 ${spendFood(x, rand(1, 3))}개가 못 쓰게 됐다. 대신 ${give(x, [['dirty_water', 2]])}을(를) 받았다.` },
    ],
  },
  feast: {
    title: '다 같이 모인 저녁',
    icon: '🍲',
    text: (b) => `[${b}] 오늘따라 모두 거점에 모였다. 누군가 "오늘은 좀 제대로 먹을까?" 하고 말한다.`,
    fallback: 'save',
    can: (x) => x.people.filter((c) => c.status === 'base').length >= 2 && foodCount(x) >= 3,
    options: [
      {
        id: 'party', label: '잔치를 연다', desc: '식량 3개, 모두 든든함·기분 좋음, 서로 가까워짐',
        apply: (x) => {
          spendFood(x, 3);
          for (const c of x.people) {
            addEffect(c, 'well_fed', x.s.time, '다 같이 먹은 저녁');
            addEffect(c, 'cheered', x.s.time, '다 같이 먹은 저녁', 360);
            c.hunger = Math.min(100, c.hunger + 30);
          }
          for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 5, 'feast', 600);
          return '촛불을 켜고 둘러앉았다. 오랜만에 웃음소리가 났다.';
        },
      },
      { id: 'save', label: '아껴 둔다', desc: '아무 일 없음', apply: () => '각자 조용히 통조림을 비웠다.' },
    ],
  },
  merchant: {
    title: '떠돌이 상인',
    icon: '🧳',
    text: (b) => `[${b}] 커다란 배낭을 멘 상인이 찾아왔다. "통조림이나 고철 있으면 바꿔 주지."`,
    fallback: 'refuse',
    options: [
      { id: 'meds', label: '식량 3 → 항생제', desc: '식량 3개를 주고 항생제 1개', apply: (x) => (foodCount(x) >= 3 ? (spendFood(x, 3), `거래했다: ${give(x, [['antibiotics', 1]])}.`) : '식량이 모자라 거래하지 못했다.') },
      { id: 'fuel', label: '고철 3 → 휘발유', desc: '고철 3개를 주고 휘발유 1통', apply: (x) => (countItem(x.base.storage, 'scrap') >= 3 ? (removeItem(x.base.storage, 'scrap', 3), `거래했다: ${give(x, [['gasoline', 1]])}.`) : '고철이 모자라 거래하지 못했다.') },
      { id: 'refuse', label: '돌려보낸다', desc: '아무 일 없음', apply: () => '상인은 어깨를 으쓱하고 떠났다.' },
    ],
  },
  noise: {
    title: '한밤의 소음',
    icon: '🌙',
    text: (b) => `[${b}] 한밤중, 창고 쪽에서 무언가 넘어지는 소리가 났다.`,
    fallback: 'hide',
    can: (x) => {
      const h = hourOf(x.s.time);
      return (h >= 22 || h < 5) && awake(x).length > 0;
    },
    options: [
      {
        id: 'check', label: '확인하러 간다', desc: '깨어 있는 한 명이 간다',
        apply: (x) => {
          const c = pick(awake(x));
          const r = Math.random();
          if (r < 0.5) return `${c.name}이(가) 가 보니 너구리였다. 녀석이 끌고 온 ${give(x, [[pick(['cloth', 'scrap', 'plastic']), 2]])}을(를) 주웠다.`;
          if (r < 0.8) return `${c.name}이(가) 둘러봤지만 아무것도 없었다. 바람이었나…`;
          hurt(c, '어둠 속에서 무언가에 습격당했다');
          return `어둠 속에서 좀비 한 마리가 튀어나왔다! ${c.name}이(가) 다쳤지만 쫓아냈다.`;
        },
      },
      { id: 'hide', label: '숨죽이고 기다린다', desc: '아무 일 없음 (모두 긴장)', apply: (x) => (x.people.forEach((c) => addEffect(c, 'shaken', x.s.time, '밤새 소리에 떨었다', 60)), '아침까지 숨죽이고 있었다. 아무도 잠을 이루지 못했다.') },
    ],
  },

  quarrel: {
    title: '말다툼',
    icon: '💢',
    cast: 2,
    text: (b, n) => `[${b}] ${n[0]}와(과) ${n[1]}이(가) 남은 통조림 하나를 두고 언성을 높인다.`,
    fallback: 'let',
    options: [
      { id: 'mediate', label: '사이에 끼어 말린다', desc: '둘 사이가 조금 나아진다', apply: (x) => (bondUp(x.cast[0].id, x.cast[1].id, 3, 'quarrel', 300), `한참 뒤 ${x.cast[0].name}이(가) 먼저 미안하다고 했다. 통조림은 반씩 나눴다.`) },
      { id: 'side', label: '{A} 편을 든다', desc: '{A}는 기분 좋고, 둘 사이는 멀어진다', apply: (x) => (bondUp(x.cast[0].id, x.cast[1].id, -4, 'quarrel-side', 300), addEffect(x.cast[0], 'cheered', x.s.time, '내 편을 들어 줬다', 120), `${x.cast[1].name}은(는) 말없이 방을 나갔다.`) },
      { id: 'let', label: '둘이 알아서 하게 둔다', desc: '사이가 서먹해질 수 있다', apply: (x) => (bondUp(x.cast[0].id, x.cast[1].id, -6, 'quarrel-let', 300), '그날 밤 둘은 한마디도 하지 않았다.') },
    ],
  },
  nightmare: {
    title: '악몽',
    icon: '😱',
    cast: 2,
    text: (b, n) => `[${b}] ${n[0]}이(가) 악몽을 꾸다 비명을 지르며 깼다. 식은땀에 젖어 떨고 있다.`,
    fallback: 'sleep',
    options: [
      {
        id: 'stay', label: '{B}이(가) 곁에 있어 준다', desc: '{A}의 떨림이 가라앉고 둘이 가까워진다',
        apply: (x) => {
          const [a, b] = x.cast;
          if (a.effects) a.effects = a.effects.filter((e) => e.id !== 'shaken');
          addEffect(a, 'cheered', x.s.time, `${b.name}이(가) 곁에 있어 줬다`, 180);
          bondUp(a.id, b.id, 6, 'nightmare', 300);
          return `${b.name}이(가) 아무 말 없이 등을 토닥여 주었다. ${a.name}은(는) 다시 잠들었다.`;
        },
      },
      { id: 'sleep', label: '물 한 잔 주고 다시 재운다', desc: '{A}는 한동안 불안하다', apply: (x) => (addEffect(x.cast[0], 'shaken', x.s.time, '악몽', 120), `${x.cast[0].name}은(는) 날이 밝을 때까지 눈을 감지 못했다.`) },
    ],
  },
  talk: {
    title: '잠 못 드는 밤',
    icon: '🌌',
    cast: 2,
    can: (x) => {
      const h = hourOf(x.s.time);
      return h >= 21 || h < 3;
    },
    text: (b, n) => `[${b}] 늦은 밤, 잠 못 든 ${n[0]}와(과) ${n[1]}이(가) 창가에 나란히 앉았다.`,
    fallback: 'sleep',
    options: [
      { id: 'talk', label: '이야기를 나눈다', desc: '둘이 많이 가까워진다', apply: (x) => (x.cast.forEach((c) => addEffect(c, 'cheered', x.s.time, '밤새 나눈 이야기', 240)), bondUp(x.cast[0].id, x.cast[1].id, 7, 'talk', 600), '사태 전의 이야기, 좋아하던 노래 이야기… 어느새 창밖이 밝아 오고 있었다.') },
      { id: 'sleep', label: '각자 잠자리로 돌아간다', desc: '아무 일 없음', apply: () => '"내일 일찍 일어나야지." 둘은 각자 누웠다.' },
    ],
  },
  photo: {
    title: '오래된 사진',
    icon: '🖼️',
    cast: 2,
    text: (b, n) => `[${b}] ${n[0]}이(가) 짐을 정리하다 ${n[1]}의 낡은 가족사진을 발견했다.`,
    fallback: 'keep',
    options: [
      { id: 'return', label: '조용히 돌려준다', desc: '{B}가 고마워한다', apply: (x) => (addEffect(x.cast[1], 'cheered', x.s.time, '잃어버린 사진을 찾았다', 240), bondUp(x.cast[0].id, x.cast[1].id, 6, 'photo', 600), `${x.cast[1].name}은(는) 사진을 한참 들여다보다가 "고마워"라고 작게 말했다.`) },
      {
        id: 'ask', label: '사진 속 사람들에 대해 묻는다', desc: '마음을 열 수도, 상처를 건드릴 수도',
        apply: (x) =>
          chance(0.5)
            ? (bondUp(x.cast[0].id, x.cast[1].id, 9, 'photo', 600), `${x.cast[1].name}은(는) 처음으로 가족 이야기를 꺼냈다. 둘 다 조금 울었다.`)
            : (bondUp(x.cast[0].id, x.cast[1].id, -3, 'photo-ask', 600), `${x.cast[1].name}은(는) 사진을 낚아채듯 가져가고 대답하지 않았다.`),
      },
      { id: 'keep', label: '못 본 척 넣어 둔다', desc: '아무 일 없음', apply: (x) => `${x.cast[0].name}은(는) 사진을 원래 자리에 넣어 두었다.` },
    ],
  },
  fever: {
    title: '열이 난다',
    icon: '🤒',
    cast: 1,
    text: (b, n) => `[${b}] ${n[0]}의 이마가 뜨겁다. 열이 오르는 것 같다.`,
    fallback: 'rest',
    options: [
      {
        id: 'meds', label: '약을 먹인다', desc: '항생제나 진통제 1개',
        apply: (x) => {
          const c = x.cast[0];
          const med = ['antibiotics', 'painkiller'].find((id) => countItem(x.base.storage, id) > 0);
          if (!med) {
            c.infection = Math.min(100, c.infection + 10);
            return `약이 없었다. ${c.name}은(는) 밤새 끙끙 앓았다. (감염 +10)`;
          }
          removeItem(x.base.storage, med, 1);
          c.infection = Math.max(0, c.infection - 10);
          return `${ITEMS[med].name}을(를) 먹이자 열이 내렸다.`;
        },
      },
      {
        id: 'rest', label: '푹 재운다', desc: '4시간 잠, 감염 조금',
        apply: (x) => {
          const c = x.cast[0];
          c.sleepUntil = x.s.time + 240;
          c.sleepStart = x.s.time;
          c.infection = Math.min(100, c.infection + 3);
          return `${c.name}을(를) 이불로 꽁꽁 싸매 재웠다.`;
        },
      },
    ],
  },
  surprise: {
    title: '몰래 준비하는 선물',
    icon: '🎁',
    cast: 2,
    text: (b, n) => `[${b}] ${n[0]}이(가) ${n[1]} 몰래 무언가를 만들고 있다. 들킬 것 같아 안절부절못한다.`,
    fallback: 'secret',
    options: [
      { id: 'secret', label: '모른 척해 준다', desc: '{B}가 선물을 받는다', apply: (x) => (addItem(x.base.storage, pick(['p_teddy', 'p_cat_plush', 'p_flowers']), 1), addEffect(x.cast[1], 'cheered', x.s.time, `${x.cast[0].name}의 선물`, 360), bondUp(x.cast[0].id, x.cast[1].id, 6, 'surprise', 600), `며칠 뒤, ${x.cast[1].name}의 침대 머리맡에 손으로 만든 선물이 놓여 있었다.`) },
      { id: 'spoil', label: '무심코 들켜 버린다', desc: '어색하지만 웃기다', apply: (x) => (bondUp(x.cast[0].id, x.cast[1].id, 2, 'surprise', 600), `${x.cast[1].name}이(가) 다 봐 버렸다. 둘 다 얼굴이 빨개졌다.`) },
    ],
  },
  // ───────────── 생존자 합류 ─────────────
  refugee: {
    title: '피난민',
    icon: '🧳',
    text: (b) => `[${b}] 앳된 얼굴의 생존자가 문 앞에 쓰러져 있다. "여기서… 같이 지낼 수 있을까요? 뭐든 할게요."`,
    fallback: 'refuse',
    can: (x) => npcsAt(x.s, x.base.id).length < MAX_NPC_PER_BASE,
    weight: (x) => 0.6 + tierOf(x) * 0.4 + (radio(x) ? 0.5 : 0),
    options: [
      { id: 'join', label: '받아들인다', desc: '거점에 NPC 생존자가 합류한다 (먹을 입이 늘어난다)', apply: (x) => joinNpc(x, '따뜻한 물 한 잔을 건네자 그제야 울음을 터뜨렸다.') },
      { id: 'feed', label: '하룻밤만 재워 보낸다', desc: '식량 1개, 모두 기분 좋음', apply: (x) => (spendFood(x, 1), cheer(x, 180, '피난민을 도왔다'), addRep(x.base, 1), '아침 일찍 고맙다는 쪽지를 남기고 떠났다.') },
      { id: 'refuse', label: '돌려보낸다', desc: '아무 일 없음', apply: () => '문을 닫았다. 한동안 발소리가 문 앞을 서성였다.' },
    ],
  },
  radio_survivor: {
    title: '무전 너머의 생존자',
    icon: '🗼',
    text: (b) => `[${b}] 무전 탑에 또렷한 목소리가 잡혔다. "근처에 혼자 있어요. 데리러 와 줄 수 있나요?"`,
    fallback: 'ignore',
    can: (x) => hasFacility(x.base, 'f_radio_tower') && awake(x).length > 0 && npcsAt(x.s, x.base.id).length < MAX_NPC_PER_BASE,
    weight: () => 1.5,
    options: [
      {
        id: 'fetch', label: '데리러 간다', desc: '깨어 있는 한 명이 다녀온다. 합류할 수도, 다칠 수도',
        apply: (x) => {
          const c = pick(awake(x));
          if (chance(0.75)) return joinNpc(x, `${c.name}이(가) 무사히 데려왔다.`);
          hurt(c, '데리러 간 길에 좀비 떼를 만났다');
          return `가는 길에 좀비 떼를 만났다. ${c.name}이(가) 다쳐서 혼자 돌아왔다…`;
        },
      },
      { id: 'guide', label: '오는 길을 알려 준다', desc: '절반쯤은 무사히 도착한다', apply: (x) => (chance(0.5) ? joinNpc(x, '해 질 녘, 지친 얼굴이 문을 두드렸다.') : '무전이 끊겼다. 끝내 오지 않았다.') },
      { id: 'ignore', label: '무전을 끈다', desc: '아무 일 없음', apply: () => '잡음만 남았다.' },
    ],
  },

  // ───────────── 세력 ─────────────
  raiders_toll: {
    title: '약탈자의 통행세',
    icon: '🏴',
    text: (b) => `[${b}] 오토바이 소리. 복면을 쓴 무리가 문 앞에 섰다. "이 동네에 살려면 세금을 내야지. 식량 네 개."`,
    fallback: 'pay',
    can: (x) => attitude(x.s, 'raiders') > -80,
    weight: (x) => (attitude(x.s, 'raiders') < 0 ? 1 : 0.5) * (tierOf(x) >= 2 ? 0.5 : 1),
    options: [
      { id: 'pay', label: '순순히 낸다', desc: '식량 4개, 약탈자 태도 +', apply: (x) => `식량 ${spendFood(x, 4)}개를 건넸다. "현명하군."${shiftFaction(x.s, 'raiders', 12)}` },
      {
        id: 'refuse', label: '거절한다', desc: '약탈자 태도 −. 보복이 올 수도',
        apply: (x) => `"후회할 거다." 무리가 물러갔다.${shiftFaction(x.s, 'raiders', -12)}${chance(0.45) ? startRaidHere(x, 6 + rand(0, 4) + tierOf(x)) : ''}`,
      },
      {
        id: 'fight', label: '맞서 싸운다', desc: '방어력이 높으면 쫓아낸다. 약탈자 태도 크게 −',
        apply: (x) => {
          const def = withBase(x.base.id, () => defenseScore(x.s).total);
          if (def * (0.7 + Math.random() * 0.6) >= 8) {
            addRep(x.base, 3);
            cheer(x, 360, '약탈자를 쫓아냈다');
            return `총성 몇 발. 약탈자들이 욕설을 퍼부으며 달아났다! 놈들이 두고 간 ${give(x, [['gasoline', 1], ['ammo_9mm', 6]])}을(를) 챙겼다.${shiftFaction(x.s, 'raiders', -25)}`;
          }
          const c = pick(x.people.filter((p) => p.status === 'base')) ?? x.people[0];
          if (c) hurt(c, '약탈자와 싸웠다');
          return `역부족이었다. ${c?.name ?? '누군가'}이(가) 다쳤고 식량 ${spendFood(x, 4)}개를 빼앗겼다.${shiftFaction(x.s, 'raiders', -15)}`;
        },
      },
    ],
  },
  raiders_offer: {
    title: '약탈자의 거래',
    icon: '🏴',
    text: (b) => `[${b}] 약탈자 두목이 무전으로 말을 걸어왔다. "우리랑 사이좋게 지내면 휘발유 좀 나눠 주지."`,
    fallback: 'no',
    can: (x) => attitude(x.s, 'raiders') >= 30,
    options: [
      { id: 'trade', label: '식량 3 → 휘발유 2', desc: '거래', apply: (x) => (foodCount(x) >= 3 ? (spendFood(x, 3), `거래했다: ${give(x, [['gasoline', 2]])}.${shiftFaction(x.s, 'raiders', 5)}`) : '식량이 모자라 거래하지 못했다.') },
      { id: 'no', label: '거절한다', desc: '아무 일 없음', apply: () => '"마음 바뀌면 연락해."' },
    ],
  },
  church_help: {
    title: '교회 공동체의 부탁',
    icon: '⛪',
    text: (b) => `[${b}] 언덕 교회에서 온 수녀가 고개를 숙인다. "아이들이 열이 나요. 약을 조금만 나눠 주실 수 있을까요?"`,
    fallback: 'refuse',
    can: (x) => attitude(x.s, 'church') > -60,
    options: [
      { id: 'give', label: '의약품 2개를 준다', desc: '교회 태도 크게 +, 모두 기분 좋음', apply: (x) => (meds(x) >= 2 ? (spendMeds(x, 2), cheer(x, 360, '아이들을 도왔다'), addRep(x.base, 2), `수녀가 몇 번이고 고개를 숙였다.${shiftFaction(x.s, 'church', 18)}`) : `줄 약이 없었다. 수녀는 괜찮다며 웃었다.${shiftFaction(x.s, 'church', 3)}`) },
      { id: 'food', label: '대신 식량을 준다', desc: '식량 2개, 교회 태도 +', apply: (x) => `식량 ${spendFood(x, 2)}개를 건넸다.${shiftFaction(x.s, 'church', 8)}` },
      { id: 'refuse', label: '거절한다', desc: '교회 태도 −', apply: (x) => `수녀는 말없이 돌아섰다.${shiftFaction(x.s, 'church', -8)}` },
    ],
  },
  church_gift: {
    title: '교회에서 온 선물',
    icon: '⛪',
    text: (b) => `[${b}] 교회 아이들이 수레를 끌고 왔다. "수녀님이 전해 드리래요!"`,
    fallback: 'thanks',
    can: (x) => attitude(x.s, 'church') >= 40,
    options: [
      { id: 'thanks', label: '고맙게 받는다', desc: '식량·의약품', apply: (x) => (cheer(x, 240, '교회의 선물'), `${give(x, [['vegetable', 3], ['herbs', 2], ['bandage', 2]])}을(를) 받았다.${shiftFaction(x.s, 'church', 2)}`) },
      { id: 'return', label: '답례로 사탕을 쥐여 보낸다', desc: '식량 1개, 교회 태도 +', apply: (x) => (spendFood(x, 1), `${give(x, [['vegetable', 3], ['herbs', 2]])}을(를) 받고, 아이들 주머니에 먹을 것을 넣어 주었다.${shiftFaction(x.s, 'church', 6)}`) },
    ],
  },
  military_radio: {
    title: '군 잔존 부대의 무전',
    icon: '🎖️',
    text: (b) => `[${b}] 무전기가 지직거린다. "여기는 3소대. 정찰 정보와 물자를 교환하자. 식량 4개면 탄약을 주지."`,
    fallback: 'ignore',
    can: (x) => radio(x),
    weight: () => 1.2,
    options: [
      { id: 'trade', label: '식량 4 → 탄약', desc: '9mm 탄 12발, 군 태도 +', apply: (x) => (foodCount(x) >= 4 ? (spendFood(x, 4), `낙하 지점에서 ${give(x, [['ammo_9mm', 12]])}을(를) 받았다.${shiftFaction(x.s, 'military', 10)}`) : `식량이 모자라다고 하자 무전이 끊겼다.${shiftFaction(x.s, 'military', -2)}`) },
      {
        id: 'intel', label: '정보만 주고받는다', desc: '숨은 장소를 알게 될 수도, 군 태도 +',
        apply: (x) => {
          const hidden = Object.entries(x.s.locations).filter(([id, l]) => !l.discovered && !LOCATION_BY_ID[id]?.temporary);
          if (hidden.length) {
            const [id, l] = pick(hidden);
            l.discovered = true;
            return `서로 아는 걸 나눴다. [${LOCATION_BY_ID[id].name}]의 위치를 알게 되었다!${shiftFaction(x.s, 'military', 5)}`;
          }
          return `서로 아는 걸 나눴다.${shiftFaction(x.s, 'military', 5)}`;
        },
      },
      { id: 'ignore', label: '응답하지 않는다', desc: '군 태도 조금 −', apply: (x) => `"…응답 없음. 이상."${shiftFaction(x.s, 'military', -3)}` },
    ],
  },
  military_drop: {
    title: '군 보급',
    icon: '🪂',
    text: (b) => `[${b}] "3소대다. 그동안 고마웠다. 너희 거점 근처에 물자를 떨어뜨리겠다."`,
    fallback: 'take',
    can: (x) => attitude(x.s, 'military') >= 40,
    options: [
      { id: 'take', label: '물자를 챙긴다', desc: '군 보급품', apply: (x) => `${give(x, [['ration_pack', 3], ['gasoline', 1], ['first_aid', 1]])}을(를) 받았다.${shiftFaction(x.s, 'military', 2)}` },
      { id: 'share', label: '교회에 절반을 나눠 준다', desc: '교회 태도 +', apply: (x) => `${give(x, [['ration_pack', 1], ['gasoline', 1]])}만 챙기고 나머지는 교회로 보냈다.${shiftFaction(x.s, 'church', 10)}` },
    ],
  },
  raiders_vs_church: {
    title: '교회가 위험하다',
    icon: '🔥',
    text: (b) => `[${b}] 교회 쪽 하늘에 연기가 오른다. 약탈자들이 교회를 노리는 것 같다.`,
    fallback: 'stay',
    can: (x) => attitude(x.s, 'church') >= 20 && awake(x).length > 0,
    weight: () => 0.6,
    options: [
      {
        id: 'help', label: '도우러 간다', desc: '교회 태도 크게 +, 약탈자 태도 −, 다칠 수 있다',
        apply: (x) => {
          const c = pick(awake(x));
          if (chance(0.4)) hurt(c, '교회를 지키다 다쳤다');
          addRep(x.base, 3);
          return `${c.name}이(가) 달려가 함께 싸웠다. 약탈자들이 물러났다.${shiftFaction(x.s, 'church', 20)}${shiftFaction(x.s, 'raiders', -15)}`;
        },
      },
      { id: 'stay', label: '모른 척한다', desc: '교회 태도 −', apply: (x) => `연기는 밤늦게야 잦아들었다.${shiftFaction(x.s, 'church', -10)}` },
    ],
  },

  // ───────────── 계절 행사 ─────────────
  halloween: {
    title: '할로윈 밤',
    icon: '🎃',
    season: 'halloween',
    text: (b) => `[${b}] 누군가 창고에서 늙은 호박을 찾아왔다. "오늘 할로윈이잖아. 진짜 좀비 말고, 가짜 좀비 놀이 할래?"`,
    fallback: 'carve',
    options: [
      { id: 'carve', label: '호박 랜턴을 깎는다', desc: '호박 랜턴 소품, 모두 기분 좋음', apply: (x) => (cheer(x, 480, '할로윈 호박을 깎았다'), `삐뚤빼뚤한 얼굴이 촛불에 웃었다. ${give(x, [['p_pumpkin', 1]])}을(를) 얻었다.`) },
      {
        id: 'candy', label: '사탕을 나눠 먹는다', desc: '사탕, 서로 가까워짐',
        apply: (x) => {
          for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 4, 'halloween', 600);
          cheer(x, 240, '할로윈 사탕');
          return `"트릭 오어 트릿!" 숨겨 둔 ${give(x, [['candy', 3]])}을(를) 나눠 먹었다.`;
        },
      },
    ],
  },
  christmas: {
    title: '크리스마스',
    icon: '🎄',
    season: 'christmas',
    text: (b) => `[${b}] 달력을 보니 크리스마스다. 누군가 낡은 전구 줄을 꺼내 들었다.`,
    fallback: 'tree',
    options: [
      { id: 'tree', label: '트리를 세운다', desc: '크리스마스 트리 가구, 모두 기분 좋음', apply: (x) => (cheer(x, 720, '크리스마스 트리'), `소나무 가지에 전구를 감았다. ${give(x, [['f_xmas_tree', 1]])}을(를) 얻었다. 거점에 놓아 보자.`) },
      {
        id: 'gifts', label: '서로 선물을 준다', desc: '소품 선물, 모두 많이 가까워짐',
        apply: (x) => {
          for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 6, 'xmas', 600);
          cheer(x, 720, '크리스마스 선물');
          return `포장지 대신 신문지로 싼 선물들. ${give(x, [[pick(['p_teddy', 'p_cat_plush', 'p_music_box']), 1], ['chocolate', 2]])}.`;
        },
      },
    ],
  },
  newyear: {
    title: '새해 첫날',
    icon: '🎆',
    season: 'newyear',
    text: (b) => `[${b}] 자정. 멀리서 누군가 쏘아 올린 폭죽이 터졌다. 새해다.`,
    fallback: 'wish',
    options: [
      { id: 'wish', label: '새해 소원을 빈다', desc: '모두 기분 좋음', apply: (x) => (cheer(x, 720, '새해 소원'), x.people.forEach((c) => noteDay(c, '새해 소원을 빌었다. 올해도 살아남게 해 달라고.')), '각자 마음속으로 소원을 빌었다.') },
      { id: 'toast', label: '건배한다', desc: '음료 1개, 서로 가까워짐', apply: (x) => { for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 4, 'newyear', 600); cheer(x, 360, '새해 건배'); return '미지근한 탄산음료로 건배했다. "올해도 잘 부탁해!"'; } },
    ],
  },
  seollal: {
    title: '설날',
    icon: '🧧',
    season: 'seollal',
    text: (b) => `[${b}] 설날이다. 쌀이 조금 남아 있다면 떡국을 끓일 수 있을 텐데.`,
    fallback: 'bow',
    options: [
      { id: 'soup', label: '떡국을 끓인다', desc: '쌀 1개 → 떡국 여러 그릇', apply: (x) => (removeItem(x.base.storage, 'rice', 1) ? (cheer(x, 600, '설날 떡국'), `한 살 더 먹었다. ${give(x, [['tteokguk', Math.max(2, x.people.length)]])}.`) : '쌀이 없어 떡국은 끓이지 못했다. 그래도 덕담은 나눴다.') },
      { id: 'bow', label: '서로 세배한다', desc: '서로 가까워짐', apply: (x) => { for (let i = 0; i < x.people.length; i++) for (let j = i + 1; j < x.people.length; j++) bondUp(x.people[i].id, x.people[j].id, 5, 'seollal', 600); cheer(x, 360, '세배'); return '"새해 복 많이 받아." 어색하게 웃으며 절을 주고받았다.'; } },
    ],
  },
  chuseok: {
    title: '추석 보름달',
    icon: '🌕',
    season: 'chuseok',
    text: (b) => `[${b}] 유난히 크고 밝은 보름달이 떴다. 추석이다.`,
    fallback: 'wish',
    options: [
      { id: 'songpyeon', label: '송편을 빚는다', desc: '쌀 1개 → 송편', apply: (x) => (removeItem(x.base.storage, 'rice', 1) ? (cheer(x, 600, '송편을 빚었다'), `모양은 엉망이지만 맛있다. ${give(x, [['songpyeon', 4]])}.`) : '쌀이 없었다. 대신 달을 오래 바라봤다.') },
      { id: 'wish', label: '달에 소원을 빈다', desc: '소원 등불 소품, 모두 기분 좋음', apply: (x) => (cheer(x, 480, '보름달 소원'), x.people.forEach((c) => noteDay(c, '보름달에 소원을 빌었다.')), `등불에 소원을 적어 걸었다. ${give(x, [['p_lantern', 1]])}.`) },
    ],
  },
};

const voteKey = (eventId: string, player: string) => `${eventId}_${encodeURIComponent(player).replace(/\./g, '%2E')}`;
export const votesFor = (s: GameState, eventId: string) => Object.values(s.votes ?? {}).filter((v) => v.eventId === eventId);

function ctxOf(s: GameState, baseId: string, castIds: string[] = []): Ctx {
  return withBase(baseId, () => ({
    s,
    base: s.base,
    people: residentsOf(s, baseId).filter((c) => c.status === 'base' || c.status === 'down'),
    cast: castIds.map((id) => s.characters[id]).filter((c): c is Character => !!c),
  }));
}

/** {A} {B} 를 캐릭터 이름으로 */
export const fillCast = (text: string, names: string[]) => fixJosa(text.replace(/\{A\}/g, names[0] ?? '누군가').replace(/\{B\}/g, names[1] ?? '누군가'));

/** 게임 시간이 흐르는 동안 사건이 생길지 (실시간 진행 중일 때만) */
export function maybeStartEvent(minutes: number, now = Date.now()) {
  const s = store.s;
  if (s.event || minutes <= 0 || dayOf(s.time) < 1) return;
  // 하루에 서너 번쯤 (무전 탑이 있으면 더 자주)
  const towers = Object.values(s.bases).filter((b) => hasFacility(b, 'f_radio_tower'));
  // 무전 탑에 전기가 들어오면 더 멀리 닿는다
  const rate = towers.some((b) => powerOf(b, s).on) ? 1 / 3.5 : towers.length ? 1 / 4.5 : 1 / 7;
  if (!chance(1 - Math.pow(1 - rate, minutes / 60))) return;
  const bases = Object.keys(s.bases).filter((id) => residentsOf(s, id).some((c) => c.status === 'base'));
  if (!bases.length) return;
  const baseId = pick(bases);
  const x = ctxOf(s, baseId);
  const free = x.people.filter((c) => c.status === 'base');
  const season = currentSeason()?.id;
  const kinds = Object.entries(EVENTS).filter(([, d]) => (!d.cast || free.length >= d.cast) && (!d.season || d.season === season) && (!d.can || d.can(x)));
  if (!kinds.length) return;
  // 계절 행사는 그 기간에 자주 나온다
  const [kind, def] = pickWeighted(kinds.map((k) => ({ k, w: k[1].season ? 4 : (k[1].weight?.(x) ?? 1) }))).k;
  const cast = def.cast ? [...free].sort(() => Math.random() - 0.5).slice(0, def.cast).map((c) => c.id) : [];
  const ev: GameEvent = { id: uid('ev'), kind, baseId, at: now, expiresAt: now + VOTE_MS, cast };
  s.event = ev;
  const names = cast.map((id) => s.characters[id].name);
  addNews(fixJosa(`${def.icon} ${def.title}: ${def.text(s.bases[baseId].name, names)}`), 'info', `${def.icon} 사건: ${def.title}`);
  bus.emit('alert', { title: `${def.icon} 사건: ${def.title}`, text: '어떻게 할지 골라 주세요.', kind: 'info' });
}

export function vote(player: string, option: string) {
  const s = store.s;
  const ev = s.event;
  if (!ev || ev.resolvedAt) return;
  s.votes[voteKey(ev.id, player)] = { eventId: ev.id, player, option };
  store.commit();
}

/** 다 골랐거나 시간이 지났으면 정한다. 정해진 사건은 1분 뒤 사라진다 */
export function processEvent(now = Date.now()): boolean {
  const s = store.s;
  const ev = s.event;
  if (!ev) return false;
  if (ev.resolvedAt) {
    if (now - ev.resolvedAt > 90000) {
      s.event = null;
      for (const k of Object.keys(s.votes)) if (s.votes[k].eventId === ev.id) delete s.votes[k];
      return true;
    }
    return false;
  }
  const def = EVENTS[ev.kind];
  if (!def || !s.bases[ev.baseId]) {
    s.event = null;
    return true;
  }
  const votes = votesFor(s, ev.id);
  const need = onlinePlayers();
  const allIn = need.every((p) => votes.some((v) => v.player === p));
  if (!allIn && now < ev.expiresAt) return false;
  // 가장 많이 고른 것 (같으면 먼저 고른 쪽)
  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.option, (tally.get(v.option) ?? 0) + 1);
  let chosen = def.fallback;
  let best = 0;
  for (const v of votes) {
    const n = tally.get(v.option)!;
    if (n > best) {
      best = n;
      chosen = v.option;
    }
  }
  const opt = def.options.find((o) => o.id === chosen) ?? def.options[def.options.length - 1];
  const x = ctxOf(s, ev.baseId, ev.cast);
  if (def.cast && x.cast.length < def.cast) {
    s.event = null;
    return true;
  }
  const label = fillCast(opt.label, x.cast.map((c) => c.name));
  const result = fixJosa(withBase(ev.baseId, () => opt.apply(x)));
  ev.chosen = opt.id;
  ev.result = result;
  ev.resolvedAt = now;
  addNews(`${def.icon} [${def.title}] '${label}' → ${result}`, 'info', `${def.icon} ${def.title}: ${label}`);
  for (const c of x.people) noteDay(c, `${def.title} — ${label}.`);
  postRp('system', `${def.icon} ${def.title} — ${label}: ${result}`);
  return true;
}
