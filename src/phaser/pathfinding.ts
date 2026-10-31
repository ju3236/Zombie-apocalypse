export interface P {
  x: number;
  y: number;
}

/**
 * 격자 BFS. goals 에 포함된 칸은 통행 불가여도 마지막 칸으로 진입할 수 있다 (의자/침대 위로 올라가기).
 * 반환: 시작 칸을 제외한 경로. 실패 시 null.
 */
export function findPath(w: number, h: number, walk: boolean[], start: P, goals: P[]): P[] | null {
  if (!goals.length) return null;
  const goalSet = new Set(goals.map((g) => g.y * w + g.x));
  const s = start.y * w + start.x;
  if (goalSet.has(s)) return [];
  const prev = new Int32Array(w * h).fill(-1);
  prev[s] = s;
  const q: number[] = [s];
  let head = 0;
  const dirs = [1, -1, w, -w];
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % w;
    for (const d of dirs) {
      const n = cur + d;
      if (n < 0 || n >= w * h) continue;
      if ((d === 1 && cx === w - 1) || (d === -1 && cx === 0)) continue;
      if (prev[n] !== -1) continue;
      const isGoal = goalSet.has(n);
      if (!walk[n] && !isGoal) continue;
      prev[n] = cur;
      if (isGoal) {
        const path: P[] = [];
        let k = n;
        while (k !== s) {
          path.push({ x: k % w, y: Math.floor(k / w) });
          k = prev[k];
        }
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}
