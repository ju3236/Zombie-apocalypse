/** 거점(집) 고르기·만들기 */
import { makeBase, starterKit } from './newGame';
import type { Character, GameState } from './types';
import { CENTERS, D, starters } from './world/cityGen';

const KIND: Partial<Record<number, string[]>> = {
  [D.Residential]: ['판잣집', '단독주택', '반지하 집', '빌라'],
  [D.Local]: ['상가 2층 방', '원룸'],
  [D.Commercial]: ['옥탑방', '원룸'],
  [D.Farm]: ['농가'],
  [D.Harbor]: ['컨테이너 하우스'],
};

/** 집 후보 이름: 동네 + 집 종류 (예: 은행나무동 옥탑방) */
export function starterLabel(i: number): { area: string; kind: string } {
  const st = starters()[i] ?? starters()[0];
  const cx = st.x + st.w / 2;
  const cy = st.y + st.h / 2;
  const area = [...CENTERS].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]?.name ?? '';
  const kinds = KIND[st.d] ?? ['빈집'];
  return { area, kind: i === 0 ? '판잣집' : kinds[i % kinds.length] };
}

/** 아무도 쓰지 않는 집 후보 */
export function freeStarters(s: GameState): number[] {
  const used = new Set(Object.values(s.bases).map((b) => b.starter));
  return starters()
    .map((_, i) => i)
    .filter((i) => !used.has(i));
}

/** 새 집을 만들어 그 id 를 돌려준다 */
export function createHome(s: GameState, ownerName: string, starter: number, withKit = true): string {
  const { kind } = starterLabel(starter);
  // 새로 시작하는 캐릭터만 최소한의 짐을 받는다 (이사로 옮겨 간 빈 집은 빈손)
  const b = makeBase(`${ownerName}의 ${kind}`, starter, withKit ? starterKit() : []);
  s.bases[b.id] = b;
  return b.id;
}

export const residentsOf = (s: GameState, baseId: string) =>
  s.characterOrder.map((id) => s.characters[id]).filter((c) => c && c.homeId === baseId && c.status !== 'dead');

/**
 * 이 거점을 손댈 수 있는지 (가구·창고·건축).
 * 빈 집이거나, 내 캐릭터가 사는 집이면 된다. 남의 캐릭터만 사는 집은 구경만.
 */
export function canEdit(s: GameState, baseId: string, player: string): boolean {
  const who = residentsOf(s, baseId).filter((c) => !c.npc);
  return who.length === 0 || who.some((c) => c.owner === player);
}

/** 이 플레이어가 조종할 수 있는 캐릭터인지 (내 캐릭터 또는 NPC 생존자) */
export const controls = (c: Character | undefined | null, player: string) => !!c && (c.owner === player || !!c.npc);
