import { useState } from 'react';
import { toast } from '../game/bus';
import { disconnect, hostWorld, joinWorld, loadConfig, randomCode, useOnline, type OnlineConfig } from '../game/online';
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

const RULES = `{
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

export function OnlinePanel() {
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
          <pre className="rules-pre">{RULES}</pre>
          <button className="small" onClick={() => void navigator.clipboard.writeText(RULES).then(() => toast('보안 규칙을 복사했다.', 'good'))}>
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
            <pre className="rules-pre">{RULES}</pre>
            <button className="small" onClick={() => void navigator.clipboard.writeText(RULES).then(() => toast('보안 규칙을 복사했다.', 'good'))}>
              규칙 복사
            </button>
          </li>
          <li>프로젝트 설정 → 내 앱 → 웹 앱(&lt;/&gt;) 추가 → 나오는 firebaseConfig 를 위 칸에 붙여넣습니다.</li>
        </ol>
      </details>
    </Panel>
  );
}
