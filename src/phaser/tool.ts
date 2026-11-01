import { useSyncExternalStore } from 'react';

/** 벽 방향: 자동 · ↘ · ↙ */
export type WallDir = 'auto' | 'x' | 'y';

export type Tool =
  | { kind: 'view' }
  | { kind: 'place'; itemId: string; rot: 0 | 1 | 2 | 3 }
  | { kind: 'move'; uid: string; itemId: string; rot: 0 | 1 | 2 | 3 }
  | { kind: 'build'; buildId: string; dir?: WallDir }
  | { kind: 'demolish'; what: 'wall' | 'floor' }
  /** 벽·바닥 옮기기: 첫 클릭으로 집고, 두 번째 클릭으로 놓는다 */
  | { kind: 'moveBuild'; what: 'wall' | 'floor'; picked?: { x: number; y: number } }
  | { kind: 'prop'; propId: string };

let tool: Tool = { kind: 'view' };
const ls = new Set<() => void>();

export const toolStore = {
  get: () => tool,
  set(t: Tool) {
    tool = t;
    ls.forEach((l) => l());
  },
  subscribe(l: () => void) {
    ls.add(l);
    return () => ls.delete(l);
  },
};

export function useTool(): Tool {
  return useSyncExternalStore(toolStore.subscribe, toolStore.get);
}
