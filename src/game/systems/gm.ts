import { ITEMS } from '../data/items';
import { xpForLevel } from '../data/jobs';
import { LOCATION_BY_ID, LOCATIONS } from '../data/locations';
import { addItem, addStack } from '../inventory';
import { addNews, store, withBase } from '../store';
import type { Character, GameState, WeatherKind } from '../types';
import { clamp, fixJosa } from '../util';
import { addRep } from './baseLevel';
import { spawnMerchant } from './merchant';
import { makeNpc } from './npc';
import { RAID_WARN_MS } from './raid';
import { postRp } from './rp';
import { WEATHER } from './weather';

/**
 * GM(운영자) 도구. 하는 일은 모두 거점 소식에 「🛠️ GM」으로 남는다.
 */

export const isGm = (s: GameState | null, player: string) => !!s && !!player && (s.settings.gms ?? []).includes(player);

function gmLog(text: string) {
  addNews(fixJosa(`🛠️ GM: ${text}`), 'info');
  store.commit();
}

// ───────────── 아이템 ─────────────

export type GiveTarget = { kind: 'char' | 'base'; id: string };

export function giveItem(t: GiveTarget, itemId: string, qty: number): string | null {
  const s = store.s;
  const d = ITEMS[itemId];
  if (!d || qty <= 0) return '아이템과 개수를 확인해 주세요.';
  const n = Math.min(999, Math.floor(qty));
  if (t.kind === 'char') {
    const c = s.characters[t.id];
    if (!c) return '캐릭터가 없습니다.';
    addItem(c.inventory, itemId, n);
    gmLog(`${c.name}에게 ${d.icon}${d.name} ${n}개 지급`);
  } else {
    const b = s.bases[t.id];
    if (!b) return '거점이 없습니다.';
    addItem(b.storage, itemId, n);
    gmLog(`[${b.name}] 창고에 ${d.icon}${d.name} ${n}개 지급`);
  }
  return null;
}

export function takeItem(t: GiveTarget, stackUid: string): void {
  const s = store.s;
  const inv = t.kind === 'char' ? s.characters[t.id]?.inventory : s.bases[t.id]?.storage;
  if (!inv) return;
  const i = inv.findIndex((x) => x.uid === stackUid);
  if (i < 0) return;
  const [st] = inv.splice(i, 1);
  gmLog(`${t.kind === 'char' ? s.characters[t.id].name : `[${s.bases[t.id].name}]`}의 ${ITEMS[st.itemId]?.name} ${st.qty}개 회수`);
}

// ───────────── 캐릭터 ─────────────

export function setVitals(c: Character, v: Partial<Pick<Character, 'health' | 'hunger' | 'thirst' | 'energy' | 'infection'>>) {
  for (const [k, val] of Object.entries(v)) (c as unknown as Record<string, number>)[k] = clamp(Number(val), 0, 100);
  store.commit(); // 슬라이더를 움직일 때마다 소식이 쌓이지 않게 기록은 남기지 않는다
}

export function healFull(c: Character) {
  c.health = 100;
  c.hunger = 100;
  c.thirst = 100;
  c.energy = 100;
  c.infection = 0;
  c.injuries = [];
  c.effects = (c.effects ?? []).filter((e) => !['shaken', 'food_poison', 'wet', 'carsick'].includes(e.id));
  if (c.status === 'down' || c.status === 'dead') c.status = 'base';
  gmLog(`${c.name} 완전 회복`);
}

export function setSkill(c: Character, skill: keyof Character['skills'], lvl: number) {
  c.skills[skill] = xpForLevel(clamp(Math.round(lvl), 0, 10));
  store.commit();
}

/** 탐험·이사·심부름 중인 캐릭터를 바로 집으로 (들고 있던 건 창고로) */
export function sendHome(c: Character) {
  const s = store.s;
  withBase(c.homeId, () => {
    const e = s.expeditions[c.id];
    if (e) {
      for (const st of c.inventory) addStack(s.storage, st);
      c.inventory = [];
      if (e.vehicle) addStack(s.storage, e.vehicle);
      delete s.expeditions[c.id];
    }
    if (c.move) {
      for (const st of c.move.items) addStack(s.storage, st);
      delete c.move;
    }
    if (c.errand) delete c.errand;
    c.status = 'base';
  });
  gmLog(`${c.name}을(를) 거점으로 불러들임`);
}

