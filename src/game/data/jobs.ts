import type { BaseTask, SkillId } from '../types';
import type { Mods } from './traits';

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
  /** 분야 */
  cat: string;
  desc: string;
  /** 시작 레벨 */
  skills: Partial<Record<SkillId, number>>;
  startItems: { itemId: string; qty: number }[];
  /** 고유 효과 (특성과 같은 방식) */
  mods: Mods;
  /** 추가 특성 포인트 (전문성이 적은 직업일수록 많다) */
  pts: number;
}

export const JOB_CATS = ['안전·치안', '의료', '연구·기술', '건축·정비', '식량·농업', '유통·운송', '생활·서비스', '교육·예술', '야외·체육', '특수·자유'];

function parseSkills(t: string): Partial<Record<SkillId, number>> {
  const out: Partial<Record<SkillId, number>> = {};
  for (const m of t.matchAll(/([a-z]+)(\d)/g)) out[m[1] as SkillId] = Number(m[2]);
  return out;
}
const J = (cat: number, id: string, name: string, skills: string, desc: string, mods: Mods, items: [string, number][] = [], pts = 0): JobDef => ({
  id, name, cat: JOB_CATS[cat], desc, skills: parseSkills(skills), mods, pts, startItems: items.map(([itemId, qty]) => ({ itemId, qty })),
});

