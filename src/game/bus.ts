import { fixJosa } from './util';

// React ↔ Phaser 사이의 일회성 이벤트 버스
export interface BusEvents {
  speech: { characterId: string; text: string };
  sitTogether: { a: string; b: string };
  focusCharacter: { characterId: string };
  selectFurniture: { uid: string | null };
  selectCharacter: { characterId: string | null };
  toast: { text: string; kind?: 'good' | 'bad' | 'info' };
  openContainer: { uid: string | null };
  /** 거점 화면 확대/축소 (+1 / -1) */
  zoom: { dir: number };
  /** 거점 화면을 사진으로 찍는다 */
  snapshot: { caption: string };
  /** 사진첩 열기 */
  openAlbum: Record<string, never>;
  /** 화면 설정이 바뀜 */
  viewPrefs: Record<string, never>;
  /** 알림: characterId 가 있으면 그 캐릭터 주인에게만 */
  alert: { characterId?: string; title: string; text: string; kind: 'good' | 'bad' | 'info' };
}

type Handler<K extends keyof BusEvents> = (p: BusEvents[K]) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, Set<(p: any) => void>> = {};

export const bus = {
  on<K extends keyof BusEvents>(k: K, h: Handler<K>): () => void {
    const set = (handlers[k] ??= new Set());
    set.add(h);
    return () => set.delete(h);
  },
  emit<K extends keyof BusEvents>(k: K, p: BusEvents[K]) {
    handlers[k]?.forEach((h) => h(p));
  },
};

export const toast = (text: string, kind?: 'good' | 'bad' | 'info') => bus.emit('toast', { text: fixJosa(text), kind });
