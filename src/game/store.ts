import { useSyncExternalStore } from 'react';
import { LocalSaveAdapter, type SaveAdapter } from './persistence';
import type { GameState, NewsItem } from './types';
import { fixJosa } from './util';

/**
 * 아주 단순한 전역 게임 스토어.
 * 상태는 직접 변경(mutate)하고 commit() 으로 변경을 알린다.
 * React 는 rev 값으로 리렌더링하고, Phaser 씬은 subscribe 로 갱신한다.
 */
type Listener = () => void;

let state: GameState | null = null;
let rev = 0;
const listeners = new Set<Listener>();
let saveTimer: number | undefined;
let lastSave = 0;
export const adapter: SaveAdapter = new LocalSaveAdapter();

export const store = {
  get has() {
    return state !== null;
  },
  get s(): GameState {
    if (!state) throw new Error('월드가 로드되지 않았습니다.');
    return state;
  },
  set(next: GameState | null) {
    state = next;
    this.commit();
  },
  commit() {
    rev++;
    listeners.forEach((l) => l());
    if (state) scheduleSave();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  rev: () => rev,
};

/** 디바운스 저장 (연속 조작 중에도 최소 3초마다는 저장) */
function scheduleSave() {
  window.clearTimeout(saveTimer);
  if (Date.now() - lastSave > 3000) return saveNow();
  saveTimer = window.setTimeout(saveNow, 600);
}

export function saveNow() {
  window.clearTimeout(saveTimer);
  lastSave = Date.now();
  if (state) {
    state.lastRealTime = Date.now();
    void adapter.save(state);
  }
}

export function useGameRev(): number {
  return useSyncExternalStore(store.subscribe, store.rev);
}

export function addNews(text: string, kind?: NewsItem['kind'], alert?: string) {
  const s = store.s;
  s.news.unshift(alert ? { t: s.time, text: fixJosa(text), kind, alert } : { t: s.time, text: fixJosa(text), kind });
  if (s.news.length > 80) s.news.length = 80;
}

// ───────────── 세션(브라우저별) 상태: 현재 플레이어, 조종 캐릭터, 화면 ─────────────

export type Tab = 'main' | 'characters' | 'storage' | 'chat' | 'settings';
export type MainView = 'base' | 'outside';
export type StorageSub = 'items' | 'craft';

export interface Session {
  player: string;
  activeCharacterId: string | null;
  /** 생존자 탭에서 보고 있는 캐릭터 */
  viewCharId: string | null;
  tab: Tab;
  /** 메인 화면: 거점 / 지도·탐험 */
  mainView: MainView;
  /** 창고 화면: 물품 / 제작 */
  storageSub: StorageSub;
  /** 휴대폰 화면에서 보이는 칸: 가운데(본문) / 왼쪽(상태·명단) / 오른쪽(내 캐릭터·채팅) */
  pane?: 'center' | 'left' | 'right';
  /** 프로필에서 열 탭 (한 번 쓰고 비운다) */
  profileSec?: string | null;
}

const DEFAULT_SESSION: Session = { player: '', activeCharacterId: null, viewCharId: null, tab: 'main', mainView: 'base', storageSub: 'items' };

/** 예전 탭 이름(base/map/expedition/crafting/rp)을 새 구조로 옮긴다 */
function normalize(raw: Record<string, unknown>): Session {
  const s = { ...DEFAULT_SESSION, ...raw } as Session;
  const old = raw.tab as string | undefined;
  if (old === 'base') Object.assign(s, { tab: 'main', mainView: 'base' });
  if (old === 'map' || old === 'expedition') Object.assign(s, { tab: 'main', mainView: 'outside' });
  if (old === 'crafting') Object.assign(s, { tab: 'storage', storageSub: 'craft' });
  if (old === 'rp') s.tab = 'chat';
  if (!['main', 'characters', 'storage', 'chat', 'settings'].includes(s.tab)) s.tab = 'main';
  return s;
}

const SESSION_KEY = 'zsb-session-v1';
let session: Session = (() => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* noop */
  }
  return { ...DEFAULT_SESSION };
})();
let sessionRev = 0;
const sessionListeners = new Set<Listener>();

export const sessionStore = {
  get: () => session,
  update(patch: Partial<Session>) {
    // 화면(탭)을 바꾸면 휴대폰에서는 본문 칸으로 돌아온다
    if ((patch.tab !== undefined || patch.mainView !== undefined || patch.storageSub !== undefined) && patch.pane === undefined) patch = { ...patch, pane: 'center' };
    session = { ...session, ...patch };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionRev++;
    sessionListeners.forEach((l) => l());
  },
  subscribe(l: Listener) {
    sessionListeners.add(l);
    return () => sessionListeners.delete(l);
  },
};

export function useSession(): Session {
  useSyncExternalStore(sessionStore.subscribe, () => sessionRev);
  return session;
}
