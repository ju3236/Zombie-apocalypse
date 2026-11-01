/**
 * 이메일 계정. 로그인하면 내 월드 목록이 계정에 묶이고, 어느 기기에서든 이어서 할 수 있다.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword,
  signOut, updateProfile, type Auth, type User,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { useSyncExternalStore } from 'react';
import { MAIN_FIREBASE } from './firebaseConfig';

const APP_NAME = 'zsb-main';
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

/** 테스트용 에뮬레이터 (localStorage zsb-emulator = 127.0.0.1) */
const emulatorHost = () => {
  try {
    return localStorage.getItem('zsb-emulator');
  } catch {
    return null;
  }
};

export function mainApp(): FirebaseApp {
  if (app) return app;
  app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(MAIN_FIREBASE, APP_NAME);
  return app;
}
export function mainAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(mainApp());
  const emu = emulatorHost();
  if (emu) connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
  return auth;
}
export function mainDb(): Database {
  if (db) return db;
  db = getDatabase(mainApp());
  const emu = emulatorHost();
  if (emu) connectDatabaseEmulator(db, emu, 9000);
  return db;
}

// ───────────── 로그인 상태 ─────────────

let user: User | null = null;
let ready = false;
let ver = 0;
const ls = new Set<() => void>();
const notify = () => {
  ver++;
  ls.forEach((l) => l());
};
let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    onAuthStateChanged(mainAuth(), (u) => {
      user = u;
      ready = true;
      notify();
    });
  } catch {
    ready = true;
    notify();
  }
}

export function useAuth() {
  start();
  useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => ver,
  );
  return { user, ready, name: user?.displayName ?? '' };
}
export const currentUser = () => user;
/** 로그인 상태가 정해질 때까지 기다린다 */
export function authReady(): Promise<User | null> {
  start();
  if (ready) return Promise.resolve(user);
  return new Promise((res) => {
    const l = () => {
      if (ready) {
        ls.delete(l);
        res(user);
      }
    };
    ls.add(l);
  });
}

const MSG: Record<string, string> = {
  'auth/invalid-email': '이메일 주소 형식이 올바르지 않습니다.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth/invalid-credential': '이메일 또는 비밀번호가 틀렸습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 틀렸습니다.',
  'auth/user-not-found': '가입되지 않은 이메일입니다.',
  'auth/too-many-requests': '시도가 너무 많습니다. 잠시 뒤 다시 해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 아직 켜지지 않았습니다. (Authentication → 로그인 방법 → 이메일/비밀번호 사용 설정)',
  'auth/configuration-not-found': 'Firebase 콘솔에서 Authentication을 아직 시작하지 않았습니다. (Authentication → 시작하기 → 이메일/비밀번호)',
  'auth/missing-password': '비밀번호를 입력해 주세요.',
  'auth/missing-email': '이메일을 입력해 주세요.',
};
export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  return MSG[code] ?? `로그인 오류: ${code || (e as Error)?.message || e}`;
}

export async function signUp(email: string, password: string, nickname: string) {
  const name = nickname.trim();
  if (!name) throw new Error('닉네임(플레이어 이름)을 입력해 주세요.');
  if (name.length > 20) throw new Error('닉네임은 20자 이하로 해 주세요.');
  const cred = await createUserWithEmailAndPassword(mainAuth(), email.trim(), password);
  await updateProfile(cred.user, { displayName: name });
  user = mainAuth().currentUser;
  notify();
}
export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(mainAuth(), email.trim(), password);
}
export async function logOut() {
  await signOut(mainAuth());
}
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(mainAuth(), email.trim());
}
export async function rename(nickname: string) {
  const u = mainAuth().currentUser;
  if (!u) return;
  await updateProfile(u, { displayName: nickname.trim() });
  notify();
}
