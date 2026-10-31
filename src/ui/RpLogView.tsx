import { useState } from 'react';
import { store, useSession } from '../game/store';
import { postRp } from '../game/systems/rp';
import type { RpKind } from '../game/types';
import { formatTime } from '../game/util';
import { RpLine } from './panels';
import { allCharacters, myCharacters, Panel } from './common';

export function RpLogView() {
  const s = store.s;
  const session = useSession();
  const [filter, setFilter] = useState('');
  const [showSys, setShowSys] = useState(true);
  const [speaker, setSpeaker] = useState('');
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState<RpKind>('say');
  const [text, setText] = useState('');
  const mine = myCharacters().filter((c) => c.status !== 'dead');
  const sp = speaker || session.activeCharacterId || mine[0]?.id || '';

  const log = s.rpLog.filter((m) => (showSys || m.kind !== 'system') && (!filter || m.characterId === filter || m.targetId === filter));

  const send = () => {
    if (!text.trim()) return;
    postRp(kind, text, kind === 'ooc' ? undefined : sp, target || undefined);
    setText('');
  };

  const exportTxt = () => {
    const lines = s.rpLog.map((m) => {
      const c = m.characterId ? s.characters[m.characterId]?.name : '';
      const t = m.targetId ? s.characters[m.targetId]?.name : '';
      const time = formatTime(m.t);
      switch (m.kind) {
        case 'say':
          return `[${time}] ${c}: "${m.text}"`;
        case 'action':
          return `[${time}] *${c} ${m.text}*`;
        case 'ooc':
          return `[${time}] (${m.owner}) ${m.text}`;
        case 'letter':
          return `[${time}] ✉ ${c} → ${t}: ${m.text}`;
        default:
          return `[${time}] — ${m.text}`;
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.worldName}-역극로그.txt`;
    a.click();
  };

  return (
    <div className="rp-view">
      <Panel
        title={`💬 역극 로그 (${s.rpLog.length})`}
        actions={
          <>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">모든 캐릭터</option>
              {allCharacters().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="check small">
              <input type="checkbox" checked={showSys} onChange={(e) => setShowSys(e.target.checked)} /> 시스템
            </label>
            <button onClick={exportTxt}>TXT 저장</button>
          </>
        }
      >
        <div className="rp-full">
          {log.map((m) => (
            <RpLine key={m.id} m={m} />
          ))}
          {log.length === 0 && <div className="muted">기록이 없다.</div>}
        </div>
      </Panel>
      <Panel>
        <div className="row wrap">
          <select value={sp} onChange={(e) => setSpeaker(e.target.value)} disabled={kind === 'ooc'}>
            {mine.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value as RpKind)}>
            <option value="say">대사</option>
            <option value="action">행동 지문</option>
            <option value="ooc">오너 대화</option>
            <option value="letter">편지/메모</option>
          </select>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">대상 없음</option>
            {allCharacters()
              .filter((c) => c.id !== sp)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  → {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="row">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Enter 전송 · Shift+Enter 줄바꿈"
          />
          <button className="primary" onClick={send} disabled={(kind !== 'ooc' && !sp) || (kind === 'letter' && !target)}>
            전송
          </button>
        </div>
      </Panel>
    </div>
  );
}
