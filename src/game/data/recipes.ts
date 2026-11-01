import type { SkillId } from '../types';

export type RecipeGroup = 'weapon' | 'medical' | 'food' | 'furniture' | 'building' | 'facility' | 'tool';

export interface Recipe {
  id: string;
  name: string;
  group: RecipeGroup;
  inputs: { itemId: string; qty: number }[];
  /** 소모되지 않는 필요 도구 태그 */
  tools?: string[];
  /** 거점에 배치되어 있어야 하는 시설 */
  station?: 'workbench' | 'stove' | 'medical';
  output: { itemId: string; qty: number };
  skill: SkillId;
  /** 필요 숙련 레벨 */
  level: number;
  /** 게임 시간(분) */
  minutes: number;
}

export const RECIPE_GROUP_LABEL: Record<RecipeGroup, string> = {
  weapon: '무기',
  tool: '도구',
  medical: '의료',
  food: '요리',
  furniture: '가구',
  building: '건축 자재',
  facility: '시설',
};

export const RECIPES: Recipe[] = [
  // 무기 / 도구
  { id: 'r_nail_bat', name: '못 박힌 방망이', group: 'weapon', inputs: [{ itemId: 'bat', qty: 1 }, { itemId: 'nails', qty: 5 }], tools: ['hammer'], output: { itemId: 'nail_bat', qty: 1 }, skill: 'crafting', level: 0, minutes: 30 },
  { id: 'r_spear', name: '수제 창', group: 'weapon', inputs: [{ itemId: 'plank', qty: 1 }, { itemId: 'kitchen_knife', qty: 1 }, { itemId: 'duct_tape', qty: 1 }], output: { itemId: 'spear', qty: 1 }, skill: 'crafting', level: 0, minutes: 30 },
  { id: 'r_lockpick', name: '자물쇠 따개', group: 'tool', inputs: [{ itemId: 'wire', qty: 1 }, { itemId: 'scrap', qty: 1 }], tools: ['screwdriver'], output: { itemId: 'lockpick', qty: 2 }, skill: 'crafting', level: 1, minutes: 20 },
  { id: 'r_crowbar', name: '쇠지렛대', group: 'tool', inputs: [{ itemId: 'scrap', qty: 3 }, { itemId: 'pipe', qty: 1 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'crowbar', qty: 1 }, skill: 'crafting', level: 2, minutes: 60 },
  { id: 'r_bag', name: '책가방 꿰매기', group: 'tool', inputs: [{ itemId: 'cloth', qty: 6 }, { itemId: 'duct_tape', qty: 1 }], output: { itemId: 'school_bag', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  // 의료
  { id: 'r_bandage', name: '붕대', group: 'medical', inputs: [{ itemId: 'cloth', qty: 2 }], output: { itemId: 'bandage', qty: 1 }, skill: 'medical', level: 0, minutes: 10 },
  { id: 'r_disinfectant', name: '소독약 (끓인 물 + 천)', group: 'medical', inputs: [{ itemId: 'boiled_water', qty: 1 }, { itemId: 'cloth', qty: 1 }, { itemId: 'painkiller', qty: 1 }], station: 'medical', output: { itemId: 'disinfectant', qty: 1 }, skill: 'medical', level: 2, minutes: 30 },
  { id: 'r_firstaid', name: '구급상자 꾸리기', group: 'medical', inputs: [{ itemId: 'bandage', qty: 3 }, { itemId: 'disinfectant', qty: 1 }, { itemId: 'painkiller', qty: 2 }], station: 'medical', output: { itemId: 'first_aid', qty: 1 }, skill: 'medical', level: 1, minutes: 20 },
  // 요리
  { id: 'r_boil', name: '물 끓이기', group: 'food', inputs: [{ itemId: 'dirty_water', qty: 1 }], station: 'stove', output: { itemId: 'boiled_water', qty: 1 }, skill: 'cooking', level: 0, minutes: 15 },
  { id: 'r_stew', name: '스튜', group: 'food', inputs: [{ itemId: 'canned_beans', qty: 1 }, { itemId: 'vegetable', qty: 2 }, { itemId: 'boiled_water', qty: 1 }], station: 'stove', output: { itemId: 'stew', qty: 2 }, skill: 'cooking', level: 0, minutes: 40 },
  { id: 'r_ricebowl', name: '채소 비빔밥', group: 'food', inputs: [{ itemId: 'rice', qty: 1 }, { itemId: 'vegetable', qty: 2 }, { itemId: 'boiled_water', qty: 1 }], station: 'stove', output: { itemId: 'rice_bowl', qty: 2 }, skill: 'cooking', level: 1, minutes: 40 },
  { id: 'r_grill', name: '고기 굽기', group: 'food', inputs: [{ itemId: 'raw_meat', qty: 1 }], station: 'stove', output: { itemId: 'grilled_meat', qty: 1 }, skill: 'cooking', level: 0, minutes: 20 },
  { id: 'r_roastveg', name: '채소 굽기', group: 'food', inputs: [{ itemId: 'vegetable', qty: 2 }], station: 'stove', output: { itemId: 'roasted_veg', qty: 1 }, skill: 'cooking', level: 0, minutes: 15 },
  { id: 'r_ramen', name: '라면 끓이기', group: 'food', inputs: [{ itemId: 'instant_noodles', qty: 1 }, { itemId: 'boiled_water', qty: 1 }], station: 'stove', output: { itemId: 'ramen', qty: 1 }, skill: 'cooking', level: 0, minutes: 10 },
  { id: 'r_rod', name: '낚싯대', group: 'tool', inputs: [{ itemId: 'plank', qty: 1 }, { itemId: 'wire', qty: 1 }, { itemId: 'scrap', qty: 1 }], output: { itemId: 'fishing_rod', qty: 1 }, skill: 'crafting', level: 0, minutes: 20 },
  { id: 'r_bait', name: '미끼 만들기', group: 'food', inputs: [{ itemId: 'raw_meat', qty: 1 }], output: { itemId: 'bait', qty: 4 }, skill: 'cooking', level: 0, minutes: 5 },
  { id: 'r_bait_fish', name: '생선 미끼', group: 'food', inputs: [{ itemId: 'fish', qty: 1 }], output: { itemId: 'bait', qty: 3 }, skill: 'cooking', level: 0, minutes: 5 },
  { id: 'r_fish', name: '생선 굽기', group: 'food', inputs: [{ itemId: 'fish', qty: 1 }], station: 'stove', output: { itemId: 'grilled_fish', qty: 1 }, skill: 'cooking', level: 0, minutes: 20 },
  { id: 'r_herbal', name: '약초 붕대', group: 'medical', inputs: [{ itemId: 'herbs', qty: 2 }, { itemId: 'cloth', qty: 1 }], output: { itemId: 'disinfectant', qty: 1 }, skill: 'medical', level: 1, minutes: 20 },
  { id: 'r_soil', name: '비료 섞은 흙', group: 'facility', inputs: [{ itemId: 'fertilizer', qty: 1 }, { itemId: 'plank', qty: 1 }], tools: ['saw'], output: { itemId: 'dirt_bag', qty: 2 }, skill: 'farming', level: 0, minutes: 30 },
  { id: 'r_sleeping_bag', name: '침낭', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 6 }, { itemId: 'duct_tape', qty: 1 }], output: { itemId: 'f_sleeping_bag', qty: 1 }, skill: 'crafting', level: 0, minutes: 45 },
  { id: 'r_armchair', name: '안락의자', group: 'furniture', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'cloth', qty: 5 }, { itemId: 'nails', qty: 3 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_armchair', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  { id: 'r_bookcase', name: '책장', group: 'furniture', inputs: [{ itemId: 'plank', qty: 5 }, { itemId: 'nails', qty: 5 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_bookcase', qty: 1 }, skill: 'crafting', level: 2, minutes: 70 },
  // 가구
  { id: 'r_chair', name: '의자', group: 'furniture', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'nails', qty: 3 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_chair', qty: 1 }, skill: 'crafting', level: 0, minutes: 40 },
  { id: 'r_table', name: '나무 식탁', group: 'furniture', inputs: [{ itemId: 'plank', qty: 4 }, { itemId: 'nails', qty: 4 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_table', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  { id: 'r_shelf', name: '선반', group: 'furniture', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'nails', qty: 4 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_shelf', qty: 1 }, skill: 'crafting', level: 1, minutes: 50 },
  { id: 'r_bed', name: '침대', group: 'furniture', inputs: [{ itemId: 'plank', qty: 5 }, { itemId: 'nails', qty: 6 }, { itemId: 'f_mattress', qty: 1 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_bed', qty: 1 }, skill: 'crafting', level: 2, minutes: 90 },
  { id: 'r_crate', name: '수납 상자', group: 'furniture', inputs: [{ itemId: 'plank', qty: 2 }, { itemId: 'nails', qty: 2 }], tools: ['hammer'], output: { itemId: 'f_crate', qty: 1 }, skill: 'crafting', level: 0, minutes: 25 },
  { id: 'r_rug', name: '천 러그', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 6 }], output: { itemId: 'f_rug', qty: 1 }, skill: 'crafting', level: 0, minutes: 40 },
  { id: 'r_mattress', name: '매트리스', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 8 }], output: { itemId: 'f_mattress', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  { id: 'r_lamp', name: '스탠드 조명', group: 'furniture', inputs: [{ itemId: 'wire', qty: 1 }, { itemId: 'battery', qty: 2 }, { itemId: 'scrap', qty: 1 }], tools: ['screwdriver'], station: 'workbench', output: { itemId: 'f_lamp', qty: 1 }, skill: 'crafting', level: 2, minutes: 40 },
  { id: 'r_nightstand', name: '협탁', group: 'furniture', inputs: [{ itemId: 'plank', qty: 2 }, { itemId: 'nails', qty: 2 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_nightstand', qty: 1 }, skill: 'crafting', level: 0, minutes: 30 },
  { id: 'r_coffee_table', name: '거실 탁자', group: 'furniture', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'nails', qty: 3 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_coffee_table', qty: 1 }, skill: 'crafting', level: 0, minutes: 40 },
  { id: 'r_floor_cushion', name: '방석', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 3 }], output: { itemId: 'f_floor_cushion', qty: 1 }, skill: 'crafting', level: 0, minutes: 20 },
  { id: 'r_bean_bag', name: '빈백', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 6 }, { itemId: 'plastic', qty: 2 }], output: { itemId: 'f_bean_bag', qty: 1 }, skill: 'crafting', level: 1, minutes: 45 },
  { id: 'r_pet_bed', name: '반려동물 방석', group: 'furniture', inputs: [{ itemId: 'cloth', qty: 2 }], output: { itemId: 'f_pet_bed', qty: 1 }, skill: 'crafting', level: 0, minutes: 15 },
  { id: 'r_coat_rack', name: '옷걸이', group: 'furniture', inputs: [{ itemId: 'plank', qty: 2 }, { itemId: 'nails', qty: 1 }], tools: ['saw'], output: { itemId: 'f_coat_rack', qty: 1 }, skill: 'crafting', level: 0, minutes: 25 },
  { id: 'r_bunk_bed', name: '이층 침대', group: 'furniture', inputs: [{ itemId: 'plank', qty: 8 }, { itemId: 'nails', qty: 8 }, { itemId: 'f_mattress', qty: 2 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_bunk_bed', qty: 1 }, skill: 'crafting', level: 3, minutes: 120 },
  { id: 'r_double_bed', name: '더블 침대', group: 'furniture', inputs: [{ itemId: 'plank', qty: 8 }, { itemId: 'nails', qty: 8 }, { itemId: 'cloth', qty: 10 }], tools: ['hammer', 'saw'], station: 'workbench', output: { itemId: 'f_double_bed', qty: 1 }, skill: 'crafting', level: 3, minutes: 150 },
  // 건축 자재
  { id: 'r_plank', name: '가구 분해 → 판자', group: 'building', inputs: [{ itemId: 'f_chair', qty: 1 }], tools: ['saw'], output: { itemId: 'plank', qty: 2 }, skill: 'crafting', level: 0, minutes: 20 },
  { id: 'r_scrap', name: '빈 깡통 → 고철', group: 'building', inputs: [{ itemId: 'empty_can', qty: 4 }], tools: ['hammer'], output: { itemId: 'scrap', qty: 1 }, skill: 'crafting', level: 0, minutes: 15 },
  { id: 'r_tile', name: '고철 → 바닥 타일', group: 'building', inputs: [{ itemId: 'scrap', qty: 2 }], station: 'workbench', output: { itemId: 'tile_pack', qty: 1 }, skill: 'crafting', level: 1, minutes: 30 },
  // 시설
  { id: 'r_workbench', name: '작업대', group: 'facility', inputs: [{ itemId: 'plank', qty: 6 }, { itemId: 'nails', qty: 6 }], tools: ['hammer'], output: { itemId: 'f_workbench', qty: 1 }, skill: 'crafting', level: 0, minutes: 90 },
  { id: 'r_campfire', name: '모닥불', group: 'facility', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'scrap', qty: 1 }], tools: ['fire'], output: { itemId: 'f_campfire', qty: 1 }, skill: 'crafting', level: 0, minutes: 20 },
  { id: 'r_stove', name: '캠핑 스토브', group: 'facility', inputs: [{ itemId: 'scrap', qty: 3 }, { itemId: 'gas_can', qty: 1 }], tools: ['hammer'], output: { itemId: 'f_stove', qty: 1 }, skill: 'crafting', level: 0, minutes: 45 },
  { id: 'r_rain', name: '빗물 수집통', group: 'facility', inputs: [{ itemId: 'plastic', qty: 3 }, { itemId: 'duct_tape', qty: 1 }], output: { itemId: 'f_rain', qty: 1 }, skill: 'crafting', level: 0, minutes: 45 },
  { id: 'r_planter', name: '텃밭 상자', group: 'facility', inputs: [{ itemId: 'plank', qty: 4 }, { itemId: 'nails', qty: 4 }, { itemId: 'dirt_bag', qty: 2 }], tools: ['hammer'], output: { itemId: 'f_planter', qty: 1 }, skill: 'farming', level: 0, minutes: 60 },
  { id: 'r_medcab', name: '의료 캐비닛', group: 'facility', inputs: [{ itemId: 'plank', qty: 3 }, { itemId: 'scrap', qty: 2 }, { itemId: 'bandage', qty: 2 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_medcab', qty: 1 }, skill: 'medical', level: 1, minutes: 60 },
  { id: 'r_bicycle', name: '자전거 조립', group: 'facility', inputs: [{ itemId: 'scrap', qty: 4 }, { itemId: 'pipe', qty: 2 }, { itemId: 'wire', qty: 1 }, { itemId: 'plastic', qty: 2 }], tools: ['wrench'], station: 'workbench', output: { itemId: 'v_bicycle', qty: 1 }, skill: 'crafting', level: 2, minutes: 120 },
  { id: 'r_radio_tower', name: '무전 탑', group: 'facility', inputs: [{ itemId: 'electronics', qty: 3 }, { itemId: 'wire', qty: 4 }, { itemId: 'scrap', qty: 4 }, { itemId: 'battery', qty: 2 }], tools: ['screwdriver'], station: 'workbench', output: { itemId: 'f_radio_tower', qty: 1 }, skill: 'crafting', level: 2, minutes: 120 },
  { id: 'r_greenhouse', name: '온실', group: 'facility', inputs: [{ itemId: 'plank', qty: 6 }, { itemId: 'plastic', qty: 6 }, { itemId: 'dirt_bag', qty: 2 }, { itemId: 'nails', qty: 4 }], tools: ['hammer'], output: { itemId: 'f_greenhouse', qty: 1 }, skill: 'farming', level: 1, minutes: 120 },
  { id: 'r_water_filter', name: '정수기', group: 'facility', inputs: [{ itemId: 'plastic', qty: 4 }, { itemId: 'cloth', qty: 3 }, { itemId: 'duct_tape', qty: 1 }, { itemId: 'scrap', qty: 1 }], output: { itemId: 'f_water_filter', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  { id: 'r_watchtower', name: '감시탑', group: 'facility', inputs: [{ itemId: 'plank', qty: 8 }, { itemId: 'nails', qty: 8 }, { itemId: 'scrap', qty: 2 }], tools: ['hammer'], output: { itemId: 'f_watchtower', qty: 1 }, skill: 'crafting', level: 1, minutes: 90 },
  { id: 'r_gas_mask', name: '방독면', group: 'tool', inputs: [{ itemId: 'plastic', qty: 2 }, { itemId: 'cloth', qty: 3 }, { itemId: 'duct_tape', qty: 1 }], station: 'workbench', output: { itemId: 'gas_mask', qty: 1 }, skill: 'crafting', level: 2, minutes: 45 },
  { id: 'r_barricade', name: '바리케이드', group: 'facility', inputs: [{ itemId: 'plank', qty: 4 }, { itemId: 'nails', qty: 4 }, { itemId: 'scrap', qty: 1 }], tools: ['hammer'], output: { itemId: 'f_barricade', qty: 1 }, skill: 'crafting', level: 1, minutes: 45 },
  { id: 'r_sandbags', name: '모래주머니', group: 'facility', inputs: [{ itemId: 'cloth', qty: 3 }, { itemId: 'dirt_bag', qty: 2 }], output: { itemId: 'f_sandbags', qty: 1 }, skill: 'crafting', level: 0, minutes: 40 },
  { id: 'r_bbq', name: '바비큐 그릴', group: 'facility', inputs: [{ itemId: 'scrap', qty: 4 }, { itemId: 'pipe', qty: 1 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_bbq', qty: 1 }, skill: 'crafting', level: 1, minutes: 60 },
  { id: 'r_fireplace', name: '벽난로', group: 'facility', inputs: [{ itemId: 'scrap', qty: 6 }, { itemId: 'plank', qty: 4 }, { itemId: 'pipe', qty: 2 }], tools: ['hammer'], station: 'workbench', output: { itemId: 'f_fireplace', qty: 1 }, skill: 'crafting', level: 3, minutes: 180 },
];
