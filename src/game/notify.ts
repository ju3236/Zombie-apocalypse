/**
 * 알림: 화면 안 토스트 + 효과음 + (다른 탭을 보고 있을 때) 브라우저 알림.
 * 효과음·브라우저 알림 설정은 이 브라우저에만 저장한다.
 */
import { toast } from './bus';

const KEY = 'zsb-notify-v1';
export interface NotifyPrefs {
  sound: boolean;
  desktop: boolean;
}

export function notifyPrefs(): NotifyPrefs {
  try {
    return { sound: true, desktop: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { sound: true, desktop: true };
  }
}
export function setNotifyPrefs(p: Partial<NotifyPrefs>) {
  localStorage.setItem(KEY, JSON.stringify({ ...notifyPrefs(), ...p }));
}

export const desktopSupported = () => typeof Notification !== 'undefined';
export const desktopPermission = () => (desktopSupported() ? Notification.permission : 'denied');
export async function askDesktopPermission(): Promise<NotificationPermission> {
  if (!desktopSupported()) return 'denied';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

let audio: AudioContext | null = null;
/** 짧은 도트풍 효과음 */
function beep(kind: 'good' | 'bad' | 'info') {
  try {
    audio ??= new AudioContext();
    const notes = kind === 'bad' ? [220, 165, 220, 165] : kind === 'good' ? [523, 659, 784] : [659, 523];
    let t = audio.currentTime;
    for (const f of notes) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.14);
      t += 0.12;
    }
  } catch {
    /* 소리를 낼 수 없는 환경 */
  }
}

export function notify(title: string, text: string, kind: 'good' | 'bad' | 'info' = 'info') {
  toast(`${title} ${text}`, kind);
  const p = notifyPrefs();
  if (p.sound) beep(kind);
  if (p.desktop && document.hidden && desktopPermission() === 'granted') {
    try {
      new Notification(title, { body: text, icon: 'favicon.svg', tag: title });
    } catch {
      /* 무시 */
    }
  }
}