export const JOBS: JobDef[] = [
  // A. 안전·치안
  J(0, 'police', '경찰관', 'firearm2 melee1', '총을 다루는 손이 안정적이다.', { firearm: 0.05, wear: 0.1 }, [['flashlight', 1]]),
  J(0, 'detective', '형사', 'scavenge2 stealth1', '현장에서 단서를 놓치지 않는다.', { clue: 0.3, secret: 0.1, lockpick: 0.1 }, [['p_book', 1]]),
  J(0, 'swat', '경찰특공대원', 'firearm2 melee2', '여럿에게 둘러싸여도 버틴다.', { dodge: 0.06, defense: 1 }, [['flashlight', 1]]),
  J(0, 'soldier', '군인', 'melee2 firearm2', '무기를 아껴 쓰고 체력이 좋다.', { wear: 0.2, energy: 0.05 }, [['ration_pack', 1]]),
  J(0, 'quartermaster', '군수보급병', 'scavenge2 firearm1', '탄약과 보급품을 귀신같이 찾는다.', { find: { ammo: 0.3, food: 0.1 } }, [['ration_pack', 1]]),
  J(0, 'firefighter', '소방관', 'melee2 scavenge1', '도끼를 잘 쓰고 문을 부술 때 소음이 적다.', { melee: 0.05, noise: 0.1, hp: 0.05 }, [['bandage', 1]]),
  J(0, 'prison_guard', '교도관', 'melee2', '제압과 방어에 능하다.', { shove: 0.15, defense: 1 }),
  J(0, 'bodyguard', '경호원', 'melee2 firearm1', '동료를 지키는 게 몸에 배었다.', { cover: 0.2, bond: 0.1 }),
  J(0, 'security_guard', '경비원', 'stealth1 melee1 scavenge1', '수상한 기척을 먼저 알아챈다.', { detect: 0.2 }, [['flashlight', 1]]),
  J(0, 'rescuer', '민간 구조대원', 'scavenge2 medical1', '부상자를 데리고 움직이는 데 익숙하다.', { cover: 0.1, med: 0.1, travel: 0.05 }, [['bandage', 1]]),
  // B. 의료
  J(1, 'surgeon', '외과의사', 'medical4', '깊은 상처도 빠르게 처치하고 약품을 아낀다.', { med: 0.3, medSave: 0.15 }, [['disinfectant', 1]]),
  J(1, 'physician', '내과의사', 'medical3', '병을 미리 막고 회복을 관리한다.', { sick: 0.2, infect: 0.15, regen: 0.1 }, [['painkiller', 1]]),
  J(1, 'nurse', '간호사', 'medical3', '붕대·소독·투약에 능숙하다.', { med: 0.2, care: 0.2 }, [['bandage', 2], ['disinfectant', 1]]),
  J(1, 'paramedic', '응급구조사', 'medical2 scavenge1', '현장에서 지혈하고 동료를 부축한다.', { med: 0.15, cover: 0.1 }, [['bandage', 2]]),
  J(1, 'pharmacist', '약사', 'medical3', '약을 알아보고 직접 만든다.', { craftBonus: { medical: 0.3 }, find: { medical: 0.15 } }, [['painkiller', 1]]),
  J(1, 'vet', '수의사', 'medical2 farming1', '생명체를 다루는 데 익숙하다.', { infect: 0.1, med: 0.1, bond: 0.05 }),
  J(1, 'dentist', '치과의사', 'medical2 crafting1', '정밀한 손놀림으로 치료한다.', { med: 0.15, craftSave: 0.05 }),
  J(1, 'lab_tech', '임상병리사', 'medical2', '감염의 징후를 읽는다.', { infect: 0.15, clue: 0.15 }),
  J(1, 'physio', '물리치료사', 'medical2', '다친 몸을 다시 움직이게 한다.', { heal: 0.15, care: 0.15 }),
  J(1, 'care_worker', '요양보호사', 'medical2 cooking1', '아픈 사람을 오래 돌봐 왔다.', { care: 0.25, bond: 0.1 }),
  // C. 연구·기술
  J(2, 'biologist', '생물학 연구원', 'medical2', '감염을 누구보다 잘 안다.', { infect: 0.15, clue: 0.15 }, [['research_notes', 1]]),
  J(2, 'chemist', '화학 연구원', 'crafting2 medical1', '물질을 다뤄 재료를 아낀다.', { craftSave: 0.1, craftBonus: { medical: 0.15 } }),
  J(2, 'pharma_researcher', '제약 연구원', 'medical2 crafting1', '약을 더 많이 만들어 낸다.', { craftBonus: { medical: 0.25 } }),
  J(2, 'programmer', '프로그래머', 'crafting1 scavenge1', '기기 속 정보를 뒤진다.', { find: { tool: 0.1 }, clue: 0.1, xp: 0.05 }, [], 2),
  J(2, 'engineer', '전자공학자', 'crafting3', '전자 부품과 도구 제작에 능하다.', { craftBonus: { tool: 0.15, facility: 0.1 } }, [['screwdriver', 1]]),
  J(2, 'telecom', '통신기술자', 'crafting2', '무전 설비를 다루고 다른 무리와 연락이 잘 닿는다.', { trade: 0.15, craftBonus: { facility: 0.15 } }, [['battery', 2]]),
  J(2, 'meteorologist', '기상관측원', 'farming1 scavenge1', '날씨를 읽어 물과 농사를 챙긴다.', { water: 0.2, farm: 0.1 }),
  J(2, 'forensic', '법과학 연구원', 'scavenge2 medical1', '흔적을 분석해 단서를 찾는다.', { clue: 0.3, secret: 0.1 }),
  J(2, 'data_analyst', '데이터 분석가', 'scavenge1', '정보를 정리해 길을 찾는다.', { clue: 0.2, xp: 0.1 }, [], 2),
  J(2, 'professor', '대학교수', 'medical1 crafting1', '배우는 방법을 안다.', { xp: 0.2, clue: 0.1 }, [['p_book', 1]], 1),
  // D. 건축·정비
  J(3, 'carpenter', '목수', 'crafting3', '가구를 잘 만들고 나무를 아낀다.', { craftBonus: { furniture: 0.25 }, craftSave: 0.05 }, [['nails', 6], ['plank', 2]]),
  J(3, 'construction', '건설노동자', 'crafting2 melee1', '무거운 자재를 거뜬히 나른다.', { carry: 3, craftSave: 0.05 }),
  J(3, 'architect', '건축설계사', 'crafting2', '자재를 아끼고 건축 자재를 더 만든다.', { craftSave: 0.15, craftBonus: { building: 0.2 } }),
  J(3, 'welder', '용접공', 'crafting2 melee1', '금속으로 무기와 시설을 만든다.', { craftBonus: { weapon: 0.15, facility: 0.1 } }),
  J(3, 'electrician', '전기기사', 'crafting2', '전력·통신 시설을 잘 다룬다.', { craftBonus: { facility: 0.2 }, facility: 0.05 }, [['wire', 2]]),
  J(3, 'plumber', '배관공', 'crafting2', '물 시설을 잘 돌린다.', { water: 0.3 }),
  J(3, 'auto_mech', '자동차 정비사', 'crafting2', '부품을 잘 뜯어내고 차를 잘 몬다.', { find: { material: 0.15 }, travel: 0.05 }),
  J(3, 'machinist', '기계정비사', 'crafting2', '자재와 장비를 아낀다.', { craftSave: 0.1, wear: 0.1 }),
  J(3, 'locksmith', '열쇠 수리공', 'crafting1 stealth2', '자물쇠라면 자신 있다.', { lockpick: 0.3 }, [['lockpick', 2]]),
  J(3, 'furniture_maker', '가구 제작자', 'crafting3', '가구를 하나 더 만들어 낸다.', { craftBonus: { furniture: 0.3 } }),
  // E. 식량·농업
  J(4, 'farmer', '농부', 'farming3 crafting1', '작물을 잘 키운다.', { farm: 0.2 }, [['seeds', 3]]),
  J(4, 'gardener', '원예사', 'farming3', '식물로 집을 아늑하게 만든다.', { farm: 0.15, comfort: 2 }, [['seeds', 2]]),
  J(4, 'rancher', '축산업자', 'farming2 melee1', '먹을거리를 잘 구하고 힘이 좋다.', { find: { food: 0.15 }, carry: 1 }),
  J(4, 'fisher', '어부', 'farming1 cooking1 stealth1', '바다에서 잔뼈가 굵었다. 낚시에 능하다.', { fish: 0.3, water: 0.1, find: { food: 0.05 } }, [['fishing_rod', 1]]),
  J(4, 'hunter', '사냥꾼', 'firearm2 stealth2', '조용히 움직이고 먹을 걸 구한다.', { noise: 0.15, find: { food: 0.15 } }),
  J(4, 'chef', '요리사', 'cooking3 melee1', '요리를 더 많이, 더 맛있게 만든다.', { craftBonus: { food: 0.3 } }, [['canned_beans', 1]]),
  J(4, 'baker', '제빵사', 'cooking3', '오래가는 음식을 만든다.', { craftBonus: { food: 0.2 }, hunger: 0.05 }, [['rice', 1]]),
  J(4, 'butcher', '정육점 직원', 'cooking2 melee1', '칼질이 능숙하다.', { craftBonus: { food: 0.15 }, melee: 0.03 }, [['kitchen_knife', 1]]),
  J(4, 'food_factory', '식품공장 직원', 'cooking2 crafting1', '음식을 대량으로 다룬다.', { craftBonus: { food: 0.15 }, craftSave: 0.05 }),
  J(4, 'barista', '바리스타', 'cooking2', '커피 한 잔으로 하루를 버틴다.', { craftBonus: { food: 0.1 }, energy: 0.05 }, [['coffee', 2]]),
  // F. 유통·운송
  J(5, 'courier', '택배기사', 'scavenge2', '짐을 잘 나르고 택배 상자를 잘 뒤진다.', { carry: 3, find: { prop: 0.1 } }),
  J(5, 'delivery', '배달원', 'stealth1 scavenge1', '골목길을 훤히 안다.', { travel: 0.2 }),
  J(5, 'trucker', '화물차 운전사', 'crafting1', '먼 길을 많이 싣고 달린다.', { travel: 0.05, carry: 2 }),
  J(5, 'bus_driver', '버스 운전사', 'crafting1', '여럿을 이끌고 다니는 데 익숙하다.', { travel: 0.08, cover: 0.05 }),
  J(5, 'warehouse_worker', '물류창고 직원', 'scavenge2', '물건 찾는 데 빠르다.', { loot: 0.08, carry: 2 }),
  J(5, 'warehouse_mgr', '창고관리자', 'scavenge1 crafting1', '창고와 설비를 잘 굴린다.', { facility: 0.1, craftSave: 0.05 }),
  J(5, 'mart_staff', '마트 직원', 'scavenge2', '식량과 음료가 어디 있을지 안다.', { find: { food: 0.15, drink: 0.15 } }),
  J(5, 'cstore_parttime', '편의점 아르바이트', 'scavenge1 stealth1', '작은 가게라면 눈 감고도 턴다.', { find: { food: 0.1, drink: 0.1 } }, [['chips', 1]], 2),
  J(5, 'salesperson', '영업사원', 'scavenge1', '말로 사람을 움직인다.', { trade: 0.3, bond: 0.1 }, [], 1),
  J(5, 'pawnbroker', '중고상', 'scavenge2', '값진 물건을 알아보고 흥정한다.', { rare: 0.05, trade: 0.15 }),
  // G. 생활·서비스
  J(6, 'office_worker', '회사원', 'scavenge1 crafting1', '꼼꼼하고 무엇이든 무난하게 해낸다.', { clue: 0.1, find: { prop: 0.1 }, xp: 0.05 }, [['p_mug', 1]], 4),
  J(6, 'homemaker', '가사 담당', 'cooking2 medical1', '살림을 잘 꾸린다.', { craftBonus: { food: 0.1 }, comfort: 2, facility: 0.05 }, [], 1),
  J(6, 'hairdresser', '미용사', 'medical1 crafting1', '사람과 금방 친해진다.', { bond: 0.15, comfort: 1 }, [], 2),
  J(6, 'tailor', '재봉사', 'crafting2', '옷감을 잘 다룬다.', { find: { clothing: 0.2 }, craftBonus: { tool: 0.1 } }, [['cloth', 3]]),
  J(6, 'fashion', '패션디자이너', 'crafting2', '옷을 알아보고 잘 고친다.', { find: { clothing: 0.2 }, bond: 0.05 }),
  J(6, 'interior', '인테리어 디자이너', 'crafting2', '어디든 아늑하게 꾸민다.', { comfort: 3, find: { furniture: 0.15, prop: 0.1 } }),
  J(6, 'cleaner', '청소업자', 'scavenge1', '더러운 곳에서도 병에 잘 안 걸린다.', { sick: 0.2, infect: 0.1, find: { material: 0.05 } }, [], 1),
  J(6, 'pet_sitter', '반려동물 돌봄사', 'medical1 farming1', '돌보는 데 익숙하고 마음이 따뜻하다.', { bond: 0.15, comfort: 1, nerve: 0.05 }, [], 1),
  J(6, 'hotel_staff', '호텔 직원', 'cooking1', '잠자리를 잘 꾸민다.', { sleep: 0.15, comfort: 2 }, [], 1),
  J(6, 'janitor', '시설관리인', 'crafting2', '거점 설비를 잘 돌본다.', { facility: 0.15 }),
  // H. 교육·예술
  J(7, 'teacher', '교사', 'medical1', '배우는 법과 사람을 다루는 법을 안다.', { xp: 0.1, bond: 0.1 }, [['p_book', 1]], 2),
  J(7, 'college', '대학생', 'scavenge1 crafting1', '배운 게 많고 아직 배울 게 많다.', { xp: 0.15 }, [['school_bag', 1]], 3),
  J(7, 'student', '고등학생', 'stealth2 scavenge1', '무엇이든 빨리 배우고 몸이 가볍다.', { xp: 0.25 }, [['school_bag', 1]], 3),
  J(7, 'librarian', '사서', 'scavenge1', '책과 문서를 잘 찾는다.', { find: { prop: 0.2 }, clue: 0.15 }, [['glasses', 1]], 1),
  J(7, 'journalist', '기자', 'stealth1 scavenge1', '이야기의 실마리를 쫓는다.', { clue: 0.3 }),
  J(7, 'photographer', '사진작가', 'stealth1', '기록할 가치가 있는 걸 알아본다.', { clue: 0.1, find: { prop: 0.15 } }, [], 1),
  J(7, 'painter', '화가', 'crafting1', '방을 그림처럼 꾸민다.', { comfort: 2, find: { prop: 0.1 } }, [], 2),
  J(7, 'musician', '음악가', 'crafting1', '노래로 사람들을 버티게 한다.', { bond: 0.15, nerve: 0.1 }, [], 2),
  J(7, 'writer', '작가', 'scavenge1', '글 속의 단서를 읽는다.', { clue: 0.25, xp: 0.05 }, [['glasses', 1]], 2),
  J(7, 'videographer', '영상제작자', 'crafting1 stealth1', '전자 장비를 잘 다룬다.', { find: { tool: 0.1 }, clue: 0.1 }),
  // I. 야외·체육
  J(8, 'ranger', '산림관리원', 'farming1 melee1 scavenge1', '숲에서 재료를 잘 구한다.', { find: { material: 0.15 }, energy: 0.05 }),
  J(8, 'mountaineer', '등산가', 'stealth1 scavenge1', '오래 걸어도 지치지 않는다.', { energy: 0.12, travel: 0.05 }),
  J(8, 'camp_instructor', '캠핑강사', 'cooking1 crafting1', '어디서든 잘 자고 도구를 만든다.', { craftBonus: { tool: 0.15 }, sleep: 0.1, fish: 0.05 }),
  J(8, 'explorer', '탐험가', 'scavenge2 stealth1', '새로운 곳일수록 많이 찾는다.', { firstVisit: 0.3, secret: 0.08 }),
  J(8, 'sanitation', '환경미화원', 'scavenge2', '폐품 속에서 재료를 건진다.', { find: { material: 0.25 }, sick: 0.1 }),
  J(8, 'swim_coach', '수영강사', 'stealth1', '숨이 길고 몸이 빠르다.', { flee: 0.08, energy: 0.05, cover: 0.05 }),
  J(8, 'trainer', '체육트레이너', 'melee1', '몸을 회복시키는 법을 안다.', { energy: 0.1, regen: 0.15, care: 0.1 }),
  J(8, 'athlete', '운동선수', 'melee2', '체력과 지구력이 좋다.', { energy: 0.12, flee: 0.08, carry: 1 }),
  J(8, 'angler', '낚시꾼', 'farming1 cooking1', '물가에서 기다리는 데 익숙하다.', { fish: 0.35 }, [['fishing_rod', 1]], 1),
  J(8, 'park_keeper', '공원관리원', 'farming2', '식물과 바깥 시설을 돌본다.', { farm: 0.1, facility: 0.1 }),
  // J. 특수·자유
  J(9, 'unemployed', '무직', '', '정해진 길이 없다. 대신 특성 포인트를 많이 받는다.', { xp: 0.05 }, [['chocolate', 2]], 8),
  J(9, 'retiree', '은퇴자', 'medical1 cooking1 crafting1 farming1', '살면서 이것저것 다 해 봤다.', { bond: 0.1 }, [], 3),
  J(9, 'volunteer', '자원봉사자', 'medical1 cooking1', '궂은일에 먼저 손을 든다.', { care: 0.15, facility: 0.05, bond: 0.1 }, [], 2),
  J(9, 'prepper', '생존주의자', 'scavenge1 crafting1 farming1 stealth1', '이날을 대비해 왔다.', { find: { food: 0.1, tool: 0.05 } }, [['lighter', 1]]),
  J(9, 'private_eye', '사설탐정', 'stealth2 scavenge1', '조사와 미행이 특기다.', { clue: 0.25, secret: 0.1 }),
  J(9, 'ex_thief', '전직 절도범', 'stealth3', '소리 없이 들어가 값진 걸 챙긴다.', { lockpick: 0.2, rare: 0.05, noise: 0.1 }, [['lockpick', 1]]),
  J(9, 'smuggler', '밀수업자', 'stealth2 scavenge1', '숨긴 물건을 찾고 거래에 밝다.', { secret: 0.15, trade: 0.15 }),
  J(9, 'radio_host', '라디오 진행자', '', '목소리로 사람을 모은다.', { trade: 0.2, bond: 0.15 }, [['walkie_talkie', 1]], 3),
  J(9, 'progamer', '프로게이머', 'firearm1', '반응 속도와 조준이 정밀하다.', { firearm: 0.08, hit: 0.02, detect: 0.05 }, [], 2),
  J(9, 'arcade_staff', '오락실 직원', 'crafting1', '낡은 기계를 살려 쓴다.', { find: { tool: 0.1, prop: 0.1 } }, [], 3),
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
