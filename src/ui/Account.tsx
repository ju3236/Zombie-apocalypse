import { useEffect, useState } from 'react';
import { toast } from '../game/bus';
import { authError, logOut, rename, resetPassword, signIn, signUp, useAuth } from '../game/auth';
import { MAIN_FIREBASE } from '../game/firebaseConfig';
import { createWorld, syncWorld } from '../game/newGame';
import { disconnect, hostWorld, joinWorld, leaveWorld, loadConfig, myWorlds, randomCode, resumeOnline, useOnline, type MyWorld } from '../game/online';
import { sessionStore, store } from '../game/store';

/** 초대 링크(#join=코드)로 들어왔는지 */
export function pendingJoin(): string | null {
  const m = location.hash.match(/join=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
const clearJoin = () => history.replaceState(null, '', location.pathname + location.search);

export const LOCAL_ONLY = 'zsb-local-only';
export const HUB_SKIP = 'zsb-hub-skip';
export const isLocalOnly = () => localStorage.getItem(LOCAL_ONLY) === '1';

/** 입력한 코드·링크·예전 초대 코드에서 월드 코드만 */
function parseCode(t: string): string | null {
  const v = t.trim();
  const link = v.match(/join=([A-Za-z0-9_-]{10,})/);
  if (link) return link[1];
  if (v.startsWith('zsb1.')) {
    try {
      return (JSON.parse(decodeURIComponent(escape(atob(v.slice(5))))) as { code: string }).code;
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9_-]{10,}$/.test(v) ? v : null;
}

/** 로그인 · 회원가입 */
export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const join = pendingJoin();

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      if (mode === 'up') await signUp(email, pw, nick);
      else await signIn(email, pw);
      localStorage.removeItem(LOCAL_ONLY);
      if (loadConfig()?.account) void resumeOnline();
    } catch (e) {
      setErr((e as Error).message && !(e as { code?: string }).code ? (e as Error).message : authError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setup">
      <div className="setup-card auth-card">
        <h1>끝나지 않는 피난처</h1>
        <p className="sub">{join ? '초대받은 월드에 들어가려면 로그인해 주세요.' : '계정으로 로그인하면 어느 기기에서든 같은 월드를 이어서 할 수 있다.'}</p>
        <div className="row auth-tabs">
          <button className={mode === 'in' ? 'active' : ''} onClick={() => setMode('in')}>
            로그인
          </button>
          <button className={mode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>
            회원가입
          </button>
        </div>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void go();
          }}
        >
          <label className="field">
            이메일
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            비밀번호 {mode === 'up' && <span className="muted small">(6자 이상)</span>}
            <input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {mode === 'up' && (
            <label className="field">
              닉네임 (게임 속 플레이어 이름)
              <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="예: 별빛" />
            </label>
          )}
          {err && <div className="warn small">{err}</div>}
          <button className="primary big" type="submit" disabled={busy || !email || !pw || (mode === 'up' && !nick.trim())}>
            {busy ? '잠시만…' : mode === 'up' ? '가입하고 시작하기' : '로그인'}
          </button>
        </form>
        {mode === 'in' && (
          <button
            className="ghost small"
            onClick={() => {
              if (!email) return setErr('비밀번호를 재설정할 이메일을 위 칸에 적어 주세요.');
              resetPassword(email)
                .then(() => toast('비밀번호 재설정 메일을 보냈다. 메일함(스팸함도)을 확인해 주세요.', 'good'))
                .catch((e) => setErr(authError(e)));
            }}
          >
            비밀번호를 잊었어요
          </button>
        )}
        {!join && (
          <>
            <div className="divider small">또는</div>
            <button
              className="ghost"
              onClick={() => {
                localStorage.setItem(LOCAL_ONLY, '1');
                location.reload();
              }}
            >
              로그인 없이 이 브라우저에서 혼자 하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** 로그인 뒤: 내 월드 목록 · 새 월드 · 초대 참가 */
export function WorldHub({ error }: { error?: string }) {
  const { user, name } = useAuth();
  const on = useOnline();
  const [list, setList] = useState<MyWorld[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [worldName, setWorldName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(error ?? '');
  const legacy = loadConfig();
  const legacySame = legacy && !legacy.account && legacy.firebase?.projectId === MAIN_FIREBASE.projectId ? legacy.code : null;
  const localWorld = store.has && !legacy?.account && localStorage.getItem('zsb-from-account') !== '1' ? store.s.worldName : null;

  const reload = () => {
    myWorlds()
      .then(setList)
      .catch((e) => {
        setList([]);
        setMsg(String((e as Error).message));
      });
  };
  useEffect(reload, [user?.uid]);

  const run = async (f: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      await f();
      sessionStorage.removeItem(HUB_SKIP);
      clearJoin();
      toast(ok, 'good');
    } catch (e) {
      const m = String((e as Error).message);
      setMsg(/permission/i.test(m) ? '서버가 거절했습니다. Firebase 콘솔 → Realtime Database → 규칙 탭에 새 보안 규칙(설정 → 같이 살기에서 복사)을 게시했는지 확인해 주세요.' : m);
    } finally {
      setBusy(false);
    }
  };
  const enter = (c: string) => run(() => joinWorld({ account: true, code: c }), '월드에 들어왔다!');

  // 초대 링크로 들어왔으면 바로 참가
  const join = pendingJoin();
  useEffect(() => {
    if (join && user && !busy) void enter(join);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join, user?.uid]);

  const create = () => {
    if (localWorld && !confirm(`이 브라우저에서 하던 월드 '${localWorld}'는 새 월드로 바뀝니다. 먼저 '내 계정으로 올리기'를 하거나 세이브를 내보내 두세요. 계속할까요?`)) return;
    void run(async () => {
      const w = createWorld(worldName.trim() || `${name}의 피난처`, name);
      syncWorld(w);
      store.set(w);
      sessionStore.update({ player: name, activeCharacterId: null, tab: 'characters', viewCharId: '__new__' });
      await hostWorld({ account: true, code: randomCode() });
    }, '새 월드를 만들었다! 초대 링크를 친구에게 보내자.');
  };

  return (
    <div className="setup">
      <div className="setup-card hub-card">
        <div className="row hub-head">
          <div>
            <h1>내 월드</h1>
            <div className="muted small">
              👤 <b>{name}</b> · {user?.email}
            </div>
          </div>
          <div className="row">
            <button
              className="small ghost"
              onClick={() => {
                const n = prompt('새 닉네임 (게임 속 플레이어 이름)', name);
                if (n && n.trim()) void rename(n).then(() => toast('닉네임을 바꿨다. 이미 들어간 월드에서는 새 이름으로 다시 들어가야 한다.', 'info'));
              }}
            >
              닉네임 변경
            </button>
            <button className="small" onClick={() => void disconnect(false).then(logOut)}>
              로그아웃
            </button>
          </div>
        </div>
        {(msg || (on.status === 'error' && on.statusMsg)) && <div className="warn small">{msg || on.statusMsg}</div>}
        {busy && <div className="muted">연결 중…</div>}

        {legacySame && (
          <div className="hub-box hub-legacy">
            <b>🔁 예전에 같이 하던 월드가 있다</b>
            <div className="muted small">로그인 전에 초대 코드로 같이 하던 월드다. 계정으로 옮기면 서버의 월드를 그대로 이어서 한다.</div>
            <button className="primary" disabled={busy} onClick={() => void enter(legacySame)}>
              이 월드를 내 계정으로 옮겨 이어서 하기
            </button>
          </div>
        )}

        <div className="hub-box">
          <div className="divider small">계정에 묶인 월드</div>
          {list === null && <div className="muted small">불러오는 중…</div>}
          {list?.length === 0 && <div className="muted small">아직 없다. 새로 만들거나 친구의 초대 링크로 들어가자.</div>}
          {list?.map((w) => (
            <div key={w.code} className="hub-world">
              <span>
                🏚️ <b>{w.name}</b> <span className="muted small">· 마지막 {new Date(w.at).toLocaleDateString()}</span>
              </span>
              <span className="row">
                <button className="primary small" disabled={busy} onClick={() => void enter(w.code)}>
                  들어가기
                </button>
                <button
                  className="ghost small"
                  disabled={busy}
                  title="목록에서 빼고 멤버에서 나간다 (월드는 지워지지 않는다)"
                  onClick={() => confirm(`'${w.name}'을(를) 목록에서 뺄까요? 월드 자체는 지워지지 않고, 초대 링크로 다시 들어올 수 있습니다.`) && void leaveWorld(w.code).then(reload)}
                >
                  빼기
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="hub-grid">
          <div className="hub-box">
            <div className="divider small">새 월드 만들기</div>
            <input value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder={`${name}의 피난처`} />
            <button className="primary" disabled={busy} onClick={create}>
              만들기
            </button>
          </div>
          <div className="hub-box">
            <div className="divider small">초대 링크·코드로 참가</div>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="친구가 보낸 링크나 코드" />
            <button
              className="primary"
              disabled={busy || !code.trim()}
              onClick={() => {
                const c = parseCode(code);
                if (!c) return setMsg('초대 링크나 코드가 아닌 것 같다. 다시 확인해 주세요.');
                void enter(c);
              }}
            >
              참가하기
            </button>
          </div>
        </div>

        {localWorld && !legacySame && (
          <div className="hub-box">
            <b>💾 이 브라우저에 혼자 하던 월드 '{localWorld}'가 있다</b>
            <div className="row">
              <button disabled={busy} onClick={() => void run(() => hostWorld({ account: true, code: randomCode() }), '내 계정으로 올렸다! 이제 어느 기기에서든 이어서 할 수 있다.')}>
                내 계정으로 올리기
              </button>
              <button
                className="ghost"
                onClick={() => {
                  sessionStorage.setItem(HUB_SKIP, '1');
                  location.reload();
                }}
              >
                올리지 않고 혼자 계속하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
