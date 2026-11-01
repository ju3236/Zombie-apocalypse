import { useState } from 'react';
import { toast } from '../game/bus';
import { disconnect, hostWorld, inviteLink, joinWorld, loadConfig, randomCode, resumeOnline, useOnline, type OnlineConfig } from '../game/online';
import { logOut, useAuth } from '../game/auth';
import { HUB_SKIP, LOCAL_ONLY } from './Account';
import { Panel } from './common';

/** Firebase 콘솔에서 복사한 firebaseConfig 객체(자바스크립트 형식도 허용)를 읽는다 */
function parseFirebaseConfig(text: string): OnlineConfig['firebase'] {
  // 콘솔 코드 블록을 통째로 붙여도 되도록 firebaseConfig = { … } 부분만 골라낸다 (괄호 짝 맞추기)
  const at = text.search(/firebaseConfig\s*=\s*\{/);
  const start = at >= 0 ? text.indexOf('{', at) : text.indexOf('{');
  if (start < 0) throw new Error('firebaseConfig { ... } 부분을 붙여넣어 주세요.');
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('firebaseConfig 의 { } 괄호가 덜 복사됐습니다. 끝의 }; 까지 복사해 주세요.');
  const json = text.slice(start, end + 1)
    // 주석만 지운다 (http:// 같은 주소 안의 // 는 그대로)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*\/\/.*$/gm, ',')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}');
  const cfg = JSON.parse(json);
  if (!cfg.databaseURL && !cfg.emulator) throw new Error('databaseURL 이 없습니다. Realtime Database 를 먼저 만들어 주세요.');
  return cfg;
}

const toInvite = (c: OnlineConfig) => 'zsb1.' + btoa(unescape(encodeURIComponent(JSON.stringify(c))));
function fromInvite(s: string): OnlineConfig {
  const t = s.trim();
  if (!t.startsWith('zsb1.')) throw new Error('초대 코드가 아닙니다.');
  return JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
}

/** 계정 방식 보안 규칙: 로그인한 멤버만 그 월드를 읽고 쓴다 */
export const RULES = `{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "worlds": {
      "$code": {
        ".read": "auth != null && data.child('members').child(auth.uid).exists()",
        "members": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && $code.length >= 10",
            ".validate": "newData.isString() && newData.val().length <= 40"
          }
        },
        "parts": {
          ".write": "auth != null && root.child('worlds').child($code).child('members').child(auth.uid).exists()",
          "$part": { ".validate": "newData.isString() && newData.val().length < 1000000" }
        },
        "presence": {
          "$player": {
            ".write": "auth != null && root.child('worlds').child($code).child('members').child(auth.uid).exists()",
            ".validate": "newData.isNumber()"
          }
        },
        "$other": { ".validate": false }
      }
    }
  }
}`;

/** 예전 방식(로그인 없이 내 Firebase 직접 연결)용 규칙 */
const LEGACY_RULES = `{
  "rules": {
    ".read": false,
    ".write": false,
    "worlds": {
      "$code": {
        ".read": "$code.length >= 10",
        ".write": "$code.length >= 10",
        "parts": { "$part": { ".validate": "newData.isString() && newData.val().length < 1000000" } },
        "presence": { "$player": { ".validate": "newData.isNumber()" } },
        "$other": { ".validate": false }
      }
    }
  }
}`;

/** 계정으로 들어간 월드 */
function AccountPanel() {
  const on = useOnline();
  const { user, name } = useAuth();
  const cfg = loadConfig()!;
  const link = inviteLink(cfg.code);
  return (
    <Panel title="🤝 같이 살기 (계정)">
      <div className="row">
        <span className={`online-dot ${on.status}`}>●</span>
        <b>{on.status === 'online' ? '연결됨' : on.status === 'connecting' ? '연결 중…' : on.status === 'off' ? '연결 안 됨' : '오류'}</b>
        <span className="muted small">{on.statusMsg}</span>
      </div>
      <div className="small">
        👤 {name} · {user?.email}
      </div>
      <div className="small">접속 중: {on.presence.length ? on.presence.join(', ') : '—'}</div>
      <label className="field">
        친구 초대 링크
        <div className="row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button onClick={() => void navigator.clipboard.writeText(link).then(() => toast('초대 링크를 복사했다.', 'good'))}>복사</button>
        </div>
        <span className="muted small">친구가 링크를 열고 로그인(없으면 회원가입)하면 바로 이 월드에 들어온다. 링크를 아는 사람은 누구나 들어올 수 있으니 친구에게만 보내자.</span>
      </label>
      {on.status === 'off' || on.status === 'error' ? (
        <button className="primary" onClick={() => void resumeOnline()}>
          다시 연결
        </button>
      ) : null}
      <div className="row wrap">
        <button onClick={() => void disconnect(true)}>🏚️ 내 월드 목록으로</button>
        <button className="ghost" onClick={() => void disconnect(false).then(logOut)}>
          로그아웃
        </button>
      </div>
      <details className="rules-box">
        <summary>🔒 서버 보안 규칙 (Firebase 콘솔 → Realtime Database → 규칙)</summary>
        <pre className="rules-pre">{RULES}</pre>
        <button className="small" onClick={() => void navigator.clipboard.writeText(RULES).then(() => toast('보안 규칙을 복사했다.', 'good'))}>
          규칙 복사
        </button>
      </details>
    </Panel>
  );
}

export function OnlinePanel() {
  const cfg = loadConfig();
  const { user } = useAuth();
  if (cfg?.account) return <AccountPanel />;
  return (
    <>
      <Panel title="👤 계정">
        {user ? (
          <>
            <div className="small">로그인됨 · {user.email} — 지금은 이 브라우저에서 혼자 하는 중이다.</div>
            <button
              className="primary"
              onClick={() => {
                sessionStorage.removeItem(HUB_SKIP);
                location.reload();
              }}
            >
              내 월드 목록 (계정으로 올리기 · 친구와 같이 하기)
            </button>
          </>
        ) : (
          <>
            <div className="small muted">이메일로 로그인하면 이 월드를 계정에 올려 어느 기기에서든 이어서 하고, 초대 링크로 친구와 같이 할 수 있다.</div>
            <button
              className="primary"
              onClick={() => {
                localStorage.removeItem(LOCAL_ONLY);
                location.reload();
              }}
            >
              로그인 / 회원가입
            </button>
          </>
        )}
      </Panel>
      <details className="legacy-online">
        <summary className="muted small">고급: 로그인 없이 내 Firebase 프로젝트에 직접 연결 (예전 방식)</summary>
        <LegacyPanel />
      </details>
    </>
  );
}

function LegacyPanel() {
  const on = useOnline();
  const cfg = loadConfig();
  const [fb, setFb] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await f();
      toast(ok, 'good');
    } catch (e) {
      toast(String((e as Error).message), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (cfg && on.status !== 'off') {
    const inv = toInvite(cfg);
    return (
      <Panel title="🤝 같이 살기 (온라인 공유)">
        <div className="row">
          <span className={`online-dot ${on.status}`}>●</span>
          <b>{on.status === 'online' ? '연결됨' : on.status === 'connecting' ? '연결 중…' : '오류'}</b>
          <span className="muted small">{on.statusMsg}</span>
        </div>
        <div className="small">접속 중: {on.presence.length ? on.presence.join(', ') : '—'}</div>
        <label className="field">
          친구에게 보낼 초대 코드
          <div className="row">
            <input readOnly value={inv} onFocus={(e) => e.target.select()} />
            <button onClick={() => void navigator.clipboard.writeText(inv).then(() => toast('초대 코드를 복사했다.', 'good'))}>복사</button>
          </div>
          <span className="muted small">친구는 설정 → 같이 살기 → "초대 코드로 참가"에 붙여넣으면 이 거점에서 함께 살 수 있습니다.</span>
        </label>
        <details className="rules-box">
          <summary>🔒 서버 보안 규칙 (꼭 한 번 넣어 두기)</summary>
          <div className="muted small">
            Firebase 콘솔 → Realtime Database → 규칙 탭에 붙여넣고 &apos;게시&apos;. 월드 코드를 아는 사람만 이 월드를 읽고 쓸 수 있게 되고, 전체 목록은 아무도 못 본다.
          </div>
          <pre className="rules-pre">{LEGACY_RULES}</pre>
          <button className="small" onClick={() => void navigator.clipboard.writeText(LEGACY_RULES).then(() => toast('보안 규칙을 복사했다.', 'good'))}>
            규칙 복사
          </button>
        </details>
        <button className="danger" disabled={busy} onClick={() => void run(() => disconnect(true), '공유를 끊었다. 이 브라우저에는 마지막 상태가 남는다.')}>
          연결 끊기
        </button>
      </Panel>
    );
  }

  return (
    <Panel title="🤝 같이 살기 (온라인 공유)">
      <p className="muted small">
        친구와 같은 거점·같은 월드에서 함께 지냅니다. 한 사람이 월드를 올리고 초대 코드를 보내면, 친구는 그 코드로 들어옵니다. 둘 다 접속해 있으면 서로의 변화가 실시간으로
        보이고, 한 사람만 접속해도 진행됩니다.
      </p>
      {on.status === 'error' && <div className="warn small">연결 실패: {on.statusMsg}</div>}

      <div className="online-grid">
        <div>
          <h4>초대 코드로 참가</h4>
          <textarea rows={3} value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="친구가 보낸 zsb1.… 코드를 붙여넣기" />
          <button
            className="primary"
            disabled={busy || !invite.trim()}
            onClick={() => {
              if (!confirm('지금 이 브라우저의 월드 대신 친구의 월드로 들어갑니다. 계속할까요? (필요하면 먼저 세이브를 내보내 두세요)')) return;
              void run(async () => joinWorld(fromInvite(invite)), '친구의 월드에 들어왔다!');
            }}
          >
            참가하기
          </button>
        </div>
        <div>
          <h4>내 월드를 공유 시작</h4>
          <textarea rows={6} value={fb} onChange={(e) => setFb(e.target.value)} placeholder={'Firebase 콘솔의 firebaseConfig 를 붙여넣기\nconst firebaseConfig = {\n  apiKey: "...",\n  databaseURL: "https://....firebasedatabase.app",\n  ...\n};'} />
          <button
            className="primary"
            disabled={busy || !fb.trim()}
            onClick={() => void run(async () => hostWorld({ firebase: parseFirebaseConfig(fb), code: randomCode() }), '월드를 올렸다! 초대 코드를 친구에게 보내세요.')}
          >
            올리고 초대 코드 만들기
          </button>
        </div>
      </div>
      <details className="small">
        <summary>Firebase 준비하기 (처음 한 번, 올리는 사람만)</summary>
        <ol>
          <li>console.firebase.google.com 에서 새 프로젝트를 만듭니다 (무료 Spark 요금제).</li>
          <li>빌드 → Realtime Database → 데이터베이스 만들기. 위치는 아무 곳이나 괜찮습니다.</li>
          <li>
            규칙 탭에 아래 보안 규칙을 붙여넣고 게시합니다. 월드 코드를 아는 사람만 그 월드를 읽고 쓸 수 있고, 전체 목록은 아무도 못 봅니다.
            <pre className="rules-pre">{LEGACY_RULES}</pre>
            <button className="small" onClick={() => void navigator.clipboard.writeText(LEGACY_RULES).then(() => toast('보안 규칙을 복사했다.', 'good'))}>
              규칙 복사
            </button>
          </li>
          <li>프로젝트 설정 → 내 앱 → 웹 앱(&lt;/&gt;) 추가 → 나오는 firebaseConfig 를 위 칸에 붙여넣습니다.</li>
        </ol>
      </details>
    </Panel>
  );
}
