/**
 * 같이 살기: Firebase Realtime Database 로 두 사람이 같은 월드를 공유한다.
 *
 * 구조: worlds/{code}/parts/{key} = JSON 문자열
 *   - 섹션별로 나눠 저장 (캐릭터 하나하나, 탐험 하나하나, 거점, 창고, 지도 상태, 채팅 …)
 *     서로 다른 걸 고치면 덮어쓰지 않는다. 같은 섹션을 동시에 고치면 나중 것이 남는다.
 *   - 채팅·소식은 덮어쓰지 않고 합친다.
 *   worlds/{code}/presence/{player} = 접속 중 표시
 */
import { initializeApp, deleteApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  connectDatabaseEmulator, get, getDatabase, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, onValue, ref, remove, set, update,
  type Database, type Unsubscribe,
} from 'firebase/database';
import { syncWorld } from './newGame';
import { bus } from './bus';
import { sessionStore, store } from './store';
import type { GameState, NewsItem, RpMessage } from './types';
import { useSyncExternalStore } from 'react';
import { authReady, currentUser, mainDb } from './auth';

export interface OnlineConfig {
  /** 직접 붙여 넣은 Firebase (예전 방식). 계정 방식이면 없다 */
  firebase?: FirebaseOptions & { emulator?: string };
  code: string;
  /** 이메일 계정으로 들어간 월드 */
  account?: boolean;
}

const CFG_KEY = 'zsb-online-v1';

type Status = 'off' | 'connecting' | 'online' | 'error';
let status: Status = 'off';
let statusMsg = '';
let presence: string[] = [];
const ls = new Set<() => void>();
let ver = 0;
const notify = () => {
  ver++;
  ls.forEach((l) => l());
};
export function useOnline() {
  useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => ver,
  );
  return { status, statusMsg, presence, code: loadConfig()?.code ?? null };
}

export function loadConfig(): OnlineConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? (JSON.parse(raw) as OnlineConfig) : null;
  } catch {
    return null;
  }
}
function saveConfig(c: OnlineConfig | null) {
  if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
  else localStorage.removeItem(CFG_KEY);
}

// ───────────── 섹션 나누기 ─────────────
const SIMPLE_KEYS = ['version', 'worldName', 'createdAt', 'time', 'players', 'characterOrder', 'locations', 'rpLog', 'news', 'settings', 'clock', 'raid', 'weather', 'event', 'factions', 'merchant'] as const;
const MERGE_KEYS = new Set(['rpLog', 'news']);

/**
 * 캐릭터 수치는 실시간으로 아주 조금씩 줄어든다. 소수점 그대로 올리면 1분마다 서버에 쓰게 되므로
 * 올릴 때는 반올림해서, 눈에 띄게 바뀔 때만 올라가게 한다.
 */
const ROUND_KEYS = new Set(['hunger', 'thirst', 'energy', 'health', 'infection']);
const roundVitals = (k: string, v: unknown) =>
  typeof v !== 'number' ? v : ROUND_KEYS.has(k) ? Math.round(v) : k === 'healHours' ? Math.round(v * 2) / 2 : v;

function splitState(s: GameState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SIMPLE_KEYS) out[k] = JSON.stringify(s[k]);
  for (const [id, c] of Object.entries(s.characters)) out[`c_${id}`] = JSON.stringify(c, roundVitals);
  for (const [id, e] of Object.entries(s.expeditions)) out[`e_${id}`] = JSON.stringify(e);
  // 거점은 하나씩 따로 (창고 포함)
  for (const [id, b] of Object.entries(s.bases)) out[`b_${id}`] = JSON.stringify(b);
  for (const [id, r] of Object.entries(s.requests ?? {})) out[`q_${id}`] = JSON.stringify(r);
  for (const [id, v] of Object.entries(s.votes ?? {})) out[`v_${id}`] = JSON.stringify(v);
  return out;
}

function joinState(parts: Record<string, string>): GameState {
  const s = { characters: {}, expeditions: {}, bases: {}, requests: {}, votes: {} } as unknown as GameState;
  const rec = s as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(parts)) {
    const val = JSON.parse(v);
    if (k.startsWith('c_')) s.characters[k.slice(2)] = val;
    else if (k.startsWith('e_')) s.expeditions[k.slice(2)] = val;
    else if (k.startsWith('b_')) s.bases[k.slice(2)] = val;
    else if (k.startsWith('q_')) s.requests[k.slice(2)] = val;
    else if (k.startsWith('v_')) s.votes[k.slice(2)] = val;
    else rec[k] = val; // 예전 월드의 'base'·'storage' 는 syncWorld 가 첫 거점으로 옮긴다
  }
  s.lastRealTime = Date.now();
  return s;
}

