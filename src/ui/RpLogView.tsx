import { useEffect, useRef, useState } from 'react';
import { store } from '../game/store';
import { formatTime } from '../game/util';
import { allCharacters, Panel } from './common';
import { ChatInput, RpLine } from './panels';

export function RpLogView() {
  const s = store.s;
  const [filter, setFilter] = useState('');
  const [showSys, setShowSys] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  const log = s.rpLog.filter((m) => (showSys || m.kind !== 'system') && (!filter || m.characterId === filter || m.targetId === filter));

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  const exportTxt = () => {
    const lines = s.rpLog.map((m) => {
      const c = m.characterId ? s.characters[m.characterId]?.name : '';
      const t = m.targetId ? s.characters[m.targetId]?.name : '';
      const time = formatTime(m.t);
      if (m.kind === 'system') return `[${time}] — ${m.text}`;
      if (m.kind === 'letter') return `[${time}] ✉ ${c} → ${t}: ${m.text}`;
      if (m.anim) return `[${time}] ${m.text}`;
      return `[${time}] ${c || m.owner}: ${m.text}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.worldName}-채팅로그.txt`;
    a.click();
  };

  return (
    <div className="rp-view">
      <Panel
        title={`💬 채팅 (${s.rpLog.length})`}
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
          <div ref={bottom} />
        </div>
      </Panel>
      <Panel>
        <ChatInput multiline />
      </Panel>
    </div>
  );
}
