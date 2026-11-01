import type { ItemCategory, SkillId } from '../types';
import type { RecipeGroup } from './recipes';

/**
 * 특성·직업 효과. 모든 수치는 "좋은 쪽이 +" 로 적는다.
 * 예) energy: 0.15 → 기력 소모 −15%,  travel: −0.1 → 이동 시간 +10%
 */
export interface Mods {
  /** 받는 피해 감소 */
  hp?: number;
  /** 체력 자연 회복 */
  regen?: number;
  /** 상처가 낫는 속도 */
  heal?: number;
  /** 배탈·병 걸릴 확률 감소 */
  sick?: number;
  /** 감염이 오르는 속도 감소 */
  infect?: number;
  /** 기력 소모 감소 */
  energy?: number;
  hunger?: number;
  thirst?: number;
  /** 잠으로 회복하는 기력 */
  sleep?: number;
  /** 들 수 있는 무게(kg) */
  carry?: number;
  /** 이동 시간 감소 */
  travel?: number;
  flee?: number;
  /** 좀비 공격을 피함 (맞을 확률 감소) */
  dodge?: number;
  /** 명중 (모든 무기) */
  hit?: number;
  melee?: number;
  firearm?: number;
  /** 밀쳐내기 */
  shove?: number;
  /** 무기 내구도 소모 감소 */
  wear?: number;
  /** 내는 소음 감소 */
  noise?: number;
  /** 수색할 때 물건을 하나 더 찾을 확률 */
  loot?: number;
  /** 희귀한 물건을 찾을 확률 */
  rare?: number;
  /** 숨은 공간 발견 */
  secret?: number;
  /** 어두운 곳에서 놓치는 물건 감소 */
  dark?: number;
  /** 좀비를 먼저 알아챔 (들키지 않고 시작) */
  detect?: number;
  /** 목표 단서 발견 */
  clue?: number;
  /** 담력: + 트라우마·겁에 덜 시달림 / − 좀비를 보면 겁에 질림 */
  nerve?: number;
  /** 처음 가는 곳에서 더 찾음 */
  firstVisit?: number;
  /** 파티원 엄호 */
  cover?: number;
  /** 치료 효과 (자신·남) */
  med?: number;
  /** 남을 치료할 때 추가 효과 */
  care?: number;
  /** 치료할 때 약품을 아낄 확률 */
  medSave?: number;
  /** 제작할 때 재료 하나를 아낄 확률 (− 면 하나 더 버림) */
  craftSave?: number;
  /** 모든 숙련 경험치 */
  xp?: number;
  /** 거점 생산: 텃밭·온실 / 물 / 전부 (거점 주민 중 가장 높은 값) */
  farm?: number;
  water?: number;
  facility?: number;
  /** 세력 태도가 오를 때 더 오른다 */
  trade?: number;
  /** 호감이 쌓이는 속도 */
  bond?: number;
  /** 습격 방어력(점) */
  defense?: number;
  /** 자물쇠 따기 */
  lockpick?: number;
  /** 자는 침대의 아늑함(점) */
  comfort?: number;
  /** 차로 먼 길을 가면 멀미 */
  carsick?: number;
  /** 물건 종류별로 더 찾음 ('ammo' = 탄약) */
  find?: Partial<Record<ItemCategory | 'ammo', number>>;
  /** 제작 종류별로 하나 더 만들 확률 */
  craftBonus?: Partial<Record<RecipeGroup, number>>;
  /** 숙련별 경험치 */
  xpSkill?: Partial<Record<SkillId, number>>;
}

export type TraitWhen = 'cold' | 'hot' | 'wet' | 'night' | 'expedition' | 'base' | 'solo' | 'dusty' | 'poorBed' | 'firstVisit' | 'bleeding' | 'dark';

export const WHEN_LABEL: Record<TraitWhen, string> = {
  cold: '한파 속에서',
  hot: '폭염 속에서',
  wet: '젖었을 때',
  night: '밤(21~5시)에',
  expedition: '탐험 중',
  base: '거점에서',
  solo: '파티 없이 혼자일 때',
  dusty: '공장·창고·오염 지역에서',
  poorBed: '침낭·매트리스·맨바닥에서 잘 때',
  firstVisit: '처음 가 보는 곳에서',
  bleeding: '피를 흘릴 때',
  dark: '어두운 구역에서',
};

