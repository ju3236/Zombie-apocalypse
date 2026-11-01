/** 화면 설정 (이 브라우저에만 저장) */
import { bus } from './bus';

const KEY = 'zsb-view-v1';
export type NightDark = 'normal' | 'light' | 'off';
export interface ViewPrefs {
  nightDark: NightDark;
}
export const NIGHT_LABEL: Record<NightDark, string> = { normal: '진하게 (기본)', light: '옅게', off: '끄기 (밤에도 밝게)' };

export function viewPrefs(): ViewPrefs {
  try {
    return { nightDark: 'normal', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { nightDark: 'normal' };
  }
}
export function setViewPrefs(p: Partial<ViewPrefs>) {
  localStorage.setItem(KEY, JSON.stringify({ ...viewPrefs(), ...p }));
  bus.emit('viewPrefs', {});
}
