import { useState } from 'react';
import { toast } from '../game/bus';
import { disconnect, hostWorld, joinWorld, loadConfig, randomCode, useOnline, type OnlineConfig } from '../game/online';
import { Panel } from './common';

/** Firebase 콘솔에서 복사한 firebaseConfig 객체(자바스크립트 형식도 허용)를 읽는다 */
function parseFirebaseConfig(text: string): OnlineConfig['firebase'] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('firebaseConfig { ... } 부분을 붙여넣어 주세요.');
  const json = m[0]
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
            규칙 탭에 아래를 붙여넣고 게시합니다. 초대 코드를 아는 사람만 들어올 수 있도록 월드 코드가 길게 만들어집니다.
            <pre>{`{ "rules": { "worlds": { "$code": { ".read": true, ".write": true } } } }`}</pre>
          </li>
          <li>프로젝트 설정 → 내 앱 → 웹 앱(&lt;/&gt;) 추가 → 나오는 firebaseConfig 를 위 칸에 붙여넣습니다.</li>
        </ol>
      </details>
    </Panel>
  );
}
