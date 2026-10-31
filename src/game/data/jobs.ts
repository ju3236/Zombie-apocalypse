import type { BaseTask, SkillId } from '../types';

export const SKILL_LABEL: Record<SkillId, string> = {
  melee: '근접 전투',
  firearm: '사격',
  scavenge: '수색',
  stealth: '은신',
  crafting: '제작',
  cooking: '요리',
  medical: '의료',
  farming: '농업',
};

export const SKILL_IDS = Object.keys(SKILL_LABEL) as SkillId[];

export interface JobDef {
  id: string;
  name: string;
  desc: string;
  /** 시작 레벨 */
  skills: Partial<Record<SkillId, number>>;
  startItems: { itemId: string; qty: number }[];
}

export const JOBS: JobDef[] = [
  { id: 'unemployed', name: '무직', desc: '특별한 재능은 없지만, 무엇이든 될 수 있다.', skills: { scavenge: 1, stealth: 1 }, startItems: [{ itemId: 'chocolate', qty: 2 }] },
  { id: 'firefighter', name: '소방관', desc: '체력과 근접 전투에 능하다.', skills: { melee: 2, scavenge: 1 }, startItems: [{ itemId: 'bandage', qty: 1 }] },
  { id: 'nurse', name: '간호사', desc: '치료와 의료품 제작에 능하다.', skills: { medical: 3 }, startItems: [{ itemId: 'bandage', qty: 2 }, { itemId: 'disinfectant', qty: 1 }] },
  { id: 'carpenter', name: '목수', desc: '가구와 시설 제작에 능하다.', skills: { crafting: 3 }, startItems: [{ itemId: 'nails', qty: 6 }, { itemId: 'plank', qty: 2 }] },
  { id: 'chef', name: '요리사', desc: '적은 재료로 든든한 식사를 만든다.', skills: { cooking: 3, melee: 1 }, startItems: [{ itemId: 'canned_beans', qty: 1 }] },
  { id: 'police', name: '경찰', desc: '사격과 전투에 익숙하다.', skills: { firearm: 2, melee: 1, stealth: 1 }, startItems: [{ itemId: 'flashlight', qty: 1 }] },
  { id: 'farmer', name: '농부', desc: '텃밭을 잘 가꾼다.', skills: { farming: 3, crafting: 1 }, startItems: [{ itemId: 'seeds', qty: 3 }] },
  { id: 'student', name: '학생', desc: '배우는 속도가 빠르고 몸이 가볍다.', skills: { stealth: 2, scavenge: 1 }, startItems: [{ itemId: 'school_bag', qty: 1 }] },
  { id: 'engineer', name: '엔지니어', desc: '전자 기기와 도구를 다룬다.', skills: { crafting: 2, scavenge: 1 }, startItems: [{ itemId: 'screwdriver', qty: 1 }] },
];

export const JOB_BY_ID: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j]));

export const TASK_LABEL: Record<BaseTask, string> = {
  free: '자유 행동',
  rest: '휴식',
  farm: '텃밭 관리',
  water: '물 관리',
  guard: '경계 근무',
  workshop: '작업장 정리',
};

export const TASK_DESC: Record<BaseTask, string> = {
  free: '거점을 자유롭게 돌아다닌다.',
  rest: '침대에서 쉬며 기력과 체력을 더 빨리 회복한다.',
  farm: '텃밭 성장 속도 +40% (중첩 가능)',
  water: '빗물 수집 속도 +40% (중첩 가능)',
  guard: '바리케이드 근처를 지킨다. (방어 이벤트 대비)',
  workshop: '작업대 근처에서 정리한다.',
};

// 숙련 레벨 = 누적 경험치 → 레벨 0~10
export function skillLevel(xp: number): number {
  let lvl = 0;
  while (lvl < 10 && xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export function xpForLevel(lvl: number): number {
  return 25 * lvl * (lvl + 1);
}
