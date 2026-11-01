import type { ItemCategory, SkillId, WearSlot } from '../types';
import type { Mods } from './traits';
import { PACK_ITEMS } from './packItems';

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
  /** 방패: 좀비에게 맞을 확률 감소 */
  block?: number;
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
  /** 착용 장비: 칸과 방어율(0~1, 막을 확률) */
  wear?: { slot: WearSlot; protect: number };
  /** 도구 태그 (잠금 해제 / 제작 요구 조건) */
  tags?: string[];
  rarity?: 1 | 2 | 3;
  /** 이동수단: 속도 배수, 더 실을 수 있는 무게, 소음, 왕복 연료(기름통) */
  vehicle?: { speed: number; carry: number; noise: number; fuel?: number };
  /** 옷의 보온 (한파 때 합이 2 이상이면 춥지 않다) */
  warm?: number;
  /** 입으면 비에 젖지 않는다 */
  rainproof?: boolean;
  /** 소지품에 있으면 붙는 효과 */
  carry?: Mods;
  /** 읽을거리: 숙련 경험치 / 기분 전환 (읽어도 남는다) */
  read?: { skill?: SkillId; fun?: boolean };
  /** 씨앗: 심으면 거두는 작물 */
  seed?: string;
  /** 상하기까지 걸리는 시간(게임 시간). 없으면 상하지 않는다 */
  spoil?: number;
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
    I({ id: 'gasoline', name: '휘발유 통', category: 'material', weight: 2, icon: '⛽', desc: '스쿠터·자동차 연료. 왕복 한 번에 한 통.' }),
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
    // ── 구역 확장 물품 ──
    I({ id: 'instant_noodles', name: '컵라면', category: 'food', weight: 0.15, icon: '🍜', desc: '끓인 물이 있으면 더 맛있다.', consume: { hunger: 14, thirst: -4 } }),
    I({ id: 'ramen', name: '끓인 라면', category: 'food', weight: 0.4, icon: '🍜', desc: '뜨끈한 국물.', consume: { hunger: 35, thirst: 8, energy: 6 } }),
    I({ id: 'cereal', name: '시리얼', category: 'food', weight: 0.4, icon: '🥣', desc: '바삭하다.', consume: { hunger: 16 } }),
    I({ id: 'canned_fruit', name: '과일 통조림', category: 'food', weight: 0.5, icon: '🍑', desc: '달콤한 시럽.', consume: { hunger: 18, thirst: 10, leaves: 'empty_can' } }),
    I({ id: 'honey', name: '꿀단지', category: 'food', weight: 0.4, icon: '🍯', desc: '썩지 않는다.', consume: { hunger: 12, energy: 12 } }),
    I({ id: 'energy_bar', name: '에너지바', category: 'food', weight: 0.08, icon: '🍫', desc: '가볍고 든든하다.', consume: { hunger: 15, energy: 8 } }),
    I({ id: 'berries', name: '야생 열매', category: 'food', weight: 0.1, icon: '🫐', desc: '숲에서 딴 열매.', consume: { hunger: 8, thirst: 4 } }),
    I({ id: 'fish', name: '생선', category: 'food', weight: 0.6, icon: '🐟', desc: '익혀 먹자.', consume: { hunger: 14, sick: 0.4 } }),
    I({ id: 'grilled_fish', name: '생선구이', category: 'food', weight: 0.5, icon: '🐠', desc: '고소하다.', consume: { hunger: 32, energy: 4 } }),
    I({ id: 'juice', name: '주스', category: 'drink', weight: 0.4, icon: '🧃', desc: '달다.', consume: { thirst: 28, hunger: 4 } }),
    I({ id: 'sports_drink', name: '스포츠 음료', category: 'drink', weight: 0.5, icon: '🥤', desc: '갈증과 피로를 푼다.', consume: { thirst: 35, energy: 8, leaves: 'empty_bottle' } }),
    I({ id: 'herbs', name: '약초', category: 'medical', weight: 0.05, icon: '🌿', desc: '상처에 붙이면 염증이 가라앉는다.', consume: { infection: -5, health: 2 } }),
    I({ id: 'machete', name: '마체테', category: 'weapon', weight: 1, icon: '🗡️', desc: '수풀을 헤치는 큰 칼.', durability: 45, weapon: { damage: [2, 3], acc: 0.1, noise: 2, wear: 1, skill: 'melee' } }),
    I({ id: 'military_knife', name: '군용 나이프', category: 'weapon', weight: 0.3, icon: '🔪', desc: '튼튼하고 조용하다.', durability: 60, weapon: { damage: [1, 3], acc: 0.18, noise: 1, wear: 1, skill: 'melee' }, rarity: 2 }),
    I({ id: 'golf_club', name: '골프채', category: 'weapon', weight: 0.8, icon: '🏌️', desc: '휘두르기 좋다.', durability: 30, weapon: { damage: [1, 2], acc: 0.08, noise: 3, wear: 1, skill: 'melee' } }),
    I({ id: 'wrench', name: '렌치', category: 'tool', weight: 0.9, icon: '🔧', desc: '정비 도구. 둔기로도 쓴다.', durability: 70, weapon: { damage: [1, 2], acc: 0.05, noise: 3, wear: 1, skill: 'melee' }, tags: ['wrench'] }),
    I({ id: 'shotgun', name: '산탄총', category: 'weapon', weight: 3, icon: '🔫', desc: '한 방에 여럿을 쓰러뜨리지만 엄청나게 시끄럽다.', durability: 100, weapon: { damage: [4, 6], acc: 0.25, noise: 45, wear: 1, skill: 'firearm', ammo: 'ammo_shell' }, rarity: 3 }),
    I({ id: 'ammo_shell', name: '산탄', category: 'material', weight: 0.05, icon: '🔴', desc: '산탄총 탄약.', rarity: 2 }),
    I({ id: 'fishing_rod', name: '낚싯대', category: 'tool', weight: 0.8, icon: '🎣', desc: '물가(🌊 표시) 탐험지에서 낚시할 수 있다. 소지품에 챙겨 가자.', tags: ['fishing'], durability: 30 }),
    I({ id: 'bait', name: '미끼', category: 'material', weight: 0.05, icon: '🪱', desc: '낚시할 때 쓰면 더 잘 잡히고 큰 놈이 문다.' }),
    I({ id: 'fertilizer', name: '비료', category: 'material', weight: 1.5, icon: '🧪', desc: '흙과 섞어 텃밭 흙을 만든다.' }),
    I({ id: 'walkie_talkie', name: '무전기', category: 'prop', weight: 0.4, icon: '📻', desc: '지직거리는 잡음 사이로 누군가의 목소리가…', rarity: 2 }),
    // ── 의류 (착용 장비) ──
    I({ id: 'w_cap', name: '야구모자', category: 'clothing', weight: 0.1, icon: '🧢', desc: '햇빛을 가린다.', durability: 20, wear: { slot: 'hat', protect: 0.05 } }),
    I({ id: 'w_beanie', name: '비니', category: 'clothing', weight: 0.1, icon: '🧶', desc: '머리가 따뜻하다.', durability: 20, wear: { slot: 'hat', protect: 0.06 } }),
    I({ id: 'w_moto_helmet', name: '오토바이 헬멧', category: 'clothing', weight: 1.2, icon: '⛑️', desc: '머리를 단단히 지킨다.', durability: 60, wear: { slot: 'hat', protect: 0.4 }, rarity: 2 }),
    I({ id: 'w_army_helmet', name: '군용 헬멧', category: 'clothing', weight: 1.4, icon: '🪖', desc: '물림도 막아준다.', durability: 80, wear: { slot: 'hat', protect: 0.45 }, rarity: 2 }),
    I({ id: 'w_tshirt', name: '티셔츠', category: 'clothing', weight: 0.2, icon: '👕', desc: '얇은 면 티셔츠.', durability: 15, wear: { slot: 'top', protect: 0.04 } }),
    I({ id: 'w_hoodie', name: '후드티', category: 'clothing', weight: 0.5, icon: '🧥', desc: '두툼한 후드티.', durability: 25, wear: { slot: 'top', protect: 0.1 } }),
    I({ id: 'w_leather_jacket', name: '가죽 재킷', category: 'clothing', weight: 1.2, icon: '🧥', desc: '이빨이 잘 안 들어간다.', durability: 50, wear: { slot: 'top', protect: 0.28 }, rarity: 2 }),
    I({ id: 'w_firecoat', name: '방화복 상의', category: 'clothing', weight: 2, icon: '🦺', desc: '소방관의 두꺼운 방화복.', durability: 70, wear: { slot: 'top', protect: 0.35 }, rarity: 2 }),
    I({ id: 'w_army_top', name: '군용 전투복 상의', category: 'clothing', weight: 1.2, icon: '🥋', desc: '질기고 튼튼하다.', durability: 60, wear: { slot: 'top', protect: 0.3 }, rarity: 2 }),
    I({ id: 'w_jeans', name: '청바지', category: 'clothing', weight: 0.6, icon: '👖', desc: '두꺼운 데님.', durability: 35, wear: { slot: 'bottom', protect: 0.12 } }),
    I({ id: 'w_sweatpants', name: '운동복 바지', category: 'clothing', weight: 0.3, icon: '👖', desc: '편하다.', durability: 15, wear: { slot: 'bottom', protect: 0.04 } }),
    I({ id: 'w_work_pants', name: '작업복 바지', category: 'clothing', weight: 0.8, icon: '👖', desc: '무릎이 덧대어져 있다.', durability: 45, wear: { slot: 'bottom', protect: 0.18 } }),
    I({ id: 'w_army_pants', name: '군용 바지', category: 'clothing', weight: 0.9, icon: '👖', desc: '전투용 바지.', durability: 55, wear: { slot: 'bottom', protect: 0.22 }, rarity: 2 }),
    I({ id: 'w_sneakers', name: '운동화', category: 'clothing', weight: 0.6, icon: '👟', desc: '조용히 걸을 수 있다.', durability: 30, wear: { slot: 'shoes', protect: 0.05 } }),
    I({ id: 'w_work_boots', name: '작업화', category: 'clothing', weight: 1.2, icon: '🥾', desc: '앞코에 철판이 들어 있다.', durability: 55, wear: { slot: 'shoes', protect: 0.22 } }),
    I({ id: 'w_army_boots', name: '군화', category: 'clothing', weight: 1.3, icon: '🥾', desc: '발목까지 단단하다.', durability: 65, wear: { slot: 'shoes', protect: 0.26 }, rarity: 2 }),
    I({ id: 'w_work_gloves', name: '목장갑', category: 'clothing', weight: 0.05, icon: '🧤', desc: '손바닥이 고무로 코팅되어 있다.', durability: 15, wear: { slot: 'gloves', protect: 0.1 } }),
    I({ id: 'w_leather_gloves', name: '가죽 장갑', category: 'clothing', weight: 0.2, icon: '🧤', desc: '손등을 지켜준다.', durability: 35, wear: { slot: 'gloves', protect: 0.2 } }),
    I({ id: 'w_tactical_gloves', name: '전술 장갑', category: 'clothing', weight: 0.2, icon: '🧤', desc: '손가락 관절에 보호대가 있다.', durability: 50, wear: { slot: 'gloves', protect: 0.26 }, rarity: 2 }),
    // ── 가구 (배치 가능) ──
    I({ id: 'v_bicycle', name: '자전거', category: 'tool', weight: 0, icon: '🚲', desc: '조용하고 연료가 필요 없다. 이동 시간 절반 이하.', vehicle: { speed: 2.2, carry: 6, noise: 0 } }),
    I({ id: 'v_scooter', name: '스쿠터', category: 'tool', weight: 0, icon: '🛵', desc: '빠르지만 시끄럽다. 왕복에 휘발유 1통.', vehicle: { speed: 3, carry: 10, noise: 12, fuel: 1 }, rarity: 2 }),
    I({ id: 'v_car', name: '낡은 승용차', category: 'tool', weight: 0, icon: '🚗', desc: '가장 빠르고 트렁크가 넓다. 소리가 크고 왕복에 휘발유 1통.', vehicle: { speed: 4, carry: 40, noise: 20, fuel: 1 }, rarity: 3 }),
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
    I({ id: 'f_campfire', name: '모닥불', category: 'furniture', weight: 6, icon: '🔥', desc: '돌을 둘러 피운 불. 요리를 할 수 있고 주변을 밝힌다.' }),
    I({ id: 'f_gas_range', name: '가스레인지', category: 'furniture', weight: 14, icon: '🔥', desc: '집에서 떼어 온 가스레인지. 설치하면 요리를 할 수 있다.' }),
    I({ id: 'f_stove', name: '캠핑 스토브', category: 'furniture', weight: 4, icon: '🍳', desc: '요리와 물 끓이기에 필요하다.' }),
    I({ id: 'f_medcab', name: '의료 캐비닛', category: 'furniture', weight: 7, icon: '🏥', desc: '치료 효과가 좋아지고 의료품 제작이 가능하다.' }),
    I({ id: 'f_rain', name: '빗물 수집통', category: 'furniture', weight: 5, icon: '🛢️', desc: '시간이 지나면 더러운 물이 고인다. (실시간 생산)' }),
    I({ id: 'f_planter', name: '텃밭 상자', category: 'furniture', weight: 10, icon: '🌿', desc: '씨앗을 심으면 채소가 자란다. (실시간 생산)' }),
    I({ id: 'f_barricade', name: '바리케이드', category: 'furniture', weight: 10, icon: '🚧', desc: '거점 방어 시설.' }),
    I({ id: 'f_armchair', name: '안락의자', category: 'furniture', weight: 9, icon: '💺', desc: '푹신한 1인용 의자.' }),
    I({ id: 'f_vanity', name: '화장대', category: 'furniture', weight: 9, icon: '🪞', desc: '거울 달린 화장대. 소품을 올려둘 수 있다.' }),
    I({ id: 'f_aquarium', name: '빈 수조', category: 'furniture', weight: 8, icon: '🐠', desc: '물고기는 없지만 은은하다.' }),
    I({ id: 'f_bookcase', name: '책장', category: 'furniture', weight: 10, icon: '📚', desc: '높은 책장. 진열 공간이 넓다.' }),
    I({ id: 'f_dresser', name: '서랍장', category: 'furniture', weight: 9, icon: '🗄️', desc: '위에 소품을 올릴 수 있다.' }),
    I({ id: 'f_sleeping_bag', name: '침낭', category: 'furniture', weight: 2, icon: '🛌', desc: '어디서든 잘 수 있다.' }),
    I({ id: 'f_piano', name: '업라이트 피아노', category: 'furniture', weight: 40, icon: '🎹', desc: '몇 건반은 소리가 나지 않는다.', rarity: 3 }),
    I({ id: 'f_neon', name: '네온사인', category: 'furniture', weight: 3, icon: '🏮', desc: '배터리로 켜지는 간판. 은은하게 빛난다.', rarity: 2 }),
    I({ id: 'f_double_bed', name: '더블 침대', category: 'furniture', weight: 20, icon: '🛏️', desc: '둘이 누워도 넉넉하다. 제일 잘 잔다.', rarity: 2 }),
    I({ id: 'f_bunk_bed', name: '이층 침대', category: 'furniture', weight: 16, icon: '🛏️', desc: '좁은 방에 둘이 잘 수 있다.' }),
    I({ id: 'f_nightstand', name: '협탁', category: 'furniture', weight: 4, icon: '🗄️', desc: '침대 옆 작은 서랍.' }),
    I({ id: 'f_coffee_table', name: '거실 탁자', category: 'furniture', weight: 6, icon: '🟫', desc: '낮은 탁자. 소품을 올려둘 수 있다.' }),
    I({ id: 'f_floor_cushion', name: '방석', category: 'furniture', weight: 1, icon: '🟪', desc: '바닥에 앉을 때 깐다.' }),
    I({ id: 'f_bean_bag', name: '빈백', category: 'furniture', weight: 3, icon: '🫘', desc: '몸이 푹 꺼지는 의자.' }),
    I({ id: 'f_fridge', name: '냉장고', category: 'furniture', weight: 30, icon: '🧊', desc: '전기는 끊겼지만 단단한 보관함이다.' }),
    I({ id: 'f_sink', name: '싱크대', category: 'furniture', weight: 18, icon: '🚰', desc: '물은 안 나오지만 조리대로 쓸 만하다.' }),
    I({ id: 'f_fireplace', name: '벽난로', category: 'furniture', weight: 40, icon: '🔥', desc: '따뜻한 불. 요리도 되고 방이 환해진다.', rarity: 2 }),
    I({ id: 'f_bbq', name: '바비큐 그릴', category: 'furniture', weight: 10, icon: '🍖', desc: '숯불 그릴. 밖에 두고 요리한다.' }),
    I({ id: 'f_locker', name: '철제 사물함', category: 'furniture', weight: 15, icon: '🗄️', desc: '이름표가 붙은 철제 사물함.' }),
    I({ id: 'f_gun_locker', name: '무기 보관함', category: 'furniture', weight: 25, icon: '🔐', desc: '잠글 수 있는 무기장.', rarity: 2 }),
    I({ id: 'f_generator', name: '발전기', category: 'furniture', weight: 35, icon: '⚡', desc: '기름을 먹고 웅웅거린다. 주변이 밝아진다.', rarity: 2 }),
    I({ id: 'f_radio_desk', name: '무전 장비', category: 'furniture', weight: 12, icon: '📡', desc: '주파수를 돌리면 가끔 누군가의 목소리가 잡힌다.', rarity: 2 }),
    I({ id: 'f_sandbags', name: '모래주머니', category: 'furniture', weight: 25, icon: '🧱', desc: '총알도 막아 준다는 모래주머니 더미.' }),
    I({ id: 'f_coat_rack', name: '옷걸이', category: 'furniture', weight: 3, icon: '🧥', desc: '외투를 걸어 둔다.' }),
    I({ id: 'f_mirror', name: '전신 거울', category: 'furniture', weight: 6, icon: '🪞', desc: '오랜만에 자기 얼굴을 본다.' }),
    I({ id: 'f_bathtub', name: '욕조', category: 'furniture', weight: 40, icon: '🛁', desc: '물을 받아 두면 좋겠지만…' }),
    I({ id: 'f_jukebox', name: '주크박스', category: 'furniture', weight: 30, icon: '🎶', desc: '동전을 넣으면 노래가 나올지도.', rarity: 3 }),
    I({ id: 'f_arcade', name: '오락기', category: 'furniture', weight: 30, icon: '🕹️', desc: '화면이 희미하게 깜빡인다.', rarity: 3 }),
    I({ id: 'f_pet_bed', name: '반려동물 방석', category: 'furniture', weight: 1, icon: '🐾', desc: '작은 동물이 쓰던 방석.' }),
    // ── 소품 (가구 위에 올리는 장식) ──
    I({ id: 'p_mug', name: '머그컵', category: 'prop', weight: 0.3, icon: '☕', desc: '책상 위 소품.' }),
    I({ id: 'p_teddy', name: '곰인형', category: 'prop', weight: 0.3, icon: '🧸', desc: '누군가의 소중한 물건이었을 것이다.' }),
    I({ id: 'p_photo', name: '사진 액자', category: 'prop', weight: 0.3, icon: '🖼️', desc: '낯선 가족의 사진.' }),
    I({ id: 'p_candle', name: '양초', category: 'prop', weight: 0.1, icon: '🕯️', desc: '작은 불빛.' }),
    I({ id: 'p_book', name: '소설책', category: 'prop', weight: 0.4, icon: '📕', desc: '읽을거리.' }),
    I({ id: 'p_radio', name: '라디오', category: 'prop', weight: 0.6, icon: '📻', desc: '가끔 잡음이 들린다.' }),
    I({ id: 'p_vase', name: '꽃병', category: 'prop', weight: 0.5, icon: '🏺', desc: '장식용.' }),
    I({ id: 'p_gameboy', name: '휴대용 게임기', category: 'prop', weight: 0.2, icon: '🎮', desc: '배터리가 있으면…', rarity: 2 }),
    I({ id: 'p_flowers', name: '조화 꽃다발', category: 'prop', weight: 0.2, icon: '💐', desc: '시들지 않는 꽃.' }),
    I({ id: 'p_cactus', name: '선인장 화분', category: 'prop', weight: 0.3, icon: '🌵', desc: '물을 안 줘도 산다.' }),
    I({ id: 'p_perfume', name: '향수병', category: 'prop', weight: 0.2, icon: '🧴', desc: '희미한 향이 남아 있다.' }),
    I({ id: 'p_cat_plush', name: '고양이 인형', category: 'prop', weight: 0.3, icon: '🐈', desc: '말랑하다.' }),
    I({ id: 'p_music_box', name: '오르골', category: 'prop', weight: 0.4, icon: '🎼', desc: '태엽을 감으면 낡은 멜로디가 흐른다.', rarity: 2 }),
    I({ id: 'p_snowglobe', name: '스노볼', category: 'prop', weight: 0.4, icon: '🔮', desc: '흔들면 눈이 내린다.', rarity: 2 }),
    I({ id: 'p_clock', name: '탁상시계', category: 'prop', weight: 0.4, icon: '⏰', desc: '아직 째깍거린다.' }),
    I({ id: 'p_figurine', name: '피규어', category: 'prop', weight: 0.2, icon: '🗿', desc: '누군가의 수집품.' }),
    I({ id: 'p_lp', name: 'LP 레코드', category: 'prop', weight: 0.3, icon: '💿', desc: '재킷이 바랬다.' }),
    I({ id: 'p_trophy', name: '트로피', category: 'prop', weight: 0.6, icon: '🏆', desc: '어느 대회의 우승컵.' }),
    I({ id: 'p_pet_bowl', name: '반려동물 밥그릇', category: 'prop', weight: 0.2, icon: '🥣', desc: '이름이 새겨져 있다.' }),
    I({ id: 'p_globe', name: '지구본', category: 'prop', weight: 0.8, icon: '🌐', desc: '학교에서 가져왔다.' }),
    I({ id: 'glasses', name: '안경', category: 'tool', weight: 0.05, icon: '👓', desc: '근시·난시가 있어도 또렷하게 보인다. 소지품에 챙겨 두자.' }),
    // ── 특수 시설
    I({ id: 'f_radio_tower', name: '무전 탑', category: 'furniture', weight: 30, icon: '🗼', desc: '먼 곳의 무전이 잡힌다. 사건이 더 자주 생기고 세력·생존자와 연락이 닿는다.', rarity: 3 }),
    I({ id: 'f_greenhouse', name: '온실', category: 'furniture', weight: 30, icon: '🏡', desc: '씨앗 없이도 채소가 천천히 자란다.', rarity: 2 }),
    I({ id: 'f_water_filter', name: '정수기', category: 'furniture', weight: 15, icon: '🚿', desc: '빗물을 걸러 깨끗한 물을 만든다.', rarity: 2 }),
    I({ id: 'f_watchtower', name: '감시탑', category: 'furniture', weight: 35, icon: '🔭', desc: '좀비 떼를 일찍 발견한다 (경보 20분). 방어력 +4.', rarity: 2 }),
    I({ id: 'gas_mask', name: '방독면', category: 'tool', weight: 0.6, icon: '😷', desc: '오염 구역에서 숨을 쉴 수 있게 해 준다. 행동 한 번에 필터가 1 닳는다.', durability: 12, rarity: 2 }),
    // ── 계절 행사
    I({ id: 'f_xmas_tree', name: '크리스마스 트리', category: 'furniture', weight: 6, icon: '🎄', desc: '반짝이는 전구를 두른 트리.' }),
    I({ id: 'p_pumpkin', name: '호박 랜턴', category: 'prop', weight: 1, icon: '🎃', desc: '삐뚤빼뚤 웃는 얼굴을 깎았다.' }),
    I({ id: 'p_lantern', name: '소원 등불', category: 'prop', weight: 0.3, icon: '🏮', desc: '보름달 아래 소원을 적어 걸었다.' }),
    I({ id: 'candy', name: '사탕 한 줌', category: 'food', weight: 0.1, icon: '🍬', desc: '달콤하다. 기분이 좋아진다.', consume: { hunger: 6, energy: 6 } }),
    I({ id: 'tteokguk', name: '떡국', category: 'food', weight: 0.8, icon: '🥣', desc: '한 그릇 먹으면 한 살 더.', consume: { hunger: 50, thirst: 15, energy: 10, health: 3 } }),
    I({ id: 'songpyeon', name: '송편', category: 'food', weight: 0.3, icon: '🍡', desc: '솔잎 향이 나는 반달 모양 떡.', consume: { hunger: 30, energy: 8 } }),
    ...PACK_ITEMS,
    I({ id: 'rotten_food', name: '상한 음식', category: 'material', weight: 0.3, icon: '🦠', desc: '먹을 수 없다. 퇴비나 미끼로 만들 수 있다.' }),
  ].map((d) => [d.id, d]),
);

// 원래 있던 음식의 유통기한 (게임 시간)
const SPOIL: Record<string, number> = {
  raw_meat: 72, fish: 72, vegetable: 180, berries: 180, grilled_meat: 96, grilled_fish: 96, stew: 96, rice_bowl: 72, roasted_veg: 96, ramen: 36, tteokguk: 72, songpyeon: 120,
};
for (const [id, h] of Object.entries(SPOIL)) if (ITEMS[id]) ITEMS[id].spoil ??= h;

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
  clothing: '의류',
  rare: '희귀',
};
