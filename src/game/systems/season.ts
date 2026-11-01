/**
 * 계절 행사: 현실 날짜에 맞춰 열린다.
 */

export interface Season {
  id: 'halloween' | 'christmas' | 'seollal' | 'chuseok' | 'newyear';
  name: string;
  icon: string;
  desc: string;
}

export const SEASONS: Record<Season['id'], Season> = {
  halloween: { id: 'halloween', name: '할로윈', icon: '🎃', desc: '좀비가 진짜인 세상의 할로윈. 호박을 깎고 사탕을 나눠 보자.' },
  christmas: { id: 'christmas', name: '크리스마스', icon: '🎄', desc: '트리를 세우고 선물을 나누자. 눈이 오면 더 좋겠지.' },
  newyear: { id: 'newyear', name: '새해', icon: '🎆', desc: '새해 첫날. 올해도 살아남자.' },
  seollal: { id: 'seollal', name: '설날', icon: '🧧', desc: '떡국 한 그릇에 한 살 더. 서로에게 세배를 하자.' },
  chuseok: { id: 'chuseok', name: '추석', icon: '🌕', desc: '보름달에 소원을 빌고 송편을 빚자.' },
};

/** 음력 명절 (양력 날짜) */
const LUNAR: Record<number, { seollal: string; chuseok: string }> = {
  2025: { seollal: '01-29', chuseok: '10-06' },
  2026: { seollal: '02-17', chuseok: '09-25' },
  2027: { seollal: '02-07', chuseok: '09-15' },
  2028: { seollal: '01-27', chuseok: '10-03' },
  2029: { seollal: '02-13', chuseok: '09-22' },
  2030: { seollal: '02-03', chuseok: '09-12' },
};

const within = (d: Date, md: string, before: number, after: number) => {
  const [m, day] = md.split('-').map(Number);
  const t = new Date(d.getFullYear(), m - 1, day).getTime();
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return x >= t - before * 86400000 && x <= t + after * 86400000;
};

/** 오늘(현실 날짜) 열리는 행사 */
export function currentSeason(d = new Date()): Season | null {
  if (within(d, '10-31', 7, 1)) return SEASONS.halloween;
  if (within(d, '12-25', 7, 2)) return SEASONS.christmas;
  if (within(d, '01-01', 1, 1) || (d.getMonth() === 11 && d.getDate() === 31)) return SEASONS.newyear;
  const l = LUNAR[d.getFullYear()];
  if (l && within(d, l.seollal, 2, 2)) return SEASONS.seollal;
  if (l && within(d, l.chuseok, 2, 2)) return SEASONS.chuseok;
  return null;
}
