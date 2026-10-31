import type { ItemCategory, SkillId } from '../types';

export interface WeaponStats {
  damage: [number, number];
  /** 명중 보정 (0.0 ~ 0.3) */
  acc: number;
  /** 공격 1회당 소음 */
  noise: number;
  /** 공격 1회당 내구도 감소 */
  wear: number;
  skill: Extract<SkillId, 'melee' | 'firearm'>;
  ammo?: string;
  /** 밀치기 보너스 */
  push?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  weight: number;
  icon: string;
  desc: string;
  /** 소비 시 효과 */
  consume?: {
    hunger?: number;
    thirst?: number;
    energy?: number;
    health?: number;
    infection?: number;
    /** 소비 후 남는 아이템 */
    leaves?: string;
    sick?: number; // 식중독 위험(0~1)
  };
  /** 의료: 부상 치료 */
  treat?: 'bandage' | 'disinfect';
  weapon?: WeaponStats;
  durability?: number;
  backpack?: number;
  /** 도구 태그 (잠금 해제 / 제작 요구 조건) */
  tags?: string[];
  rarity?: 1 | 2 | 3;
}

const I = (d: ItemDef) => d;

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // ── 음식 ──
    I({ id: 'canned_beans', name: '콩 통조림', category: 'food', weight: 0.6, icon: '🥫', desc: '오래 보관되는 기본 식량.', consume: { hunger: 30, thirst: -3, leaves: 'empty_can' } }),
    I({ id: 'canned_tuna', name: '참치 통조림', category: 'food', weight: 0.4, icon: '🐟', desc: '단백질 보충에 좋다.', consume: { hunger: 25, leaves: 'empty_can' } }),
    I({ id: 'chips', name: '감자칩', category: 'food', weight: 0.2, icon: '🍟', desc: '짜다. 목이 마르다.', consume: { hunger: 12, thirst: -6, energy: 3 } }),
    I({ id: 'chocolate', name: '초콜릿', category: 'food', weight: 0.1, icon: '🍫', desc: '기운이 조금 난다.', consume: { hunger: 8, energy: 10 } }),
    I({ id: 'rice', name: '쌀 봉지', category: 'food', weight: 1, icon: '🍚', desc: '그대로는 먹기 힘들다. 요리 재료.' }),
    I({ id: 'vegetable', name: '신선한 채소', category: 'food', weight: 0.3, icon: '🥬', desc: '텃밭에서 기른 채소.', consume: { hunger: 10, thirst: 4 } }),
    I({ id: 'raw_meat', name: '생고기', category: 'food', weight: 0.5, icon: '🥩', desc: '익히지 않으면 위험하다.', consume: { hunger: 15, sick: 0.5 } }),
    I({ id: 'stew', name: '따뜻한 스튜', category: 'food', weight: 0.8, icon: '🍲', desc: '배부르고 든든하다.', consume: { hunger: 55, thirst: 10, energy: 8, health: 3 } }),
    I({ id: 'rice_bowl', name: '채소 비빔밥', category: 'food', weight: 0.6, icon: '🍱', desc: '오랜만의 제대로 된 식사.', consume: { hunger: 50, energy: 5, health: 2 } }),
    I({ id: 'grilled_meat', name: '구운 고기', category: 'food', weight: 0.4, icon: '🍖', desc: '잘 익었다.', consume: { hunger: 35, energy: 5 } }),
    I({ id: 'roasted_veg', name: '구운 채소', category: 'food', weight: 0.3, icon: '🥗', desc: '따뜻한 한 접시.', consume: { hunger: 22, thirst: 4 } }),
    // ── 음료 ──
    I({ id: 'water_bottle', name: '생수', category: 'drink', weight: 0.5, icon: '💧', desc: '깨끗한 물.', consume: { thirst: 40, leaves: 'empty_bottle' } }),
    I({ id: 'soda', name: '탄산음료', category: 'drink', weight: 0.4, icon: '🥤', desc: '달고 시원하다.', consume: { thirst: 25, energy: 5 } }),
    I({ id: 'dirty_water', name: '더러운 물', category: 'drink', weight: 0.5, icon: '🫗', desc: '끓이지 않으면 배탈 날 수 있다.', consume: { thirst: 35, sick: 0.35, leaves: 'empty_bottle' } }),
    I({ id: 'boiled_water', name: '끓인 물', category: 'drink', weight: 0.5, icon: '🫖', desc: '끓여서 안전한 물.', consume: { thirst: 40, leaves: 'empty_bottle' } }),
    I({ id: 'coffee', name: '인스턴트 커피', category: 'drink', weight: 0.1, icon: '☕', desc: '잠이 깬다.', consume: { thirst: 5, energy: 20 } }),
    // ── 의료 ──
    I({ id: 'bandage', name: '붕대', category: 'medical', weight: 0.1, icon: '🩹', desc: '상처의 출혈을 막는다.', treat: 'bandage' }),
    I({ id: 'disinfectant', name: '소독약', category: 'medical', weight: 0.2, icon: '🧴', desc: '상처 감염을 줄인다.', treat: 'disinfect', consume: { infection: -12 } }),
    I({ id: 'painkiller', name: '진통제', category: 'medical', weight: 0.05, icon: '💊', desc: '통증을 덜어준다.', consume: { energy: 10, health: 5 } }),
    I({ id: 'antibiotics', name: '항생제', category: 'medical', weight: 0.05, icon: '💉', desc: '감염 진행을 크게 늦춘다.', consume: { infection: -25, health: 3 }, rarity: 2 }),
    I({ id: 'first_aid', name: '구급상자', category: 'medical', weight: 0.8, icon: '🧰', desc: '여러 의료품이 들어 있다.', consume: { health: 25, infection: -5 }, rarity: 2 }),
    // ── 무기 ──
    I({ id: 'bat', name: '야구방망이', category: 'weapon', weight: 1.2, icon: '🏏', desc: '튼튼한 둔기.', durability: 40, weapon: { damage: [1, 2], acc: 0.1, noise: 3, wear: 1, skill: 'melee', push: 0.1 } }),
    I({ id: 'nail_bat', name: '못 박힌 방망이', category: 'weapon', weight: 1.4, icon: '🔨', desc: '직접 만든 흉악한 둔기.', durability: 45, weapon: { damage: [2, 3], acc: 0.08, noise: 3, wear: 1, skill: 'melee', push: 0.1 } }),
    I({ id: 'kitchen_knife', name: '식칼', category: 'weapon', weight: 0.3, icon: '🔪', desc: '가볍고 조용하지만 쉽게 무뎌진다.', durability: 20, weapon: { damage: [1, 2], acc: 0.15, noise: 1, wear: 1, skill: 'melee' } }),
    I({ id: 'pipe', name: '쇠파이프', category: 'weapon', weight: 1.8, icon: '🪈', desc: '무겁지만 오래 버틴다.', durability: 70, weapon: { damage: [1, 3], acc: 0.02, noise: 4, wear: 1, skill: 'melee', push: 0.15 } }),
    I({ id: 'fire_axe', name: '소방 도끼', category: 'weapon', weight: 2.5, icon: '🪓', desc: '강력하다. 휘두르면 지친다.', durability: 60, weapon: { damage: [2, 4], acc: 0.0, noise: 4, wear: 1, skill: 'melee' }, tags: ['axe'], rarity: 2 }),
    I({ id: 'spear', name: '수제 창', category: 'weapon', weight: 1.2, icon: '🗡️', desc: '거리를 두고 싸울 수 있다.', durability: 30, weapon: { damage: [1, 3], acc: 0.12, noise: 2, wear: 1, skill: 'melee', push: 0.2 } }),
    I({ id: 'pistol', name: '권총', category: 'weapon', weight: 1, icon: '🔫', desc: '확실하지만 시끄럽다. 9mm 탄 사용.', durability: 120, weapon: { damage: [3, 5], acc: 0.2, noise: 30, wear: 1, skill: 'firearm', ammo: 'ammo_9mm' }, rarity: 2 }),
    I({ id: 'ammo_9mm', name: '9mm 탄', category: 'material', weight: 0.02, icon: '🟡', desc: '권총 탄약.', rarity: 2 }),
    // ── 도구 ──
    I({ id: 'crowbar', name: '쇠지렛대', category: 'tool', weight: 1.5, icon: '🔧', desc: '잠긴 문을 강제로 연다(시끄러움). 무기로도 쓸 수 있다.', durability: 50, weapon: { damage: [1, 2], acc: 0.05, noise: 3, wear: 1, skill: 'melee', push: 0.1 }, tags: ['pry'] }),
    I({ id: 'lockpick', name: '자물쇠 따개', category: 'tool', weight: 0.05, icon: '🗝️', desc: '조용히 자물쇠를 연다. 실패하면 부러진다.', tags: ['lockpick'] }),
    I({ id: 'hammer', name: '망치', category: 'tool', weight: 0.8, icon: '🔨', desc: '건축과 제작에 필요하다.', durability: 80, weapon: { damage: [1, 2], acc: 0.05, noise: 3, wear: 1, skill: 'melee' }, tags: ['hammer'] }),
    I({ id: 'saw', name: '톱', category: 'tool', weight: 0.7, icon: '🪚', desc: '목재 가공에 필요하다.', tags: ['saw'] }),
    I({ id: 'screwdriver', name: '드라이버', category: 'tool', weight: 0.2, icon: '🪛', desc: '전자기기 분해에 쓴다.', tags: ['screwdriver'] }),
    I({ id: 'flashlight', name: '손전등', category: 'tool', weight: 0.3, icon: '🔦', desc: '어두운 곳을 수색할 때 유리하다.', tags: ['light'] }),
    I({ id: 'lighter', name: '라이터', category: 'tool', weight: 0.05, icon: '🔥', desc: '불을 피운다.', tags: ['fire'] }),
    I({ id: 'duct_tape', name: '덕트 테이프', category: 'material', weight: 0.2, icon: '🧻', desc: '무엇이든 고친다. 무기 수리에 쓴다.' }),
    // ── 재료 ──
    I({ id: 'plank', name: '나무 판자', category: 'material', weight: 1, icon: '🪵', desc: '건축과 가구 제작의 기본 재료.' }),
    I({ id: 'nails', name: '못', category: 'material', weight: 0.05, icon: '📌', desc: '판자를 고정한다.' }),
    I({ id: 'scrap', name: '고철', category: 'material', weight: 0.8, icon: '⚙️', desc: '금속 부품.' }),
    I({ id: 'cloth', name: '천 조각', category: 'material', weight: 0.1, icon: '🧵', desc: '붕대, 의류, 장식 재료.' }),
    I({ id: 'plastic', name: '플라스틱', category: 'material', weight: 0.2, icon: '🧪', desc: '통이나 관을 만든다.' }),
    I({ id: 'wire', name: '전선', category: 'material', weight: 0.2, icon: '➰', desc: '전기 설비 재료.' }),
    I({ id: 'electronics', name: '전자 부품', category: 'material', weight: 0.2, icon: '📟', desc: '고급 장비 재료.', rarity: 2 }),
    I({ id: 'battery', name: '배터리', category: 'material', weight: 0.1, icon: '🔋', desc: '조명과 기기에 쓴다.' }),
    I({ id: 'dirt_bag', name: '흙 포대', category: 'material', weight: 3, icon: '🟫', desc: '텃밭에 쓰는 흙.' }),
    I({ id: 'seeds', name: '채소 씨앗', category: 'material', weight: 0.05, icon: '🌱', desc: '텃밭 상자에 심는다.' }),
    I({ id: 'gas_can', name: '부탄가스', category: 'material', weight: 0.4, icon: '🧯', desc: '캠핑 스토브 연료.' }),
    I({ id: 'wallpaper_roll', name: '벽지 롤', category: 'material', weight: 0.5, icon: '📜', desc: '벽을 꾸민다.' }),
    I({ id: 'tile_pack', name: '바닥 타일', category: 'material', weight: 1, icon: '🔲', desc: '바닥을 깐다.' }),
    I({ id: 'empty_can', name: '빈 깡통', category: 'material', weight: 0.1, icon: '🥫', desc: '고철 대용, 소음 함정 재료.' }),
    I({ id: 'empty_bottle', name: '빈 페트병', category: 'material', weight: 0.05, icon: '🍶', desc: '물을 담을 수 있다.' }),
    // ── 가방 ──
    I({ id: 'school_bag', name: '책가방', category: 'backpack', weight: 0.5, icon: '🎒', desc: '휴대 무게 +6', backpack: 6 }),
    I({ id: 'hiking_pack', name: '등산 배낭', category: 'backpack', weight: 1, icon: '🎒', desc: '휴대 무게 +14', backpack: 14, rarity: 2 }),
    // ── 희귀 / 정보 ──
    I({ id: 'area_map', name: '지역 지도', category: 'rare', weight: 0.1, icon: '🗺️', desc: '사용하면 새로운 탐험지를 표시한다.' }),
    I({ id: 'lab_keycard', name: '연구소 출입카드', category: 'rare', weight: 0.02, icon: '💳', desc: '외곽 연구소의 보안문을 연다.', rarity: 3 }),
    I({ id: 'research_notes', name: '연구 자료', category: 'rare', weight: 0.2, icon: '📑', desc: '감염에 관한 기록. 언젠가 연구에 쓸 수 있을지도.', rarity: 3 }),
    I({ id: 'ration_pack', name: '군용 전투식량', category: 'food', weight: 0.5, icon: '🎖️', desc: '보급 투하 물자.', consume: { hunger: 45, thirst: 5, energy: 10 }, rarity: 2 }),
    // ── 가구 (배치 가능) ──
    I({ id: 'f_mattress', name: '매트리스', category: 'furniture', weight: 6, icon: '🛏️', desc: '바닥에 까는 잠자리.' }),
    I({ id: 'f_bed', name: '침대', category: 'furniture', weight: 12, icon: '🛏️', desc: '편안한 잠자리. 개인 방에 두자.' }),
    I({ id: 'f_chair', name: '의자', category: 'furniture', weight: 3, icon: '🪑', desc: '앉을 수 있다.' }),
    I({ id: 'f_table', name: '나무 식탁', category: 'furniture', weight: 8, icon: '🟫', desc: '소품을 올려둘 수 있다.' }),
    I({ id: 'f_desk', name: '책상', category: 'furniture', weight: 8, icon: '🗄️', desc: '소품을 올려둘 수 있다.' }),
    I({ id: 'f_sofa', name: '소파', category: 'furniture', weight: 14, icon: '🛋️', desc: '거실의 중심.' }),
    I({ id: 'f_shelf', name: '선반', category: 'furniture', weight: 6, icon: '📚', desc: '물건을 진열할 수 있다.' }),
    I({ id: 'f_wardrobe', name: '옷장', category: 'furniture', weight: 14, icon: '🚪', desc: '개인 수납공간.' }),
    I({ id: 'f_crate', name: '수납 상자', category: 'furniture', weight: 4, icon: '📦', desc: '공동 창고 정리용 상자.' }),
    I({ id: 'f_rug', name: '러그', category: 'furniture', weight: 2, icon: '🟥', desc: '바닥에 까는 깔개. 다른 가구 아래 둘 수 있다.' }),
    I({ id: 'f_plant', name: '화분', category: 'furniture', weight: 2, icon: '🪴', desc: '초록이 있으면 마음이 편하다.' }),
    I({ id: 'f_lamp', name: '스탠드 조명', category: 'furniture', weight: 2, icon: '💡', desc: '밤에 주변을 밝힌다.' }),
    I({ id: 'f_tv', name: '고장난 TV', category: 'furniture', weight: 8, icon: '📺', desc: '나오진 않지만 분위기는 난다.' }),
    I({ id: 'f_workbench', name: '작업대', category: 'furniture', weight: 15, icon: '🛠️', desc: '가구와 도구 제작에 필요하다.' }),
    I({ id: 'f_stove', name: '캠핑 스토브', category: 'furniture', weight: 4, icon: '🍳', desc: '요리와 물 끓이기에 필요하다.' }),
    I({ id: 'f_medcab', name: '의료 캐비닛', category: 'furniture', weight: 7, icon: '🏥', desc: '치료 효과가 좋아지고 의료품 제작이 가능하다.' }),
    I({ id: 'f_rain', name: '빗물 수집통', category: 'furniture', weight: 5, icon: '🛢️', desc: '시간이 지나면 더러운 물이 고인다. (실시간 생산)' }),
    I({ id: 'f_planter', name: '텃밭 상자', category: 'furniture', weight: 10, icon: '🌿', desc: '씨앗을 심으면 채소가 자란다. (실시간 생산)' }),
    I({ id: 'f_barricade', name: '바리케이드', category: 'furniture', weight: 10, icon: '🚧', desc: '거점 방어 시설.' }),
    // ── 소품 (가구 위에 올리는 장식) ──
    I({ id: 'p_mug', name: '머그컵', category: 'prop', weight: 0.3, icon: '☕', desc: '책상 위 소품.' }),
    I({ id: 'p_teddy', name: '곰인형', category: 'prop', weight: 0.3, icon: '🧸', desc: '누군가의 소중한 물건이었을 것이다.' }),
    I({ id: 'p_photo', name: '사진 액자', category: 'prop', weight: 0.3, icon: '🖼️', desc: '낯선 가족의 사진.' }),
    I({ id: 'p_candle', name: '양초', category: 'prop', weight: 0.1, icon: '🕯️', desc: '작은 불빛.' }),
    I({ id: 'p_book', name: '소설책', category: 'prop', weight: 0.4, icon: '📕', desc: '읽을거리.' }),
    I({ id: 'p_radio', name: '라디오', category: 'prop', weight: 0.6, icon: '📻', desc: '가끔 잡음이 들린다.' }),
    I({ id: 'p_vase', name: '꽃병', category: 'prop', weight: 0.5, icon: '🏺', desc: '장식용.' }),
    I({ id: 'p_gameboy', name: '휴대용 게임기', category: 'prop', weight: 0.2, icon: '🎮', desc: '배터리가 있으면…', rarity: 2 }),
    I({ id: 'p_globe', name: '지구본', category: 'prop', weight: 0.8, icon: '🌐', desc: '학교에서 가져왔다.' }),
  ].map((d) => [d.id, d]),
);

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`알 수 없는 아이템: ${id}`);
  return d;
}

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  food: '음식',
  drink: '음료',
  medical: '의료',
  weapon: '무기',
  tool: '도구',
  material: '재료',
  furniture: '가구',
  prop: '소품',
  backpack: '가방',
  rare: '희귀',
};
