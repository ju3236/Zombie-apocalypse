import { sessionStore, store, useSession, withBase, type Tab } from '../game/store';
import { controls } from '../game/homes';
import { moodText } from '../game/systems/character';
import { CLOCK_MODES } from '../game/systems/clock';
import { defenseScore, wakeEveryone } from '../game/systems/raid';
import { dayOf, formatTime, isNight } from '../game/util';
import { useEffect, useState } from 'react';
import { Avatar, myCharacters, STATUS_LABEL } from './common';
import { PocketPanel } from './RightColumn';
import { BodyPanel } from './BodyPanel';
import { EffectChips } from './Effects';
import { WeatherBadge } from './Weather';
import { SeasonBanner } from './World';
import { useOnline } from '../game/online';

export const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'main', label: '메인', icon: '⌂', desc: '거점 · 지도 · 탐험' },
  { id: 'characters', label: '생존자', icon: '☺', desc: '명단 · 프로필 · 관계' },
  { id: 'storage', label: '창고', icon: '▤', desc: '물품 · 제작' },
];

export function LeftColumn() {
  const s = store.s;
  const session = useSession();
  // 왼쪽 명단은 내가 조종할 수 있는 캐릭터만 (남의 캐릭터는 생존자 탭 · 근처 사람에서)
  const chars = myCharacters();
  const online = useOnline();
  const night = isNight(s.time);


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
        <WeatherBadge />
        <SeasonBanner />
        <RaidBanner />
        <div className="clock-mode">{CLOCK_MODES.find((m) => m.id === (s.settings.clockMode ?? 'real'))?.label} · 실시간</div>
      </div>


      <LeftBody />
      <PocketPanel />

      <div className="roster">
        <div className="col-title">
          내 생존자 <span className="muted">{chars.filter((c) => c.status !== 'dead').length}</span>
        </div>
        <div className="roster-list">
          {chars.map((c) => (
            <button
              key={c.id}
              className={`roster-item st-${c.status} ${session.activeCharacterId === c.id ? 'controlled' : ''} ${session.tab === 'characters' && session.viewCharId === c.id ? 'viewing' : ''}`}
              onClick={() => sessionStore.update({ tab: 'characters', viewCharId: c.id })}
              title={`${c.name} — ${STATUS_LABEL[c.status]} · ${moodText(c)}`}
            >
              <Avatar a={c.appearance} sprite={c.sprite} size={28} />
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
                  <EffectChips c={c} iconsOnly />
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
          {online.status !== 'off' ? (
            <span className={`save-dot online-${online.status}`} title={`같이 살기: ${online.presence.join(', ')}`}>
              ● {online.status === 'online' ? `온라인 ${online.presence.length}명` : '연결 중'}
            </span>
          ) : (
            <span className="save-dot" title="자동 저장 중">● 저장됨</span>
          )}
          <button className={`gear ${session.tab === 'settings' ? 'active' : ''}`} title="설정" onClick={() => sessionStore.update({ tab: 'settings' })}>
            ⚙
          </button>
        </span>
      </div>
    </aside>
  );
}

/** 왼쪽 칸: 조종 중인 캐릭터의 몸 상태 · 장비 */
function LeftBody() {
  const session = useSession();
  const s = store.s;
  const c = session.activeCharacterId ? s.characters[session.activeCharacterId] : null;
  const hurt = c?.injuries.length ?? 0;
  // 다치지 않으면 자동으로 접히고, 다치면 펼쳐진다 (직접 누르면 그 상태 유지)
  const [manual, setManual] = useState<boolean | null>(null);
  const injured = hurt > 0;
  useEffect(() => setManual(null), [injured, c?.id]);
  const open = manual ?? injured;
  const setOpen = (v: boolean) => setManual(v);
  if (!c) return null;
  return (
    <div className="left-body">
      <button className="col-title lb-head" onClick={() => setOpen(!open)}>
        <span>
          몸 상태 · {c.name}
          {hurt > 0 && <span className="lb-hurt"> 상처 {hurt}</span>}
        </span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && <BodyPanel c={c} editable={controls(c, session.player)} compact />}
    </div>
  );
}

/** 습격 경보: 남은 시간과 지금 방어력 */
function RaidBanner() {
  const s = store.s;
  const session = useSession();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!s.raid) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [s.raid]);
  if (!s.raid) return null;
  const left = Math.max(0, Math.ceil((s.raid.arriveAt - now) / 1000));
  const raidBase = s.bases[s.raid.baseId];
  const def = withBase(s.raid.baseId, () => defenseScore(s));
  const ok = def.total >= s.raid.size;
  return (
    <div className="raid-banner">
      <div className="raid-title">
        🧟 습격까지 {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}
      </div>
      <div className="small">⌂ {raidBase?.name}</div>
      <div className="small">
        좀비 {s.raid.size}마리 · 방어력 <b className={ok ? 'good-text' : 'bad-text'}>{def.total}</b>
        <span className="muted"> (시설 {def.walls} + 사람 {def.people})</span>
      </div>
      <div className="muted small">경계 근무를 세우고, 자는 사람을 깨우고, 바리케이드를 놓자.</div>
      <button className="small" onClick={() => wakeEveryone(session.player)}>
        내 캐릭터 모두 깨우기
      </button>
    </div>
  );
}
