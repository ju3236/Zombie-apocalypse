import { useState } from 'react';
import { toast } from '../game/bus';
import { LOCATION_BY_ID, LOCATIONS } from '../game/data/locations';
import { store } from '../game/store';
import { hopMs, hopProblem, hopTo } from '../game/systems/expedition';
import type { Character, Expedition } from '../game/types';
import { fixJosa } from '../game/util';

/** 탐험지에서 거점에 들르지 않고 바로 다른 탐험지로 */
export function HopBox({ c, e, target }: { c: Character; e: Expedition; target?: string | null }) {
  const s = store.s;
  const [pick, setPick] = useState('');
  const here = LOCATION_BY_ID[e.locationId];
  if (!here || e.phase !== 'there') return null;
  const dist = (id: string) => Math.hypot(LOCATION_BY_ID[id].pos.x - here.pos.x, LOCATION_BY_ID[id].pos.y - here.pos.y);
  const options = LOCATIONS.filter((l) => l.id !== e.locationId && s.locations[l.id]?.discovered)
    .sort((a, b) => dist(a.id) - dist(b.id))
    .slice(0, 40);
  const id = target && target !== e.locationId ? target : pick;
  const loc = id ? LOCATION_BY_ID[id] : null;
  const err = loc ? hopProblem(c, loc.id) : null;
  const mins = loc ? Math.round(hopMs(c, e, loc) / 60000) : 0;
  return (
    <div className="hop-box">
      <div className="small">🧭 <b>다른 탐험지로 바로 이동</b> <span className="muted">— 거점에 들르지 않는다. 짐은 그대로 들고 간다.</span></div>
      {!target && (
        <select value={pick} onChange={(ev) => setPick(ev.target.value)}>
          <option value="">가까운 곳부터… (지도에서 눌러도 된다)</option>
          {options.map((l) => (
            <option key={l.id} value={l.id}>
              {l.icon} {l.name} · {Math.round(hopMs(c, e, l) / 60000)}분{l.far ? ' · 🚗' : ''}
            </option>
          ))}
        </select>
      )}
      {loc && (
        <>
          <div className="small">
            {loc.icon} <b>{loc.name}</b> · 이동 {mins}분 · 위험 {'●'.repeat(loc.danger)}
          </div>
          {err && <div className="warn small">{err}</div>}
          <button
            className="primary"
            disabled={!!err}
            onClick={() => {
              const r = hopTo(c.id, loc.id);
              if (r) toast(r, 'bad');
              else toast(fixJosa(`${loc.name}(으)로 출발했다.`), 'good');
              setPick('');
            }}
          >
            🧭 {loc.name}(으)로 이동 ({mins}분)
          </button>
        </>
      )}
    </div>
  );
}
