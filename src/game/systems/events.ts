import { bus } from '../bus';
import { ITEMS } from '../data/items';
import { LOCATION_BY_ID } from '../data/locations';
import { residentsOf } from '../homes';
import { addItem, countItem, removeItem } from '../inventory';
import { onlinePlayers } from '../online';
import { addNews, store, withBase } from '../store';
import type { Character, GameEvent, GameState } from '../types';
import { chance, dayOf, fixJosa, hourOf, pick, rand, uid } from '../util';
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
  text: (baseName: string) => string;
  options: Option[];
  /** 아무도 고르지 않았을 때 */
  fallback: string;
  can?: (x: Ctx) => boolean;
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
        id: 'adopt', label: '거둔다', desc: '식량 2개, 오래 기분 좋음, 서로 가까워짐',
        apply: (x) => {
          spendFood(x, 2);
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
};

const voteKey = (eventId: string, player: string) => `${eventId}_${encodeURIComponent(player).replace(/\./g, '%2E')}`;
export const votesFor = (s: GameState, eventId: string) => Object.values(s.votes ?? {}).filter((v) => v.eventId === eventId);

function ctxOf(s: GameState, baseId: string): Ctx {
  return withBase(baseId, () => ({ s, base: s.base, people: residentsOf(s, baseId).filter((c) => c.status === 'base' || c.status === 'down') }));
}

/** 게임 시간이 흐르는 동안 사건이 생길지 (실시간 진행 중일 때만) */
export function maybeStartEvent(minutes: number, now = Date.now()) {
  const s = store.s;
  if (s.event || minutes <= 0 || dayOf(s.time) < 1) return;
  // 하루에 서너 번쯤
  if (!chance(1 - Math.pow(1 - 1 / 7, minutes / 60))) return;
  const bases = Object.keys(s.bases).filter((id) => residentsOf(s, id).some((c) => c.status === 'base'));
  if (!bases.length) return;
  const baseId = pick(bases);
  const x = ctxOf(s, baseId);
  const kinds = Object.entries(EVENTS).filter(([, d]) => !d.can || d.can(x));
  if (!kinds.length) return;
  const [kind, def] = pick(kinds);
  const ev: GameEvent = { id: uid('ev'), kind, baseId, at: now, expiresAt: now + VOTE_MS };
  s.event = ev;
  addNews(`${def.icon} ${def.title}: ${def.text(s.bases[baseId].name)}`, 'info', `${def.icon} 사건: ${def.title}`);
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
  const x = ctxOf(s, ev.baseId);
  const result = fixJosa(withBase(ev.baseId, () => opt.apply(x)));
  ev.chosen = opt.id;
  ev.result = result;
  ev.resolvedAt = now;
  addNews(`${def.icon} [${def.title}] '${opt.label}' → ${result}`, 'info', `${def.icon} ${def.title}: ${opt.label}`);
  postRp('system', `${def.icon} ${def.title} — ${opt.label}: ${result}`);
  return true;
}
