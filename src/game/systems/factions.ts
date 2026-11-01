import type { GameState } from '../types';
import { clamp } from '../util';

/**
 * 세력: 도시에 남은 다른 무리들. 사건으로 만나고, 어떻게 대하느냐에 따라 태도가 바뀐다.
 */

export interface FactionDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const FACTIONS: Record<string, FactionDef> = {
  raiders: { id: 'raiders', name: '약탈자 무리', icon: '🏴', desc: '고속도로 휴게소를 근거지로 삼은 무장 집단. 힘이 곧 법이다.' },
  church: { id: 'church', name: '언덕 교회 공동체', icon: '⛪', desc: '아이와 노인을 돌보는 사람들. 의약품이 늘 모자라다.' },
  military: { id: 'military', name: '군 잔존 부대', icon: '🎖️', desc: '명령 체계가 무너진 뒤에도 남은 소대. 무전으로만 연락이 닿는다.' },
};

export const FACTION_IDS = Object.keys(FACTIONS);

export function attitude(s: GameState, id: string): number {
  return s.factions?.[id] ?? 0;
}

export function shiftFaction(s: GameState, id: string, n: number): string {
  s.factions ??= {};
  const before = attitude(s, id);
  s.factions[id] = clamp(before + n, -100, 100);
  const f = FACTIONS[id];
  return ` (${f.icon}${f.name} ${n >= 0 ? '+' : ''}${n})`;
}

export function attitudeLabel(n: number): { text: string; kind: 'good' | 'bad' | 'info' } {
  if (n <= -50) return { text: '적대', kind: 'bad' };
  if (n < -10) return { text: '경계', kind: 'bad' };
  if (n < 25) return { text: '중립', kind: 'info' };
  if (n < 60) return { text: '우호', kind: 'good' };
  return { text: '동맹', kind: 'good' };
}
