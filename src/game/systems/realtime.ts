import { runsFor } from '../online';
import { store } from '../store';
import { clockTarget } from './clock';
import { processExpedition } from './expedition';
import { advanceTime } from './time';
import { maybeStartRaid, resolveRaid } from './raid';

/** 한 번에 따라잡을 최대 시간 (이보다 오래 비웠으면 나머지는 건너뛴다) */
const MAX_CATCHUP = 14 * 1440;

/**
 * 실시간 진행: 게임 시계를 현실 시간에 맞추고, 탐험(이동·장기 탐사·귀환)을 진행한다.
 * 같이 살기 중에는 시계는 한 사람만, 탐험은 그 캐릭터 주인이(접속 중이면) 돌린다.
 */
export function runRealtime(now = Date.now()): boolean {
  if (!store.has) return false;
  const s = store.s;
  let changed = false;
  if (runsFor(null)) {
    const target = clockTarget(s, now);
    const d = Math.floor(target - s.time);
    if (d >= 1) {
      // 몇 분 이상 비어 있던 시간(아무도 시계를 돌리지 않음)은 안전하게 따라잡는다
      advanceTime(Math.min(d, MAX_CATCHUP), d > 10);
      if (d > MAX_CATCHUP) s.time = Math.floor(target);
      // 습격은 누군가 접속해 있을 때만 시작한다 (따라잡는 시간에는 없음)
      if (d <= 10) maybeStartRaid(d, now);
      changed = true;
    }
    if (resolveRaid(now)) changed = true;
  }
  for (const id of Object.keys(s.expeditions)) {
    const c = s.characters[id];
    if (!c || !runsFor(c.owner)) continue;
    if (processExpedition(id, now)) changed = true;
  }
  return changed;
}
