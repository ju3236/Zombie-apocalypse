import { FURNITURE } from '../data/furniture';
import type { Character, GameState, WeatherKind } from '../types';
import { pickWeighted, rand } from '../util';

/**
 * 날씨. 몇 시간마다 바뀌고, 현실의 계절(달)에 따라 잘 나오는 날씨가 다르다.
 */
export interface WeatherDef {
  name: string;
  icon: string;
  desc: string;
  /** 탐험 중 좀비를 만날 확률 배수 (빗소리가 발소리를 덮는다 등) */
  encounter: number;
  /** 빗물 수집통 생산 배수 */
  water: number;
  /** 이동 시간 배수 */
  travel: number;
  /** 거점 습격 확률 배수 */
  raid: number;
}

export const WEATHER: Record<WeatherKind, WeatherDef> = {
  clear: { name: '맑음', icon: '☀️', desc: '특별한 영향 없음', encounter: 1, water: 1, travel: 1, raid: 1 },
  cloudy: { name: '흐림', icon: '☁️', desc: '특별한 영향 없음', encounter: 1, water: 1, travel: 1, raid: 1 },
  rain: { name: '비', icon: '🌧️', desc: '빗물 수집통 ×3 · 빗소리에 탐험 중 좀비와 덜 마주침(-15%) · 밖에 있으면 젖음', encounter: 0.85, water: 3, travel: 1, raid: 0.8 },
  storm: { name: '폭풍우', icon: '⛈️', desc: '빗물 수집통 ×4 · 좀비와 덜 마주침(-30%) · 이동 시간 +30% · 밖에 있으면 젖음 · 습격 줄어듦', encounter: 0.7, water: 4, travel: 1.3, raid: 0.5 },
  fog: { name: '안개', icon: '🌫️', desc: '앞이 안 보여 좀비와 더 마주침(+20%) · 습격이 늘어남', encounter: 1.2, water: 1, travel: 1.1, raid: 1.4 },
  heat: { name: '폭염', icon: '🥵', desc: '모두 목마름이 빨리 옴 (더위)', encounter: 1, water: 1, travel: 1, raid: 1 },
  cold: { name: '한파', icon: '🥶', desc: '불 없는 거점·상의 없이 탐험하면 추위 (기력·배고픔 소모 증가)', encounter: 0.9, water: 1, travel: 1.1, raid: 0.8 },
};

/** 현실 달에 따른 날씨 확률 */
function table(month: number): [WeatherKind, number][] {
  if (month === 12 || month <= 2) return [['clear', 25], ['cloudy', 25], ['cold', 30], ['fog', 10], ['rain', 5], ['storm', 5]];
  if (month >= 6 && month <= 8) return [['clear', 25], ['cloudy', 15], ['heat', 30], ['rain', 20], ['storm', 10]];
  if (month === 11) return [['clear', 25], ['cloudy', 25], ['rain', 15], ['fog', 15], ['cold', 15], ['storm', 5]];
  return [['clear', 30], ['cloudy', 25], ['rain', 20], ['fog', 15], ['storm', 5], ['cold', 5]];
}

export function rollWeather(s: Pick<GameState, 'time'>): GameState['weather'] {
  const t = table(new Date().getMonth() + 1);
  const kind = pickWeighted(t.map(([itemId, w]) => ({ itemId, w }))).itemId as WeatherKind;
  return { kind, until: s.time + rand(3, 8) * 60 };
}

export const weatherOf = (s: Partial<Pick<GameState, 'weather'>>) => WEATHER[s.weather?.kind ?? 'clear'];
export const isWet = (s: Partial<Pick<GameState, 'weather'>>) => s.weather?.kind === 'rain' || s.weather?.kind === 'storm';

/** 거점에 불(모닥불·벽난로·스토브·가스레인지)이 있는지 */
export const hasHeat = (s: Pick<GameState, 'base'>) => !!s.base?.furniture.some((f) => FURNITURE[f.itemId]?.station === 'stove');

/** 추운 상태인지 (한파일 때). 거점에 있으면 그 캐릭터의 집에 불이 있는지 본다 */
export function isCold(c: Character, s: Partial<Pick<GameState, 'weather' | 'base' | 'bases'>>): boolean {
  if (s.weather?.kind !== 'cold') return false;
  const home = s.bases?.[c.homeId] ?? s.base;
  if (c.status === 'base' || c.status === 'down') return !(home && hasHeat({ base: home }));
  if (c.status === 'expedition') return !c.wear?.top;
  return false;
}
