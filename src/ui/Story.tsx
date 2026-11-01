import { useState } from 'react';
import { toast } from '../game/bus';
import { LOCATION_BY_ID } from '../game/data/locations';
import { store } from '../game/store';
import { MEMORY_ICON, noteDay, setGoal } from '../game/systems/story';
import type { Character } from '../game/types';
import { dayOf, formatTime } from '../game/util';
import { Panel, StoreText } from './common';

/** 캐릭터 이야기: 목표 · 오늘 · 일기 · 기억 */
export function StoryPanels({ c, isMine }: { c: Character; isMine: boolean }) {
  const [goalText, setGoalText] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const g = c.goal;
  const diary = [...(c.diary ?? [])].reverse();
  const memories = [...(c.memories ?? [])].reverse();
  const fears = Object.entries(c.fears ?? {});

  return (
    <div className="detail-grid">
      <Panel title="⭐ 목표">
        {g ? (
          <>
            <div className="goal-text">
              {g.done ? '✅' : '🎯'} <b>{g.text}</b>
            </div>
            <div className="goal-clues">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`clue ${i < g.clues ? 'on' : ''}`}>
                  🔎
                </span>
              ))}
              <span className="muted small">
                {g.done ? '이뤄냈다!' : g.target ? `단서가 [${LOCATION_BY_ID[g.target]?.name}]을(를) 가리킨다. 그곳을 수색하자.` : `단서 ${g.clues}/3 — 탐험에서 수색하다 보면 찾을 수 있다.`}
              </span>
            </div>
            {g.notes.length > 0 && (
              <ul className="small goal-notes">
                {g.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {isMine && (
              <button className="small ghost" onClick={() => confirm('목표를 내려놓을까요? 모은 단서는 사라집니다.') && (setGoal(c, ''), store.commit())}>
                {g.done ? '새 목표 세우기' : '목표 내려놓기'}
              </button>
            )}
          </>
        ) : isMine ? (
          <>
            <div className="muted small">캐릭터가 이 세상에서 이루고 싶은 것. 탐험하며 단서 3개를 모으면 목적지가 드러나고, 그곳에서 이야기가 끝난다.</div>
            <div className="row">
              <input value={goalText} placeholder="예: 헤어진 동생 찾기, 엄마의 반지 되찾기" onChange={(e) => setGoalText(e.target.value)} />
              <button
                className="primary"
                disabled={!goalText.trim()}
                onClick={() => {
                  setGoal(c, goalText);
                  noteDay(c, `마음먹었다. '${goalText.trim()}'.`);
                  setGoalText('');
                  store.commit();
                  toast('목표를 세웠다.', 'good');
                }}
              >
                정하기
              </button>
            </div>
          </>
        ) : (
          <div className="muted small">아직 목표가 없다.</div>
        )}
      </Panel>

      <Panel title="🖤 기억 · 트라우마">
        {fears.length > 0 && (
          <div className="fears">
            {fears.map(([loc, n]) => (
              <div key={loc} className="fear-row">
                🖤 <b>{LOCATION_BY_ID[loc]?.name ?? loc}</b>
                <span className="muted small"> — 그곳에 가면 몸이 굳는다 (명중·도주 −10%). 그곳에서 {n}번 더 해내면 극복.</span>
              </div>
            ))}
          </div>
        )}
        {memories.length === 0 && <div className="muted small">아직 마음에 남은 일이 없다. 무언가를 겪으면 여기에 쌓인다.</div>}
        <div className="memories">
          {memories.map((m, i) => (
            <div key={i} className={`memory m-${m.kind}`}>
              <span>{MEMORY_ICON[m.kind]}</span> {m.text}
              <span className="muted small"> · {dayOf(m.t)}일차</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="📔 일기">
        {(c.today?.length ?? 0) > 0 && (
          <div className="diary-today">
            <div className="muted small">오늘 ({formatTime(store.s.time)}) — 자정이 지나면 일기가 된다</div>
            {c.today!.map((t, i) => (
              <div key={i} className="small">
                · {t}
              </div>
            ))}
          </div>
        )}
        {diary.length === 0 && <div className="muted small">하루가 지나면 그날 있었던 일로 일기가 자동으로 쓰인다.</div>}
        <div className="diary">
          {diary.map((d) => (
            <div key={d.day} className="diary-entry">
              <div className="diary-day" onClick={() => setOpen(open === d.day ? null : d.day)}>
                📅 {d.day}일차
              </div>
              <p>{d.text}</p>
              {d.note && open !== d.day && <p className="diary-note">✍️ {d.note}</p>}
              {isMine && open === d.day && (
                <StoreText multiline rows={2} value={d.note ?? ''} placeholder="오너 메모 한 줄 덧붙이기…" onCommit={(v) => ((d.note = v), store.commit())} />
              )}
              {isMine && open !== d.day && (
                <button className="ghost small" onClick={() => setOpen(d.day)}>
                  ✍️ 덧붙이기
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