function applyPart(s: GameState, k: string, v: string | null) {
  const rec = s as unknown as Record<string, unknown>;
  if (k.startsWith('c_')) {
    if (v === null) delete s.characters[k.slice(2)];
    else s.characters[k.slice(2)] = JSON.parse(v);
  } else if (k.startsWith('e_')) {
    if (v === null) delete s.expeditions[k.slice(2)];
    else s.expeditions[k.slice(2)] = JSON.parse(v);
  } else if (k.startsWith('b_')) {
    // 거점이 하나도 없게 되지는 않게 (화면이 깨진다)
    if (v === null) {
      if (Object.keys(s.bases).length > 1) delete s.bases[k.slice(2)];
    } else s.bases[k.slice(2)] = JSON.parse(v);
  } else if (k.startsWith('v_')) {
    s.votes ??= {};
    if (v === null) delete s.votes[k.slice(2)];
    else s.votes[k.slice(2)] = JSON.parse(v);
  } else if (k.startsWith('q_')) {
    s.requests ??= {};
    if (v === null) delete s.requests[k.slice(2)];
    else s.requests[k.slice(2)] = JSON.parse(v);
  } else if (k === 'base' || k === 'storage') {
    // 예전 형식 (이미 거점별로 옮김)
  } else if (v !== null) rec[k] = JSON.parse(v);
}

function itemKey(m: unknown): string {
  const o = m as { id?: string; t?: number; text?: string };
  return o.id ?? `${o.t}|${o.text}`;
}

function mergeLists(key: string, local: unknown[], remote: unknown[]): unknown[] {
  if (key === 'rpLog') {
    const map = new Map<string, RpMessage>();
    for (const m of [...(remote as RpMessage[]), ...(local as RpMessage[])]) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.real - b.real || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(-2000);
  }
  // news: 최신순. id 가 없으니 시간+내용으로 구분
  const map = new Map<string, NewsItem>();
  for (const n of [...(remote as NewsItem[]), ...(local as NewsItem[])]) map.set(`${n.t}|${n.text}`, n);
  // 양쪽에서 같은 순서가 나오도록 시간 → 내용 순으로 정렬
  return [...map.values()].sort((a, b) => b.t - a.t || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)).slice(0, 80);
}

// ───────────── 연결 ─────────────
let app: FirebaseApp | null = null;
let ownApp = false;
let db: Database | null = null;
let unsubs: Unsubscribe[] = [];
let storeUnsub: (() => void) | null = null;
const lastSent: Record<string, string> = {};
let pushTimer: number | undefined;
let applying = false;

const base = (code: string) => `worlds/${code}`;

function setStatus(s: Status, msg = '') {
  status = s;
  statusMsg = msg;
  notify();
}

async function openDb(cfg: OnlineConfig) {
  await disconnect(false);
  if (cfg.account) {
    if (!currentUser()) throw new Error('먼저 로그인해 주세요.');
    db = mainDb();
    ownApp = false;
    return db;
  }
  if (!cfg.firebase) throw new Error('Firebase 설정이 없습니다.');
  app = initializeApp(cfg.firebase, `zsb-${Date.now()}`);
  ownApp = true;
  db = getDatabase(app);
  if (cfg.firebase.emulator) {
    const [host, port] = cfg.firebase.emulator.split(':');
    connectDatabaseEmulator(db, host, Number(port));
  }
  return db;
}

/** 지금 월드를 온라인에 올리고 공유를 시작한다 */
export async function hostWorld(cfg: OnlineConfig) {
  setStatus('connecting');
  try {
    const d = await openDb(cfg);
    if (cfg.account) await claimMembership(d, cfg.code);
    const parts = splitState(store.s);
    await set(ref(d, `${base(cfg.code)}/parts`), parts);
    if (cfg.account) await remember(d, cfg.code, store.s.worldName);
    Object.assign(lastSent, parts);
    saveConfig(cfg);
    startSync(cfg);
  } catch (e) {
    setStatus('error', String((e as Error).message));
    throw e;
  }
}

