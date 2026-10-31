import type { GameState } from '../types';

/**
 * 실시간 시계.
 * 게임 시간(분) = anchorGame + (지금 - anchorReal) × scale
 * - real: 현실 시계와 같은 시각 (현실 밤 11시면 게임도 밤 11시), 하루 = 실제 하루
 * - x2 / x4: 배속
 */
export const CLOCK_MODES: { id: NonNullable<GameState['settings']['clockMode']>; label: string; scale: number }[] = [
  { id: 'real', label: '현실 시계와 같게', scale: 1 },
  { id: 'x2', label: '2배 빠르게 (하루 = 12시간)', scale: 2 },
  { id: 'x4', label: '4배 빠르게 (하루 = 6시간)', scale: 4 },
];

const localMinutes = (now: number) => {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

/** 지금 게임 시간을 기준으로 시계 기준점을 새로 잡는다 (모드를 바꿀 때) */
export function makeClock(s: Pick<GameState, 'time' | 'settings'>, now = Date.now()): GameState['clock'] {
  const mode = s.settings.clockMode ?? 'real';
  if (mode === 'real') {
    // 오늘 날짜는 유지하고 시각만 현실에 맞춘다. 시간이 거꾸로 가면 다음 날로.
    let anchorGame = Math.floor(s.time / 1440) * 1440 + localMinutes(now);
    if (anchorGame < s.time) anchorGame += 1440;
    return { anchorReal: now, anchorGame, scale: 1 };
  }
  const scale = CLOCK_MODES.find((m) => m.id === mode)?.scale ?? 1;
  return { anchorReal: now, anchorGame: s.time, scale };
}

/** 지금 있어야 할 게임 시간 */
export function clockTarget(s: GameState, now = Date.now()): number {
  const c = s.clock;
  return c.anchorGame + ((now - c.anchorReal) / 60000) * c.scale;
}

/** 실제 시간(분)을 게임 시간(분)으로 */
export const realToGame = (s: GameState, realMin: number) => realMin * (s.clock?.scale ?? 1);
