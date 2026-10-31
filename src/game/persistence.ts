import type { GameState } from './types';

/**
 * 저장소 어댑터. 지금은 브라우저 localStorage 를 사용하고,
 * 2인 동기화 단계에서 Firebase(Firestore / Realtime DB) 어댑터로 교체한다.
 */
export interface SaveAdapter {
  readonly name: string;
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
  /** 원격 저장소의 변경 구독 (동기화 어댑터만 구현) */
  subscribe?(onRemote: (state: GameState) => void): () => void;
}

const KEY = 'zsb-world-v1';

export class LocalSaveAdapter implements SaveAdapter {
  readonly name = '브라우저 로컬 저장';
  async load(): Promise<GameState | null> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GameState;
    } catch {
      console.error('세이브 파일이 손상되었습니다.');
      return null;
    }
  }
  async save(state: GameState): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  async clear(): Promise<void> {
    localStorage.removeItem(KEY);
  }
}

export function exportSave(state: GameState): void {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.worldName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function readSaveFile(file: File): Promise<GameState> {
  const text = await file.text();
  const data = JSON.parse(text) as GameState;
  if (!data || typeof data !== 'object' || !data.characters || !data.base) {
    throw new Error('올바른 세이브 파일이 아닙니다.');
  }
  return data;
}
