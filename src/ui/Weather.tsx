import { useState } from 'react';
import { store } from '../game/store';
import { WEATHER } from '../game/systems/weather';
import { formatLeft } from '../game/systems/effects';

/** 지금 날씨. 누르면 영향과 바뀔 때까지 남은 시간 */
export function WeatherBadge({ compact }: { compact?: boolean }) {
  const s = store.s;
  const [open, setOpen] = useState(false);
  const w = WEATHER[s.weather?.kind ?? 'clear'];
  const left = Math.max(0, (s.weather?.until ?? s.time) - s.time);
  return (
    <span className={`weather ${compact ? 'compact' : ''}`}>
      <button className="ghost weather-btn" onClick={() => setOpen(!open)} title={`${w.name}: ${w.desc}`}>
        {w.icon} {!compact && w.name}
      </button>
      {open && (
        <div className="weather-pop" onClick={() => setOpen(false)}>
          <div className="fx-d-title">
            {w.icon} {w.name}
          </div>
          <div className="small">{w.desc}</div>
          <div className="muted small">약 {formatLeft(left)} 뒤 바뀜</div>
        </div>
      )}
    </span>
  );
}