/** 코드로 친구의 월드에 참가 (내 브라우저의 월드는 친구 월드로 바뀐다) */
export async function joinWorld(cfg: OnlineConfig) {
  setStatus('connecting');
  try {
    const d = await openDb(cfg);
    if (cfg.account) await claimMembership(d, cfg.code);
    const snap = await get(ref(d, `${base(cfg.code)}/parts`));
    if (!snap.exists()) {
      if (cfg.account) await remove(ref(d, `${base(cfg.code)}/members/${currentUser()!.uid}`)).catch(() => undefined);
      throw new Error('그 코드의 월드가 없습니다. 코드를 확인해 주세요.');
    }
    const parts = snap.val() as Record<string, string>;
    const s = joinState(parts);
    syncWorld(s);
    if (cfg.account) {
      const n = currentUser()?.displayName;
      if (n && !s.players.includes(n)) s.players.push(n);
    }
    Object.assign(lastSent, parts);
    applying = true;
    store.set(s);
    applying = false;
    saveConfig(cfg);
    if (cfg.account) await remember(d, cfg.code, s.worldName);
    // 처음 들어온 사람은 바로 캐릭터 등록부터
    const me = sessionStore.get().player;
    if (cfg.account && !Object.values(s.characters).some((c) => c.owner === me)) sessionStore.update({ tab: 'characters', viewCharId: '__new__', activeCharacterId: null });
    startSync(cfg);
  } catch (e) {
    setStatus('error', String((e as Error).message));
    throw e;
  }
}

// ───────────── 계정 ─────────────

/** 이 월드의 멤버가 된다 (같은 이름을 다른 계정이 쓰고 있으면 거절) */
async function claimMembership(d: Database, code: string) {
  const u = currentUser();
  if (!u) throw new Error('먼저 로그인해 주세요.');
  const name = u.displayName || '익명';
  await set(ref(d, `${base(code)}/members/${u.uid}`), name);
  const members = ((await get(ref(d, `${base(code)}/members`))).val() ?? {}) as Record<string, string>;
  const clash = Object.entries(members).find(([uid, n]) => uid !== u.uid && n === name);
  if (clash) {
    await remove(ref(d, `${base(code)}/members/${u.uid}`)).catch(() => undefined);
    throw new Error(`이 월드에 이미 '${name}' 이름의 다른 계정이 있습니다. 닉네임을 바꿔 주세요.`);
  }
  sessionStore.update({ player: name });
}

async function remember(d: Database, code: string, worldName: string) {
  const u = currentUser();
  if (!u) return;
  await set(ref(d, `users/${u.uid}/worlds/${code}`), { name: worldName, at: Date.now() });
}

export interface MyWorld {
  code: string;
  name: string;
  at: number;
}
/** 내 계정에 묶인 월드들 */
export async function myWorlds(): Promise<MyWorld[]> {
  const u = currentUser();
  if (!u) return [];
  const v = ((await get(ref(mainDb(), `users/${u.uid}/worlds`))).val() ?? {}) as Record<string, { name: string; at: number }>;
  return Object.entries(v)
    .map(([code, w]) => ({ code, name: w.name, at: w.at }))
    .sort((a, b) => b.at - a.at);
}

/** 목록에서 빼고 멤버에서도 나간다 */
export async function leaveWorld(code: string) {
  const u = currentUser();
  if (!u) return;
  const d = mainDb();
  await remove(ref(d, `users/${u.uid}/worlds/${code}`));
  await remove(ref(d, `${base(code)}/members/${u.uid}`)).catch(() => undefined);
  if (loadConfig()?.code === code) await disconnect(true);
}

/** 초대 링크 */
export const inviteLink = (code: string) => `${location.origin}${location.pathname}#join=${code}`;

/** 이전에 연결했던 월드에 다시 연결 (앱 시작 시) */
export async function resumeOnline() {
  const cfg = loadConfig();
  if (!cfg || status !== 'off') return;
  if (cfg.account) {
    const u = await authReady();
    if (!u) return;
  }
  try {
    await joinWorld(cfg);
  } catch {
    /* 상태에 오류 표시 */
  }
}

