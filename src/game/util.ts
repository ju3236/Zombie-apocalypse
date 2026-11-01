export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const chance = (p: number) => Math.random() < p;

export function pickWeighted<T extends { w: number }>(list: T[]): T {
  const total = list.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of list) {
    r -= e.w;
    if (r <= 0) return e;
  }
  return list[list.length - 1];
}

export const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** 게임 시간(분) → "3일차 14:20" */
export function formatTime(t: number): string {
  const day = Math.floor(t / 1440) + 1;
  const m = t % 1440;
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = Math.floor(m % 60).toString().padStart(2, '0');
  return `${day}일차 ${hh}:${mm}`;
}

export const hourOf = (t: number) => Math.floor((t % 1440) / 60);
export const dayOf = (t: number) => Math.floor(t / 1440) + 1;
export const isNight = (t: number) => {
  const h = hourOf(t);
  return h >= 21 || h < 6;
};

export function formatDuration(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/** "작업대을(를)" → "작업대를" 처럼 한국어 조사를 받침에 맞춰 고른다 */
export function fixJosa(text: string): string {
  return text.replace(/([가-힣A-Za-z0-9])(\]?)(이\(가\)|을\(를\)|은\(는\)|과\(와\)|와\(과\)|\(으\)로|아\(야\))/g, (_, c: string, br: string, j: string) => {
    const ch = c + br;
    const code = c.charCodeAt(0);
    let batchim = false;
    let rieul = false;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const jong = (code - 0xac00) % 28;
      batchim = jong !== 0;
      rieul = jong === 8;
    } else if (/[0-9]/.test(c)) {
      batchim = '0136781'.includes(c);
      rieul = '178'.includes(c);
    }
    switch (j) {
      case '이(가)':
        return ch + (batchim ? '이' : '가');
      case '을(를)':
        return ch + (batchim ? '을' : '를');
      case '은(는)':
        return ch + (batchim ? '은' : '는');
      case '과(와)':
      case '와(과)':
        return ch + (batchim ? '과' : '와');
      case '아(야)':
        return ch + (batchim ? '아' : '야');
      default:
        return ch + (batchim && !rieul ? '으로' : '로');
    }
  });
}
