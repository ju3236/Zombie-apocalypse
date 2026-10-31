import { addNews, sessionStore, store, useSession, type Tab } from '../game/store';
import { moodText } from '../game/systems/character';
import { advanceTime } from '../game/systems/time';
import { dayOf, formatTime, hourOf, isNight } from '../game/util';
import { allCharacters, Avatar, STATUS_LABEL } from './common';

export const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'main', label: '메인', icon: '⌂', desc: '거점 · 지도 · 탐험' },
  { id: 'characters', label: '생존자', icon: '☺', desc: '명단 · 프로필 · 관계' },
  { id: 'storage', label: '창고', icon: '▤', desc: '물품 · 제작' },
];

export function LeftColumn() {
  const s = store.s;
  const session = useSession();
  const chars = allCharacters();
  const expCount = Object.keys(s.expeditions).length;
  const night = isNight(s.time);

  const pass = (min: number, label: string) => {
    advanceTime(min);
    addNews(`${session.player}: ${label}`, 'info');
    store.commit();
  };
  const untilMorning = () => {
    const h = hourOf(s.time);
    let mins = ((7 - h + 24) % 24) * 60 - (s.time % 60);
    if (mins <= 0) mins += 24 * 60;
    pass(mins, '모두 잠자리에 들었다. 아침까지 휴식.');
  };

  return (
    <aside className="col-left">
      <div className="brand">
        <div className="brand-title">끝나지 않는 피난처</div>
        <div className="brand-world">{s.worldName}</div>
      </div>

      <div className={`clock-box ${night ? 'night' : ''}`}>
        <div className="clock-day">DAY {dayOf(s.time)}</div>
        <div className="clock-time">
          {night ? '☾' : '☼'} {formatTime(s.time).split(' ')[1]}
        </div>
        <div className="clock-btns">
          <button onClick={() => pass(60, '1시간 동안 거점에서 시간을 보냈다.')}>+1시간</button>
          <button onClick={untilMorning}>아침까지 자기</button>
        </div>
      </div>

      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={session.tab === t.id ? 'active' : ''}
            onClick={() => sessionStore.update(t.id === 'characters' ? { tab: t.id, viewCharId: null } : { tab: t.id })}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-text">
              <span className="nav-label">{t.label}</span>
              <span className="nav-desc">{t.desc}</span>
            </span>
            {t.id === 'main' && expCount > 0 && <span className="badge">{expCount}</span>}
          </button>
        ))}
      </nav>

      <div className="roster">
        <div className="col-title">
          생존자 <span className="muted">{chars.filter((c) => c.status !== 'dead').length}</span>
        </div>
        <div className="roster-list">
          {chars.map((c) => (
            <button
              key={c.id}
              className={`roster-item st-${c.status} ${session.activeCharacterId === c.id ? 'controlled' : ''} ${session.tab === 'characters' && session.viewCharId === c.id ? 'viewing' : ''}`}
              onClick={() => sessionStore.update({ tab: 'characters', viewCharId: c.id })}
              title={`${c.name} — ${STATUS_LABEL[c.status]} · ${moodText(c)}`}
            >
              <Avatar a={c.appearance} size={28} />
              <div className="roster-info">
                <div className="roster-name">
                  {c.name}
                  {session.activeCharacterId === c.id && <span className="ctl">▶</span>}
                </div>
                <div className="roster-hp">
                  <i style={{ width: `${c.health}%` }} />
                </div>
                <div className="roster-status">
                  {STATUS_LABEL[c.status]} · {moodText(c)}
                </div>
              </div>
            </button>
          ))}
          <button className="roster-add" onClick={() => sessionStore.update({ tab: 'characters', viewCharId: '__new__' })}>
            + 생존자 등록
          </button>
        </div>
      </div>

      <div className="player-foot">
        <span>
          오너 <b>{session.player}</b>
        </span>
        <span className="row">
          <span className="save-dot" title="자동 저장 중">● 저장됨</span>
          <button className={`gear ${session.tab === 'settings' ? 'active' : ''}`} title="설정" onClick={() => sessionStore.update({ tab: 'settings' })}>
            ⚙
          </button>
        </span>
      </div>
    </aside>
  );
}