function startSync(cfg: OnlineConfig) {
  if (!db) return;
  // 이 브라우저의 월드는 계정 월드의 사본이다 (혼자 하던 월드로 착각해 올리지 않게)
  if (cfg.account) localStorage.setItem('zsb-from-account', '1');
  const d = db;
  const partsRef = ref(d, `${base(cfg.code)}/parts`);
  const onRemote = (k: string | null, v: string | null) => {
    if (!k || !store.has) return;
    if (v !== null && lastSent[k] === v) return; // 내가 보낸 것
    const s = store.s;
    if (v !== null && MERGE_KEYS.has(k)) {
      const local = (s as unknown as Record<string, unknown[]>)[k] ?? [];
      const remote = JSON.parse(v) as unknown[];
      const merged = mergeLists(k, local, remote);
      // 친구 쪽에서 생긴 '모두에게 알릴 소식' (습격 등)
      if (k === 'news') {
        const mine = new Set(local.map(itemKey));
        for (const n of remote as NewsItem[]) if (n.alert && !mine.has(itemKey(n))) bus.emit('alert', { title: n.alert, text: n.text, kind: n.kind ?? 'info' });
      }
      (s as unknown as Record<string, unknown>)[k] = merged;
      const str = JSON.stringify(merged);
      lastSent[k] = str;
      // 내 쪽에만 있던 항목이 있을 때만 다시 올린다 (서로 고쳐 쓰는 핑퐁 방지)
      const remoteKeys = new Set(remote.map(itemKey));
      if (merged.some((m) => !remoteKeys.has(itemKey(m)))) void update(partsRef, { [k]: str });
    } else {
      applyPart(s, k, v);
      if (v === null) delete lastSent[k];
      else lastSent[k] = v;
    }
    applying = true;
    store.commit();
    applying = false;
  };
  unsubs.push(
    onChildAdded(partsRef, (snap) => onRemote(snap.key, snap.val())),
    onChildChanged(partsRef, (snap) => onRemote(snap.key, snap.val())),
    onChildRemoved(partsRef, (snap) => onRemote(snap.key, null)),
  );
  // 접속 표시
  const me = sessionStore.get().player || '익명';
  const presRef = ref(d, `${base(cfg.code)}/presence/${encodeURIComponent(me).replace(/\./g, '%2E')}`);
  void set(presRef, Date.now());
  void onDisconnect(presRef).remove();
  unsubs.push(
    onValue(ref(d, `${base(cfg.code)}/presence`), (snap) => {
      presence = Object.keys(snap.val() ?? {}).map(decodeURIComponent).sort();
      notify();
    }),
    onValue(ref(d, '.info/connected'), (snap) => setStatus(snap.val() ? 'online' : 'connecting', snap.val() ? '' : '서버와 연결 중…')),
  );
  // 로컬 변경 → 서버
  storeUnsub = store.subscribe(() => {
    if (applying) return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => pushChanges(cfg), 500);
  });
  setStatus('online');
}

function pushChanges(cfg: OnlineConfig) {
  if (!db || !store.has) return;
  const parts = splitState(store.s);
  const patch: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parts)) if (lastSent[k] !== v) patch[k] = v;
  // 지워진 캐릭터·끝난 탐험
  for (const k of Object.keys(lastSent)) if ((k.startsWith('c_') || k.startsWith('e_') || k.startsWith('b_') || k.startsWith('q_') || k.startsWith('v_')) && !(k in parts)) patch[k] = null;
  // 예전 형식의 거점·창고는 서버에서 지운다
  for (const k of ['base', 'storage']) if (k in lastSent) patch[k] = null;
  if (!Object.keys(patch).length) return;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete lastSent[k];
    else lastSent[k] = v;
  }
  void update(ref(db, `${base(cfg.code)}/parts`), patch);
}

export async function disconnect(forget = true) {
  unsubs.forEach((u) => u());
  unsubs = [];
  storeUnsub?.();
  storeUnsub = null;
  window.clearTimeout(pushTimer);
  const cfg = loadConfig();
  if (db && cfg) {
    const me = sessionStore.get().player || '익명';
    try {
      // 서버에 닿지 않으면 기다리지 않는다 (끊긴 연결을 정리하다 멈추지 않게)
      await Promise.race([remove(ref(db, `${base(cfg.code)}/presence/${encodeURIComponent(me).replace(/\./g, '%2E')}`)), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* noop */
    }
  }
  if (app && ownApp) await deleteApp(app).catch(() => undefined);
  app = null;
  db = null;
  for (const k of Object.keys(lastSent)) delete lastSent[k];
  presence = [];
  if (forget) saveConfig(null);
  setStatus('off');
}

/**
 * 이 브라우저가 그 일을 처리할 차례인지.
 * owner 가 있으면(캐릭터의 탐험) 주인이 접속 중일 때 주인이, 아니면 시계 담당이 한다.
 */
export function runsFor(owner: string | null): boolean {
  if (status !== 'online' || presence.length < 2) return true;
  const me = sessionStore.get().player;
  if (owner && presence.includes(owner)) return owner === me;
  return isTicker();
}

/** 지금 접속 중인 플레이어 (혼자면 나만) */
export function onlinePlayers(): string[] {
  if (status !== 'online' || !presence.length) return [sessionStore.get().player];
  return presence;
}

/** 실시간 생산 같은 '시계' 작업은 접속자 중 한 명만 한다 */
export function isTicker(): boolean {
  if (status !== 'online' || presence.length < 2) return true;
  const me = sessionStore.get().player;
  return presence[0] === me;
}

export function randomCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