export interface TraitDef {
  id: string;
  name: string;
  /** 포인트: 긍정 특성은 쓰는 점수, 부정 특성은 얻는 점수 */
  pts: number;
  kind: 'pos' | 'neg' | 'earned';
  group: string;
  desc: string;
  mods: Mods;
  /** 시작 숙련 보정 */
  skills?: Partial<Record<SkillId, number>>;
  when?: TraitWhen;
  /** 이걸 갖추면 단점이 사라진다 */
  negate?: { item?: string; ownBed?: boolean; effect?: string; text: string };
  /** 성장형: 얻는 조건 설명 */
  earn?: string;
}

const P = (id: string, name: string, pts: number, group: string, desc: string, mods: Mods, x: Partial<TraitDef> = {}): TraitDef => ({ id, name, pts, kind: 'pos', group, desc, mods, ...x });
const N = (id: string, name: string, pts: number, group: string, desc: string, mods: Mods, x: Partial<TraitDef> = {}): TraitDef => ({ id, name, pts, kind: 'neg', group, desc, mods, ...x });
const E = (id: string, name: string, earn: string, desc: string, mods: Mods): TraitDef => ({ id, name, pts: 0, kind: 'earned', group: '성장', desc, mods, earn });

export const TRAITS: TraitDef[] = [
  // ───── 긍정: 신체
  P('strong', '강인함', 4, '신체', '맞아도 잘 버틴다.', { hp: 0.13 }),
  P('hardy', '튼튼한 체질', 3, '신체', '잔병치레가 없다.', { sick: 0.5, infect: 0.1 }),
  P('fast_heal', '빠른 회복', 4, '신체', '상처가 금방 아문다.', { heal: 0.2, regen: 0.2 }),
  P('endurance', '지구력', 3, '신체', '오래 걸어도 지치지 않는다.', { energy: 0.15 }, { when: 'expedition' }),
  P('swift', '빠른 발', 3, '신체', '걸음이 빠르다.', { travel: 0.1 }),
  P('agile', '민첩함', 4, '신체', '몸놀림이 가볍다.', { dodge: 0.12, flee: 0.05 }),
  P('mighty', '힘센', 4, '신체', '무거운 것도 거뜬하다.', { carry: 3, shove: 0.05 }),
  P('balance', '균형감각', 2, '신체', '좀처럼 넘어지지 않는다.', { dodge: 0.04, flee: 0.04 }),
  // ───── 긍정: 감각
  P('sharp_eye', '예리한 시력', 2, '감각', '작은 것도 놓치지 않는다.', { loot: 0.1 }),
  P('keen_ear', '예민한 청력', 2, '감각', '발소리를 먼저 듣는다.', { detect: 0.15 }),
  P('keen_nose', '뛰어난 후각', 1, '감각', '상한 음식은 냄새로 안다.', { sick: 0.3 }),
  P('observant', '관찰력', 3, '감각', '어딘가 이상한 걸 금방 눈치챈다.', { secret: 0.1, loot: 0.05 }),
  P('night_vision', '야간 적응', 3, '감각', '어둠에 눈이 빨리 익는다.', { dark: 0.5 }),
  P('sense_dir', '방향감각', 2, '감각', '처음 가는 길도 헤매지 않는다.', { travel: 0.08 }),
  P('visual_memory', '시각 기억력', 2, '감각', '본 것을 잘 기억한다.', { clue: 0.2, secret: 0.05 }),
  // ───── 긍정: 전투
  P('melee_trained', '근접전 숙련', 3, '전투', '몸싸움에 익숙하다.', {}, { skills: { melee: 2 } }),
  P('gun_talent', '사격 재능', 3, '전투', '총을 잡는 손이 안정적이다.', {}, { skills: { firearm: 2 } }),
  P('steady_aim', '안정적인 조준', 3, '전투', '숨을 고르고 쏜다.', { firearm: 0.1 }),
  P('weapon_care', '무기 관리', 2, '전투', '무기를 아껴 쓴다.', { wear: 0.15 }),
  P('reflexes', '반사신경', 4, '전투', '기습에도 몸이 먼저 반응한다.', { detect: 0.15, dodge: 0.06 }),
  P('guard_stance', '방어 자세', 3, '전투', '급소를 지키는 법을 안다.', { hp: 0.08 }),
  P('brawler', '격투 경험', 2, '전투', '밀치고 넘어뜨리는 데 능하다.', { shove: 0.15, melee: 0.03 }),
  // ───── 긍정: 탐험
  P('thorough', '꼼꼼한 수색', 3, '탐험', '서랍 밑까지 뒤진다.', { loot: 0.15 }),
  P('lucky', '행운의 손', 4, '탐험', '이상하게 좋은 게 잘 걸린다.', { rare: 0.1 }),
  P('scrapper', '폐품 활용', 2, '탐험', '고철 더미에서 쓸 만한 걸 찾는다.', { find: { material: 0.2 } }),
  P('secret_sense', '비밀 공간 감지', 3, '탐험', '벽 너머 빈 공간을 느낀다.', { secret: 0.2 }),
  P('quiet_step', '조용한 발걸음', 3, '탐험', '소리 없이 움직인다.', { noise: 0.3 }),
  P('packer', '짐 꾸리기 달인', 2, '탐험', '가방에 빈틈이 없다.', { carry: 2 }),
  P('pathfinder', '길 찾기 달인', 2, '탐험', '지름길을 잘 안다.', { travel: 0.06, energy: 0.05 }),
  // ───── 긍정: 제작
  P('dexterous', '손재주', 3, '제작', '손끝이 야무지다.', { craftSave: 0.08, xpSkill: { crafting: 0.2 } }),
  P('fast_craft', '빠른 제작', 3, '제작', '손이 빨라 남는 자투리로 하나 더 만든다.', { craftBonus: { tool: 0.15, weapon: 0.15 } }),
  P('material_saver', '재료 절약', 4, '제작', '재료를 남김없이 쓴다.', { craftSave: 0.2 }),
  P('blueprint', '설계도 이해', 2, '제작', '도면만 보면 금방 익힌다.', { xpSkill: { crafting: 0.3 } }),
  P('quick_fix', '즉석 수리', 3, '제작', '틈틈이 무기를 손본다.', { wear: 0.12 }),
  P('mechanic_master', '정비의 달인', 3, '제작', '장비가 오래간다.', { wear: 0.15, craftBonus: { facility: 0.1 } }),
  P('dismantler', '해체 전문가', 3, '제작', '뜯어내면 재료가 나온다.', { find: { material: 0.15, furniture: 0.15 } }),
  // ───── 긍정: 식량·생활
  P('cook_sense', '요리 감각', 2, '생활', '간을 잘 맞춘다.', { craftBonus: { food: 0.2 } }),
  P('preserver', '식재료 보존', 3, '생활', '먹을 것을 오래 둔다.', { craftBonus: { food: 0.1 }, hunger: 0.05 }),
  P('garden_sense', '원예 감각', 2, '생활', '시든 잎을 금방 알아본다.', { farm: 0.1 }),
  P('green_thumb', '풍작의 손', 3, '생활', '심는 것마다 잘 자란다.', { farm: 0.25 }),
  P('fishing_sense', '낚시 감각', 2, '생활', '물가에서 먹을 것을 찾는다.', { water: 0.2, find: { food: 0.05 } }),
  P('forager', '채집 감각', 2, '생활', '먹을 수 있는 걸 잘 찾는다.', { find: { food: 0.2 } }),
  P('sewing', '재봉 솜씨', 2, '생활', '옷감을 다룰 줄 안다.', { find: { clothing: 0.15 }, xpSkill: { crafting: 0.1 } }),
  // ───── 긍정: 의료
  P('first_aider', '응급처치 숙련', 3, '의료', '붕대 감는 손이 정확하다.', { med: 0.2 }),
  P('hygiene', '위생 관념', 2, '의료', '상처를 깨끗하게 관리한다.', { infect: 0.2 }),
  P('calm_hands', '침착한 처치', 2, '의료', '급할수록 손이 차분하다.', { med: 0.1, nerve: 0.05 }),
  P('med_saver', '약품 절약', 3, '의료', '꼭 필요한 만큼만 쓴다.', { medSave: 0.2 }),
  P('wound_watch', '부상 관찰', 2, '의료', '상처가 덧나기 전에 알아챈다.', { heal: 0.1 }),
  P('caregiver_t', '회복 보조', 3, '의료', '다친 사람을 잘 돌본다.', { care: 0.25 }),
  // ───── 긍정: 연구·학습
  P('scientific', '과학적 사고', 3, '학습', '흩어진 정보를 잇는다.', { clue: 0.25, xpSkill: { medical: 0.1 } }),
  P('fast_learner', '빠른 학습', 4, '학습', '무엇이든 빨리 배운다.', { xp: 0.15 }),
  P('analyst', '자료 분석', 2, '학습', '단서를 잘 읽는다.', { clue: 0.2 }),
  P('mech_mind', '기계 이해', 2, '학습', '기계 구조가 머리에 그려진다.', { xpSkill: { crafting: 0.2 } }),
  P('meticulous', '꼼꼼한 기록', 2, '학습', '배운 것을 적어 둔다.', { xp: 0.05, clue: 0.1 }),
  // ───── 긍정: 공동체
  P('facility_mgr_t', '시설 관리자', 3, '공동체', '거점 설비를 잘 돌본다.', { facility: 0.15 }),
  P('negotiator', '협상 능력', 2, '공동체', '말로 이득을 본다.', { trade: 0.2 }),
  P('organizer', '조직력', 3, '공동체', '함께 일하면 손발이 맞는다.', { facility: 0.1, bond: 0.1 }),
  P('co_carry', '협동 운반', 2, '공동체', '같이 들면 더 많이 든다.', { carry: 1, cover: 0.05 }),
  P('supply_mgr', '물자 관리', 2, '공동체', '창고가 늘 정돈되어 있다.', { craftSave: 0.05, facility: 0.05 }),
  P('trader', '교역 감각', 3, '공동체', '거래의 흐름을 안다.', { trade: 0.3 }),
  // ───── 긍정: 정신
  P('calm', '침착함', 3, '정신', '위기에도 숨을 고른다.', { nerve: 0.25 }),
  P('stress_resist', '스트레스 저항', 3, '정신', '무너지지 않는다.', { nerve: 0.2 }),
  P('independent', '독립적인 생활', 2, '정신', '혼자서도 잘 버틴다.', { energy: 0.15 }, { when: 'solo' }),
  P('outdoorsy', '야외 적응', 2, '정신', '밖이 오히려 편하다.', { energy: 0.1 }, { when: 'expedition' }),
  P('curious', '호기심', 2, '정신', '새로운 곳은 구석구석 뒤진다.', { loot: 0.25 }, { when: 'firstVisit' }),
  P('focus', '집중력', 3, '정신', '한 가지에 몰두한다.', { craftSave: 0.08, med: 0.08 }),
  // ───── 긍정: 거점·수집
  P('interior_sense', '인테리어 감각', 2, '거점', '어디든 아늑하게 꾸민다.', { comfort: 2 }),
  P('restorer', '가구 복원가', 3, '거점', '버려진 가구도 다시 쓴다.', { find: { furniture: 0.25 } }),
  P('appraiser', '오래된 물건 감정', 2, '거점', '값진 물건을 알아본다.', { find: { prop: 0.2 }, rare: 0.03 }),
  P('workshop_habit', '작업실 습관', 2, '거점', '자기 작업대에서 가장 손이 잘 풀린다.', { craftSave: 0.1 }),
  P('recycler', '재활용 전문가', 3, '거점', '버릴 게 없다.', { find: { material: 0.15 }, craftSave: 0.05 }),
  P('plant_lover', '식물 애호가', 2, '거점', '화분을 들이면 마음이 편하다.', { farm: 0.1, comfort: 1 }),
  P('collector', '수집가', 3, '거점', '진귀한 소품을 모은다.', { find: { prop: 0.25 }, rare: 0.04 }),

  // ───── 부정: 신체
  N('weak', '허약함', 4, '신체', '조금만 맞아도 휘청인다.', { hp: -0.13 }),
  N('low_stamina', '저질 체력', 4, '신체', '금방 숨이 찬다.', { energy: -0.2 }),
  N('feeble', '근력 부족', 3, '신체', '무거운 짐은 버겁다. (가방으로 보완)', { carry: -3 }),
  N('sluggish', '둔한 움직임', 3, '신체', '피하는 게 늦다.', { dodge: -0.1, flee: -0.05 }),
  N('sore_muscles', '잦은 근육통', 2, '신체', '밖에서 오래 움직이면 몸이 쑤신다.', { energy: -0.1 }, { when: 'expedition', negate: { effect: 'painkiller', text: '진통제를 먹으면 괜찮다' } }),
  N('slow_heal', '느린 회복', 4, '신체', '상처가 잘 낫지 않는다.', { heal: -0.25, regen: -0.2 }),
  // ───── 부정: 감각
  N('myopia', '근시', 2, '감각', '멀리 있는 게 흐릿하다.', { loot: -0.15 }, { negate: { item: 'glasses', text: '안경을 챙기면 괜찮다' } }),
  N('astigmatism', '난시', 2, '감각', '조준선이 번져 보인다.', { firearm: -0.1 }, { negate: { item: 'glasses', text: '안경을 챙기면 괜찮다' } }),
  N('hard_hearing', '청력 저하', 3, '감각', '다가오는 소리를 늦게 듣는다.', { detect: -0.15 }),
  N('dull_nose', '후각 둔감', 1, '감각', '상한 음식을 모르고 먹는다.', { sick: -0.3 }),
  N('no_direction', '방향치', 2, '감각', '자주 길을 돌아간다.', { travel: -0.1 }),
  N('night_blind', '야맹증', 3, '감각', '어두워지면 앞이 잘 안 보인다.', { hit: -0.1, flee: -0.1, loot: -0.1 }, { when: 'night', negate: { item: 'flashlight', text: '손전등을 챙기면 괜찮다' } }),
  // ───── 부정: 건강
  N('weak_immune', '약한 면역력', 3, '건강', '감기를 달고 산다.', { sick: -0.4, infect: -0.15 }),
  N('allergy', '알레르기 체질', 2, '건강', '먼지만 마셔도 콧물이 난다.', { energy: -0.15, hit: -0.05 }, { when: 'dusty', negate: { item: 'gas_mask', text: '방독면을 쓰면 괜찮다' } }),
  N('chronic_pain', '만성 통증', 3, '건강', '오래 움직이면 통증이 올라온다.', { energy: -0.1, hit: -0.03 }, { when: 'expedition', negate: { effect: 'painkiller', text: '진통제를 먹으면 괜찮다' } }),
  N('weak_stomach', '약한 위장', 2, '건강', '조금만 상한 걸 먹어도 탈이 난다.', { sick: -0.5 }),
  N('anemia', '빈혈 경향', 2, '건강', '피를 흘리면 금방 어지럽다.', { energy: -0.25 }, { when: 'bleeding' }),
  N('cold_sensitive', '추위 민감', 2, '건강', '추위를 많이 탄다. (난방·상의로 보완)', { energy: -0.2 }, { when: 'cold' }),
  // ───── 부정: 생활 습관
  N('glutton', '대식가', 3, '생활', '늘 배가 고프다.', { hunger: -0.4 }),
  N('big_drinker', '물을 많이 마심', 2, '생활', '금방 목이 마르다.', { thirst: -0.35 }),
  N('sleepyhead', '잠이 많음', 3, '생활', '늘 졸리다.', { energy: -0.1 }),
  N('insomniac', '불면증', 4, '생활', '잠들기가 어렵다.', { sleep: -0.3 }),
  N('light_sleeper', '잠귀가 밝음', 2, '생활', '작은 소리에도 깬다. (내 침대가 있는 조용한 자리면 괜찮다)', { sleep: -0.15 }, { negate: { ownBed: true, text: '자기 침대(가구 소유자 지정)가 있으면 괜찮다' } }),
  N('slow_eater', '느린 식사', 1, '생활', '먹는 둥 마는 둥 해서 금방 배가 꺼진다.', { hunger: -0.08 }),
  // ───── 부정: 심리
  N('coward', '겁이 많음', 4, '심리', '좀비를 보면 몸이 굳는다. (성격이 아니라 긴장 수치만 바뀐다)', { nerve: -0.25 }),
  N('hemophobia', '피 공포증', 3, '심리', '피를 보면 손이 떨린다.', { nerve: -0.3, hit: -0.05 }, { when: 'bleeding' }),
  N('claustro', '폐소공포 반응', 2, '심리', '좁고 어두운 곳이 힘들다.', { nerve: -0.2, loot: -0.05 }, { when: 'dark' }),
  N('acro', '고소공포 반응', 2, '심리', '높은 곳 경계 근무가 서툴다.', { defense: -1 }),
  N('jittery', '쉽게 긴장함', 2, '심리', '위험한 곳에서 실수가 잦다.', { hit: -0.04, flee: -0.04 }, { when: 'expedition' }),
  N('fragile_mind', '스트레스 취약', 3, '심리', '나쁜 일이 오래 남는다.', { nerve: -0.2 }),
  // ───── 부정: 전투
  N('combat_novice', '전투 미숙', 3, '전투', '싸움은 해 본 적이 없다.', { melee: -0.06 }),
  N('gun_novice', '사격 미숙', 2, '전투', '총은 무섭다.', { firearm: -0.1 }),
  N('slow_react', '느린 반응', 3, '전투', '기습에 대처가 늦다.', { detect: -0.15 }),
  N('weak_grip', '약한 악력', 2, '전투', '무기가 손에서 미끄러진다.', { melee: -0.05, shove: -0.1 }),
  N('careless_weapon', '무기 관리 미숙', 2, '전투', '무기를 험하게 쓴다.', { wear: -0.25 }),
  N('noise_shy', '소음에 취약', 2, '전투', '총소리에 움찔한다.', { nerve: -0.1, firearm: -0.03 }),
  // ───── 부정: 탐험
  N('clumsy', '덤벙댐', 3, '탐험', '뭔가를 자꾸 떨어뜨린다.', { noise: -0.3 }),
  N('unobservant', '눈썰미 부족', 2, '탐험', '숨은 걸 잘 못 찾는다.', { secret: -0.15, loot: -0.05 }),
  N('messy_pack', '짐 정리 미숙', 2, '탐험', '가방이 늘 엉망이다.', { carry: -2 }),
  N('slow_walker', '느린 걸음', 3, '탐험', '걸음이 느리다.', { travel: -0.15 }),
  N('indoor_type', '야외 경험 부족', 2, '탐험', '바깥 생활이 낯설다.', { energy: -0.1 }, { when: 'expedition' }),
  N('lost_easily', '길치', 3, '탐험', '처음 가는 곳은 한참 헤맨다.', { travel: -0.25 }, { when: 'firstVisit' }),
  // ───── 부정: 기술
  N('butterfingers', '손재주 부족', 3, '기술', '재료를 망치기 일쑤다.', { craftSave: -0.1, xpSkill: { crafting: -0.2 } }),
  N('mech_inept', '기계치', 3, '기술', '기계만 보면 머리가 아프다.', { xpSkill: { crafting: -0.2 }, wear: -0.1 }),
  N('bad_cook', '요리치', 2, '기술', '뭘 해도 맛이 없다.', { xpSkill: { cooking: -0.3 } }),
  N('poor_builder', '서투른 건축', 2, '기술', '못질하다 나무를 쪼갠다.', { craftSave: -0.1 }),
  N('tech_inept', '전자기기 미숙', 2, '기술', '버튼이 많으면 겁이 난다.', { xpSkill: { crafting: -0.15 } }),
  N('repair_novice', '수리 초보', 2, '기술', '고친다는 게 더 망가뜨린다.', { wear: -0.15 }),
  // ───── 부정: 사회
  N('bad_negotiator', '협상 미숙', 2, '사회', '흥정에 늘 진다.', { trade: -0.25 }),
  N('paperwork_bad', '서류 작업 미숙', 1, '사회', '글씨가 빽빽하면 졸린다.', { clue: -0.15 }),
  N('untidy', '정리정돈 미숙', 2, '사회', '물건을 아무 데나 둔다.', { facility: -0.08 }),
  N('bad_map', '지도 읽기 미숙', 2, '사회', '지도를 거꾸로 든다.', { travel: -0.06, clue: -0.05 }),
  N('bad_leader', '작업 지시 미숙', 2, '사회', '같이 일하면 손발이 안 맞는다.', { facility: -0.05, defense: -0.5 }),
  N('slow_adapt', '느린 적응', 2, '사회', '새로운 일에 익숙해지는 데 오래 걸린다.', { xp: -0.1 }),
  // ───── 부정: 환경
  N('heat_sensitive', '더위 민감', 2, '환경', '더위를 먹는다. (물을 자주 마시자)', { energy: -0.2, thirst: -0.2 }, { when: 'hot' }),
  N('rain_weak', '비에 취약', 2, '환경', '젖으면 컨디션이 무너진다. (불 앞에서 말리자)', { energy: -0.2, hit: -0.05 }, { when: 'wet' }),
  N('cold_hands', '추운 손발', 2, '환경', '추우면 손이 굳는다. (난방·상의로 보완)', { hit: -0.08 }, { when: 'cold' }),
  N('dust_sensitive', '먼지 민감', 2, '환경', '먼지 많은 곳에서 금방 지친다.', { energy: -0.2 }, { when: 'dusty', negate: { item: 'gas_mask', text: '방독면을 쓰면 괜찮다' } }),
  N('carsick', '멀미', 2, '환경', '차를 오래 타면 속이 뒤집힌다.', { carsick: 1 }),
  N('poor_sleeper_env', '나쁜 수면 환경 적응력', 2, '환경', '침낭이나 맨바닥에서는 잠을 설친다. (좋은 침대로 보완)', { sleep: -0.3 }, { when: 'poorBed' }),

  // ───── 성장형 (조건을 채우면 오너가 받을지 고른다)
  E('veteran', '베테랑', '좀비 50마리 처치', '수많은 싸움이 몸에 배었다.', { hit: 0.05, nerve: 0.1 }),
  E('iron_will', '강철 멘탈', '트라우마 3번 극복', '무너졌다가 다시 일어선 사람.', { nerve: 0.3 }),
  E('scarred', '상처투성이', '3번 쓰러졌다 일어남', '몸이 아픔을 기억한다.', { hp: 0.06 }),
  E('seasoned_scav', '노련한 수색꾼', '탐험 20번', '어디를 뒤져야 할지 안다.', { loot: 0.08, noise: 0.1 }),
  E('survivor', '생존 본능', '캐릭터로 30일 생존', '위험을 먼저 느낀다.', { detect: 0.1, energy: 0.05 }),
  E('anchor', '마음의 버팀목', '호감 60 이상인 사람 3명', '곁에 있으면 든든한 사람.', { bond: 0.2, nerve: 0.05 }),
  E('master_crafter', '장인', '물건 50개 제작', '손에 익은 만큼 아낀다.', { craftSave: 0.12 }),
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/** 같이 고를 수 없는 특성 */
const EXCL: [string, string][] = [
  ['strong', 'weak'], ['fast_heal', 'slow_heal'], ['endurance', 'low_stamina'], ['mighty', 'feeble'], ['agile', 'sluggish'],
  ['sharp_eye', 'myopia'], ['keen_ear', 'hard_hearing'], ['keen_nose', 'dull_nose'], ['sense_dir', 'no_direction'], ['night_vision', 'night_blind'],
  ['hardy', 'weak_immune'], ['calm', 'coward'], ['stress_resist', 'fragile_mind'], ['reflexes', 'slow_react'], ['steady_aim', 'gun_novice'],
  ['gun_talent', 'gun_novice'], ['melee_trained', 'combat_novice'], ['weapon_care', 'careless_weapon'], ['quiet_step', 'clumsy'], ['observant', 'unobservant'],
  ['packer', 'messy_pack'], ['swift', 'slow_walker'], ['pathfinder', 'lost_easily'], ['dexterous', 'butterfingers'], ['cook_sense', 'bad_cook'],
  ['negotiator', 'bad_negotiator'], ['trader', 'bad_negotiator'], ['fast_learner', 'slow_adapt'], ['quick_fix', 'repair_novice'], ['outdoorsy', 'indoor_type'],
  ['hardy', 'weak_stomach'], ['keen_nose', 'weak_stomach'], ['material_saver', 'butterfingers'], ['mech_mind', 'mech_inept'], ['supply_mgr', 'untidy'],
  ['organizer', 'bad_leader'], ['sense_dir', 'lost_easily'], ['sense_dir', 'bad_map'], ['insomniac', 'sleepyhead'],
];
export function exclusive(a: string, b: string): boolean {
  return EXCL.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** 특성으로 쓸 수 있는 최대 개수 */
export const MAX_TRAITS = 10;
