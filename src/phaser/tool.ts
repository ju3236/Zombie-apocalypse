import { useSyncExternalStore } from 'react';

export type Tool =
  | { kind: 'view' }
  | { kind: 'place'; itemId: string; rot: 0 | 1 | 2 | 3 }
  | { kind: 'move'; uid: string; itemId: string; rot: 0 | 1 | 2 | 3 }
  | { kind: 'build'; buildId: string }
  | { kind: 'demolish'; what: 'wall' | 'floor' }
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
