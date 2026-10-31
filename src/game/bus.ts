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