export function setTraits(c: Character, traits: string[]) {
  c.traits = traits;
  gmLog(`${c.name} 특성 변경`);
}

// ───────────── 세계 ─────────────

/** 시간을 앞으로 돌린다 (시계 기준점을 옮겨 실시간 진행이 따라잡게 한다) */
export function skipHours(h: number) {
  const s = store.s;
  s.clock.anchorGame += Math.round(h * 60);
  gmLog(`시간 ${h}시간 앞으로`);
}

export function setWeather(kind: WeatherKind, hours = 6) {
  const s = store.s;
  s.weather = { kind, until: s.time + hours * 60 };
  gmLog(`날씨를 ${WEATHER[kind].name}(으)로 (${hours}시간)`);
}

export function startRaid(baseId: string, size: number) {
  const s = store.s;
  const now = Date.now();
  s.raid = { baseId, arriveAt: now + RAID_WARN_MS, warnedAt: now, size };
  addNews(`🧟 좀비 떼 ${size}마리가 [${s.bases[baseId]?.name}] 쪽으로 몰려온다! 10분 뒤 도착한다.`, 'bad', '🧟 습격 경보');
  gmLog(`[${s.bases[baseId]?.name}]에 습격 ${size}마리`);
}

export function cancelRaid() {
  store.s.raid = null;
  gmLog('습격 취소');
}

export function gmSpawnMerchant() {
  const s = store.s;
  if (s.merchant) {
    delete s.locations[s.merchant.locationId];
    s.merchant = null;
  }
  spawnMerchant(s);
  gmLog('유랑 상인 소환');
}

export function gmDismissMerchant() {
  const s = store.s;
  if (!s.merchant) return;
  if (!Object.values(s.expeditions).some((e) => e.locationId === s.merchant!.locationId)) delete s.locations[s.merchant.locationId];
  s.merchant = null;
  gmLog('유랑 상인 떠나보냄');
}

export function gmSpawnNpc(baseId: string): string | null {
  const c = makeNpc(baseId);
  if (!c) return '그 거점에는 NPC 자리가 없습니다 (최대 3명).';
  gmLog(`[${store.s.bases[baseId].name}]에 NPC ${c.name} 합류`);
  return null;
}

export function setFaction(id: string, v: number) {
  store.s.factions[id] = clamp(Math.round(v), -100, 100);
  store.commit();
}

export function discoverAll() {
  const s = store.s;
  let n = 0;
  for (const l of LOCATIONS) {
    const ls = s.locations[l.id];
    if (ls && !ls.discovered) {
      ls.discovered = true;
      n++;
    }
  }
  gmLog(`숨은 장소 ${n}곳 공개`);
}

export function restockAll() {
  const s = store.s;
  for (const [id, ls] of Object.entries(s.locations)) {
    const def = LOCATION_BY_ID[id];
    if (!def) continue;
    for (const z of def.zones) for (const sp of z.spots) if (ls.zones[z.id]?.spots[sp.id]) ls.zones[z.id].spots[sp.id].remaining = sp.capacity;
  }
  gmLog('모든 탐험지 물자 다시 채움');
}

export function gmAddRep(baseId: string, n: number) {
  addRep(store.s.bases[baseId], n);
  gmLog(`[${store.s.bases[baseId]?.name}] 평판 ${n > 0 ? '+' : ''}${n}`);
}

export function announce(text: string) {
  const t = text.trim();
  if (!t) return;
  postRp('system', `📢 [공지] ${t}`);
  store.commit();
}

export function setGms(list: string[]) {
  store.s.settings.gms = [...new Set(list.filter(Boolean))];
  gmLog(`GM 목록: ${store.s.settings.gms.join(', ')}`);
}
