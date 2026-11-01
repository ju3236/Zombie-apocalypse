import { useEffect, useState } from 'react';
import { sessionStore, store, useSession, type Tab } from '../game/store';
import { dayOf, formatTime, isNight } from '../game/util';
import { activeCharacter, Avatar } from './common';
import { WeatherBadge } from './Weather';
import { SeasonBanner } from './World';

/** 휴대폰 위쪽 줄: 날짜·시각, 습격 남은 시간, 설정 */
export function MobileTop() {
  const s = store.s;
  const night = isNight(s.time);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!s.raid) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [s.raid]);
  const left = s.raid ? Math.max(0, Math.ceil((s.raid.arriveAt - now) / 1000)) : 0;
  return (
    <div className="mobile-top">
      <span className="mt-day">DAY {dayOf(s.time)}</span>
      <span className={`mt-time ${night ? 'night' : ''}`}>
        {night ? '☾' : '☼'} {formatTime(s.time).split(' ')[1]}
      </span>
      <WeatherBadge compact />
      <SeasonBanner />
      {s.raid && (
        <button className="mt-raid" onClick={() => sessionStore.update({ pane: 'left' })}>
          🧟 {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}
        </button>
      )}
      <button className="ghost mt-gear" onClick={() => sessionStore.update({ tab: 'settings', pane: 'center' })} title="설정">
        ⚙
      </button>
    </div>
  );
}

/** 휴대폰 아래 탭: 나·상태 · 메인 · 생존자 · 창고 · 채팅 */
export function MobileNav() {
  const session = useSession();
  const s = store.s;
  const pane = session.pane ?? 'center';
  const c = activeCharacter();
  const exp = Object.keys(s.expeditions).length;
  const go = (tab: Tab) => sessionStore.update(tab === 'characters' ? { tab, pane: 'center', viewCharId: null } : { tab, pane: 'center' });
  const on = (tab: Tab) => pane === 'center' && session.tab === tab;
  return (
    <nav className="mobile-nav">
      <button className={pane === 'left' ? 'active' : ''} onClick={() => sessionStore.update({ pane: 'left' })}>
        <span className="mn-icon">{c ? <Avatar a={c.appearance} sprite={c.sprite} size={18} /> : '♥'}</span>나·상태{s.raid && <span className="badge">!</span>}
      </button>
      <button className={on('main') ? 'active' : ''} onClick={() => go('main')}>
        <span className="mn-icon">⌂</span>메인{exp > 0 && <span className="badge">{exp}</span>}
      </button>
      <button className={on('characters') ? 'active' : ''} onClick={() => go('characters')}>
        <span className="mn-icon">☺</span>생존자
      </button>
      <button className={on('storage') ? 'active' : ''} onClick={() => go('storage')}>
        <span className="mn-icon">▤</span>창고
      </button>
      <button className={pane === 'right' ? 'active' : ''} onClick={() => sessionStore.update({ pane: 'right' })}>
        <span className="mn-icon">💬</span>채팅
      </button>
    </nav>
  );
}
