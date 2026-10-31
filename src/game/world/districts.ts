import type { LootEntry, SpotDef, ZoneDef } from '../data/locations';
import { D } from './cityGen';

// ───────────── 루트 풀 ─────────────
const L = (itemId: string, w: number, qty?: [number, number]): LootEntry => ({ itemId, w, qty });

export const P = {
  homeKitchen: [L('canned_beans', 5), L('canned_tuna', 3), L('instant_noodles', 5), L('cereal', 3), L('canned_fruit', 2), L('chips', 3), L('rice', 3), L('water_bottle', 4), L('soda', 2), L('kitchen_knife', 2), L('p_mug', 2), L('coffee', 2), L('gas_can', 1), L('honey', 1)],
  bedroom: [L('cloth', 6, [1, 3]), L('p_teddy', 2), L('p_photo', 2), L('p_book', 3), L('p_clock', 2), L('p_cat_plush', 1), L('painkiller', 2), L('bandage', 2), L('school_bag', 1), L('chocolate', 2), L('p_candle', 2), L('battery', 2), L('f_lamp', 1), L('f_rug', 1), L('p_snowglobe', 1)],
  bathroom: [L('bandage', 4), L('painkiller', 3), L('disinfectant', 2), L('cloth', 3), L('p_perfume', 2)],
  living: [L('p_photo', 3), L('p_vase', 2), L('p_candle', 3), L('p_book', 3), L('p_clock', 2), L('p_lp', 2), L('battery', 3), L('lighter', 2), L('f_plant', 2), L('f_lamp', 1), L('f_rug', 1), L('f_armchair', 1), L('f_chair', 2), L('p_figurine', 1), L('area_map', 1)],
  garage: [L('plank', 6, [1, 3]), L('nails', 6, [2, 6]), L('hammer', 2), L('saw', 2), L('scrap', 4, [1, 2]), L('duct_tape', 3), L('crowbar', 1), L('bat', 2), L('golf_club', 1), L('wrench', 2), L('screwdriver', 2), L('flashlight', 2), L('dirt_bag', 2), L('seeds', 2, [1, 3]), L('gas_can', 2)],
  lux: [L('p_perfume', 3), L('p_music_box', 2), L('p_figurine', 2), L('p_snowglobe', 2), L('p_vase', 3), L('f_vanity', 1), L('f_aquarium', 1), L('f_piano', 1), L('chocolate', 2), L('honey', 1), L('p_lp', 2)],
  junk: [L('scrap', 4), L('cloth', 4, [1, 2]), L('plank', 3), L('empty_can', 4), L('empty_bottle', 4), L('plastic', 3), L('battery', 1)],
  restaurant: [L('raw_meat', 2), L('rice', 4, [1, 2]), L('canned_beans', 4), L('instant_noodles', 3), L('gas_can', 3), L('kitchen_knife', 2), L('p_mug', 2), L('water_bottle', 3), L('f_chair', 1), L('f_table', 1)],
  cafe: [L('coffee', 6), L('chocolate', 3), L('p_mug', 4), L('juice', 3), L('f_chair', 2), L('f_table', 1), L('p_cactus', 2), L('p_flowers', 2), L('f_armchair', 1), L('p_lp', 1)],
  grocery: [L('canned_beans', 6, [1, 2]), L('canned_tuna', 4), L('canned_fruit', 4), L('rice', 3), L('instant_noodles', 5, [1, 2]), L('cereal', 3), L('water_bottle', 6, [1, 3]), L('juice', 3), L('chips', 3), L('honey', 1)],
  snack: [L('chips', 5), L('chocolate', 5), L('soda', 4), L('energy_bar', 3), L('sports_drink', 3), L('instant_noodles', 3), L('water_bottle', 3), L('lighter', 1), L('battery', 1)],
  clothes: [L('cloth', 8, [2, 5]), L('school_bag', 3), L('hiking_pack', 1), L('p_perfume', 1)],
  decor: [L('p_flowers', 3), L('p_cactus', 3), L('p_candle', 3), L('p_vase', 3), L('p_clock', 2), L('p_photo', 2), L('p_snowglobe', 1), L('p_music_box', 1), L('f_rug', 3), L('f_plant', 3), L('f_lamp', 2), L('wallpaper_roll', 3, [1, 2]), L('tile_pack', 2), L('f_dresser', 1), L('f_neon', 1)],
  furniture: [L('f_bed', 2), L('f_sofa', 2), L('f_table', 3), L('f_desk', 3), L('f_shelf', 3), L('f_wardrobe', 2), L('f_armchair', 3), L('f_dresser', 3), L('f_bookcase', 2), L('f_vanity', 2), L('f_chair', 4), L('f_rug', 2), L('f_lamp', 2), L('f_mattress', 2)],
  books: [L('p_book', 8, [1, 2]), L('p_globe', 2), L('area_map', 2), L('coffee', 2), L('research_notes', 1), L('f_bookcase', 1), L('p_clock', 1)],
  hardware: [L('hammer', 3), L('saw', 3), L('screwdriver', 3), L('nails', 6, [3, 8]), L('plank', 4, [1, 3]), L('duct_tape', 4), L('crowbar', 1), L('wrench', 2), L('wire', 3), L('seeds', 2, [1, 3]), L('dirt_bag', 2), L('tile_pack', 2), L('wallpaper_roll', 2), L('flashlight', 2)],
  electronics: [L('battery', 6, [1, 3]), L('wire', 4), L('electronics', 3), L('flashlight', 3), L('p_radio', 2), L('p_gameboy', 1), L('walkie_talkie', 1), L('f_tv', 1), L('f_neon', 1)],
  pets: [L('p_pet_bowl', 4), L('p_cat_plush', 3), L('f_aquarium', 2), L('canned_tuna', 3), L('cloth', 2), L('plastic', 2)],
  flowers: [L('seeds', 6, [1, 4]), L('f_plant', 4), L('p_flowers', 4), L('p_cactus', 3), L('dirt_bag', 3), L('fertilizer', 2), L('p_vase', 2)],
  office: [L('coffee', 4), L('p_mug', 3), L('battery', 3), L('p_clock', 2), L('f_desk', 1), L('f_chair', 2), L('f_shelf', 1), L('electronics', 2), L('p_book', 2), L('area_map', 1), L('wire', 2)],
  school: [L('p_book', 5), L('p_globe', 2), L('school_bag', 3), L('cloth', 3), L('chocolate', 2), L('f_desk', 1), L('f_chair', 2), L('area_map', 1), L('p_trophy', 1)],
  sports: [L('bat', 3), L('golf_club', 2), L('sports_drink', 4), L('energy_bar', 3), L('cloth', 2), L('hiking_pack', 1), L('p_trophy', 2), L('f_mattress', 1)],
  medical: [L('bandage', 8, [1, 3]), L('disinfectant', 5), L('painkiller', 5), L('antibiotics', 2), L('first_aid', 1), L('cloth', 3)],
  pharmacy: [L('painkiller', 6), L('antibiotics', 3), L('disinfectant', 4), L('bandage', 5, [1, 2]), L('first_aid', 2), L('energy_bar', 2), L('sports_drink', 2), L('herbs', 1)],
  medtech: [L('electronics', 4), L('battery', 3), L('first_aid', 2), L('f_medcab', 2), L('f_bed', 1), L('research_notes', 1), L('wire', 2)],
  lab: [L('research_notes', 6), L('antibiotics', 4), L('electronics', 4), L('disinfectant', 3), L('battery', 2), L('lab_keycard', 1)],
  police: [L('ammo_9mm', 4, [2, 6]), L('pistol', 1), L('bandage', 3), L('flashlight', 3), L('walkie_talkie', 2), L('lockpick', 3), L('crowbar', 1), L('coffee', 2), L('ammo_shell', 1, [2, 4])],
  fire: [L('fire_axe', 2), L('first_aid', 2), L('bandage', 4), L('flashlight', 3), L('hiking_pack', 1), L('walkie_talkie', 1), L('water_bottle', 3)],
  military: [L('ration_pack', 5, [1, 2]), L('ammo_9mm', 4, [4, 10]), L('ammo_shell', 2, [2, 6]), L('shotgun', 1), L('pistol', 2), L('military_knife', 3), L('hiking_pack', 2), L('first_aid', 2), L('walkie_talkie', 2), L('energy_bar', 3)],
  metal: [L('scrap', 8, [1, 3]), L('pipe', 3), L('nails', 4, [3, 8]), L('wire', 3), L('wrench', 1)],
  wood: [L('plank', 8, [2, 4]), L('nails', 4, [2, 6]), L('saw', 2), L('f_crate', 2)],
  parts: [L('electronics', 5), L('wire', 5), L('battery', 4), L('plastic', 4, [1, 3]), L('screwdriver', 2)],
  vehicle: [L('gas_can', 5), L('duct_tape', 3), L('wrench', 3), L('battery', 4), L('scrap', 4), L('screwdriver', 2), L('wire', 2)],
  foodFactory: [L('canned_beans', 5, [1, 3]), L('canned_fruit', 4, [1, 2]), L('canned_tuna', 4), L('rice', 3), L('instant_noodles', 4, [1, 3]), L('plastic', 3), L('cereal', 2)],
  farm: [L('seeds', 6, [1, 4]), L('vegetable', 4, [1, 3]), L('fertilizer', 3), L('dirt_bag', 3), L('honey', 2), L('raw_meat', 2), L('berries', 2)],
  farmTools: [L('hammer', 2), L('saw', 2), L('plank', 4, [1, 3]), L('nails', 3, [2, 5]), L('fertilizer', 3), L('dirt_bag', 3), L('machete', 1), L('duct_tape', 2), L('gas_can', 2)],
  nature: [L('herbs', 6, [1, 3]), L('berries', 6, [1, 3]), L('plank', 3), L('seeds', 2)],
  camping: [L('flashlight', 3), L('lighter', 3), L('f_sleeping_bag', 3), L('canned_beans', 3), L('water_bottle', 3), L('hiking_pack', 1), L('machete', 1), L('gas_can', 2), L('fishing_rod', 1)],
  fishing: [L('fishing_rod', 3), L('fish', 5, [1, 2]), L('cloth', 2), L('plastic', 2)],
  harbor: [L('fish', 4, [1, 2]), L('gas_can', 3), L('scrap', 3), L('wire', 2), L('plastic', 3), L('duct_tape', 2), L('f_crate', 1)],
  utility: [L('wire', 5, [1, 3]), L('electronics', 4), L('battery', 4, [1, 2]), L('scrap', 3), L('f_lamp', 1), L('walkie_talkie', 1), L('screwdriver', 2)],
  cargo: [L('f_sofa', 1), L('f_bed', 1), L('f_table', 2), L('f_wardrobe', 1), L('f_armchair', 1), L('plastic', 4), L('canned_beans', 3), L('water_bottle', 3), L('p_teddy', 2), L('p_radio', 2), L('electronics', 2), L('battery', 2), L('p_snowglobe', 1)],
  secret: [L('hiking_pack', 2), L('shotgun', 1), L('ammo_shell', 2, [3, 6]), L('ammo_9mm', 2, [4, 10]), L('antibiotics', 3), L('first_aid', 3), L('research_notes', 2), L('lab_keycard', 1), L('p_music_box', 2), L('f_piano', 1), L('p_snowglobe', 2), L('ration_pack', 3), L('military_knife', 2)],
  grave: [L('p_flowers', 5), L('p_candle', 4), L('p_photo', 3), L('herbs', 2)],
};
type Pool = LootEntry[];
const mix = (...ps: Pool[]): Pool => ps.flat();

// ───────────── 구역(Zone) 빌더 ─────────────
const sp = (id: string, name: string, capacity: number, rolls: [number, number], loot: Pool, dark?: boolean): SpotDef => ({ id, name, capacity, rolls, loot, dark });
const z = (id: string, name: string, desc: string, spots: SpotDef[], extra: Partial<ZoneDef> = {}): ZoneDef => ({ id, name, desc, spots, ...extra });
const LOCK = { pry: true, lockpick: true, text: '문이 잠겨 있다.' };
const HEAVY = { pry: true, text: '두꺼운 철문이다. 쇠지렛대가 필요하다.' };

type Zones = ZoneDef[];

const home = (extra: Pool = [], garage = true, attic = false): Zones => [
  z('living', '거실', '먼지 쌓인 소파와 넘어진 액자.', [sp('sofa', '소파 틈', 2, [1, 1], P.living), sp('cabinet', '장식장', 2, [1, 2], mix(P.living, extra))]),
  z('kitchen', '부엌', '냉장고에서 끔찍한 냄새가 난다.', [sp('pantry', '찬장', 3, [1, 3], P.homeKitchen), sp('fridge', '냉장고', 1, [1, 2], [L('soda', 3), L('water_bottle', 3), L('juice', 2)])]),
  z('bedroom', '침실', '커튼이 쳐져 어둡다.', [sp('drawer', '서랍장', 3, [1, 2], P.bedroom, true), sp('closet', '옷장', 2, [1, 3], P.clothes, true)]),
  z('bath', '욕실', '깨진 거울.', [sp('cabinet', '약장', 2, [1, 2], P.bathroom)]),
  ...(garage ? [z('garage', '차고', '셔터가 반쯤 내려와 있다.', [sp('toolbox', '공구함', 3, [1, 3], P.garage)], { locked: LOCK })] : []),
  ...(attic ? [z('attic', '다락', '천장 판넬 위 비축 공간.', [sp('stash', '비축 상자', 1, [2, 4], P.secret)], { secret: { from: 'bedroom', text: '천장에 열리는 판넬을 발견했다!' } })] : []),
];
const apartment = (floors: number): Zones => [
  z('lobby', '로비', '우편함이 열려 있다.', [sp('mail', '우편함', 2, [1, 1], P.junk), sp('guard', '경비실', 1, [1, 2], P.office)]),
  ...Array.from({ length: floors }, (_, k) =>
    z(`floor${k + 1}`, `${k + 1}층 복도`, '현관문 몇 개가 열려 있다.', [
      sp('a', `${k + 1}01호`, 2, [1, 2], mix(P.homeKitchen, P.living), true),
      sp('b', `${k + 1}02호`, 2, [1, 2], mix(P.bedroom, P.clothes), true),
      sp('c', `${k + 1}03호`, 2, [1, 2], mix(P.living, P.decor)),
    ]),
  ),
  z('basement', '지하 창고', '세대별 창고 칸.', [sp('cage', '창고 칸', 3, [1, 3], mix(P.garage, P.junk), true)], { locked: LOCK }),
];
const shop = (pool: Pool, floor = '매장', back = '창고'): Zones => [
  z('floor', floor, '진열대가 쓰러져 있다.', [sp('shelf', '진열대', 4, [1, 3], pool), sp('counter', '계산대', 2, [1, 2], P.snack)]),
  z('back', back, '직원 전용 공간.', [sp('stock', '재고 선반', 3, [2, 3], pool)], { locked: LOCK }),
];
const bigStore = (a: Pool, b: Pool, names: [string, string] = ['1층 매장', '2층 매장']): Zones => [
  z('f1', names[0], '깨진 유리 너머 넓은 매장.', [sp('s1', '진열대 A', 4, [1, 3], a), sp('s2', '진열대 B', 4, [1, 3], a)], { danger: 1 }),
  z('f2', names[1], '멈춘 에스컬레이터를 올라간다.', [sp('s3', '진열대 C', 4, [1, 3], b), sp('s4', '전시 공간', 2, [1, 2], P.decor)], { danger: 1 }),
  z('stock', '물류 창고', '하역장과 연결되어 있다.', [sp('pallet', '팔레트', 3, [2, 4], mix(a, b, P.cargo))], { locked: LOCK }),
  z('office', '사무실', '직원 사무실.', [sp('desk', '책상', 2, [1, 2], P.office)]),
];
const restaurant = (): Zones => [
  z('hall', '홀', '뒤집힌 의자들.', [sp('tables', '테이블', 2, [1, 2], P.cafe)]),
  z('kitchen', '주방', '가스 냄새가 난다.', [sp('fridge', '업소용 냉장고', 2, [1, 3], P.restaurant), sp('shelf', '식자재 선반', 3, [1, 3], P.restaurant)]),
];
const office = (extra: Pool = []): Zones => [
  z('lobby', '로비', '안내 데스크가 비어 있다.', [sp('desk', '안내 데스크', 2, [1, 2], P.office)]),
  z('offices', '사무 공간', '칸막이 책상이 늘어서 있다.', [sp('cubes', '칸막이 책상', 4, [1, 2], mix(P.office, extra)), sp('pantry', '탕비실', 2, [1, 2], P.snack)]),
  z('server', '전산실', '서버 랙.', [sp('rack', '장비 랙', 2, [1, 2], P.electronics)], { locked: LOCK }),
];
const school = (extra: Pool = []): Zones => [
  z('class', '교실', '책상들이 바리케이드처럼 쌓여 있다.', [sp('desks', '책상 서랍', 4, [1, 2], mix(P.school, extra)), sp('furn', '쓸 만한 가구', 2, [1, 1], [L('f_chair', 4), L('f_desk', 3), L('f_shelf', 2)])]),
  z('staff', '교무실', '서류가 흩어져 있다.', [sp('desk', '교사 책상', 2, [1, 2], P.office)]),
  z('nurse', '보건실', '간이 침대가 있다.', [sp('med', '약품장', 2, [1, 2], P.medical)]),
  z('gym', '체육관', '피난민이 머물던 흔적.', [sp('camp', '피난 캠프', 2, [2, 3], mix(P.sports, P.camping))], { danger: 1 }),
  z('cafeteria', '급식실', '대형 조리 시설.', [sp('kitchen', '조리실', 3, [1, 3], P.restaurant)]),
];
const clinic = (pool: Pool = P.medical): Zones => [
  z('wait', '대기실', '접수대와 의자.', [sp('desk', '접수대', 2, [1, 2], P.office)]),
  z('treat', '진료실', '진료 기구가 흩어져 있다.', [sp('cab', '약품장', 3, [1, 3], pool)]),
  z('store', '약품 보관실', '잠긴 보관장.', [sp('locker', '보관장', 2, [2, 3], P.pharmacy)], { locked: LOCK }),
];
const hospital = (big: boolean): Zones => [
  z('er', '응급실', '들것과 쓰러진 사람들. 일부는 아직 움직인다.', [sp('cart', '응급 카트', 4, [1, 3], P.medical)], { danger: 1 }),
  z('ward', '입원 병동', '긴 복도에 병실이 줄지어 있다.', [sp('rooms', '병실', 4, [1, 2], mix(P.medical, P.bedroom), true)]),
  z('pharmacy', '약제실', '항생제가 남아 있을지도.', [sp('shelves', '약품 선반', 3, [2, 3], P.pharmacy)], { locked: LOCK }),
  ...(big ? [z('equip', '의료기기실', '고가의 장비.', [sp('dev', '장비 보관함', 2, [1, 2], P.medtech)], { locked: HEAVY }), z('lab', '임상 연구실', '감염 관련 기록.', [sp('bench', '실험대', 2, [1, 2], P.lab)], { secret: { from: 'ward', text: '병동 끝 직원용 계단을 찾았다.' } })] : []),
];
const police = (heavy: boolean): Zones => [
  z('lobby', '민원실', '서류가 흩어져 있다.', [sp('desk', '접수 데스크', 2, [1, 2], P.office)]),
  z('office', '사무실', '개인 사물함.', [sp('lockers', '사물함', 3, [1, 2], P.police)]),
  z('armory', '무기고', '두꺼운 철문.', [sp('rack', '무기 거치대', 2, [1, 2], heavy ? P.military : P.police)], { locked: HEAVY, danger: 1 }),
];
const factory = (pool: Pool): Zones => [
  z('floor', '작업 현장', '멈춘 컨베이어 벨트.', [sp('line', '생산 라인', 4, [2, 3], pool), sp('scrap', '폐자재 더미', 3, [1, 3], P.metal)]),
  z('warehouse', '자재 창고', '자재가 그대로 쌓여 있다.', [sp('rack', '자재 선반', 3, [2, 4], mix(pool, P.wood))], { danger: 1 }),
  z('office', '관리동', '2층 사무실.', [sp('locker', '경비원 사물함', 2, [1, 2], mix(P.office, [L('fire_axe', 1), L('flashlight', 2)]))], { locked: LOCK }),
];
const warehouse = (pool: Pool): Zones => [
  z('yard', '야적장', '컨테이너가 미로처럼 쌓여 있다.', [sp('box', '열린 컨테이너', 4, [1, 3], pool)]),
  z('dock', '하역장', '지게차가 쓰러져 있다.', [sp('parcels', '화물 더미', 4, [1, 3], P.cargo)], { danger: 1 }),
  z('office', '관리 사무소', '배차표가 붙은 벽.', [sp('desk', '책상', 2, [1, 2], mix(P.office, P.vehicle))], { locked: LOCK }),
];
const farmZones = (pool: Pool = P.farm): Zones => [
  z('house', '농가', '오래된 시골집.', [sp('kitchen', '부엌', 2, [1, 2], mix(P.homeKitchen, [L('honey', 3)])), sp('room', '안방', 2, [1, 2], P.bedroom)]),
  z('barn', '헛간', '건초 냄새.', [sp('tools', '농기구 걸이', 3, [1, 3], P.farmTools)]),
  z('field', '밭', '잡초가 무성하다.', [sp('crops', '남은 작물', 3, [1, 3], pool)]),
];
const natureZones = (pool: Pool = P.nature, lodge: Pool = P.camping): Zones => [
  z('trail', '탐방로', '안개가 낀 숲길.', [sp('bush', '덤불', 4, [1, 3], pool), sp('stream', '물가', 2, [1, 2], mix(pool, P.fishing))]),
  z('lodge', '관리소', '낡은 통나무집.', [sp('shelf', '선반', 2, [1, 3], lodge)]),
];
const military = (pool: Pool = P.military): Zones => [
  z('gate', '검문소', '모래주머니와 철조망.', [sp('post', '초소', 2, [1, 2], mix(P.military, P.junk))], { danger: 1 }),
  z('barracks', '막사', '급히 떠난 흔적.', [sp('lockers', '관물대', 3, [1, 2], mix(pool, P.clothes))]),
  z('depot', '보급고', '봉인된 철문.', [sp('crates', '보급 상자', 2, [2, 4], pool)], { locked: HEAVY, danger: 1 }),
];
const lab = (secure: boolean): Zones => [
  z('lobby', '보안 로비', '경비 로봇이 쓰러져 있다.', [sp('guard', '경비실', 2, [1, 2], mix(P.office, P.electronics))]),
  z('labroom', '연구실', '깨진 유리관과 기록 장치.', [sp('bench', '실험대', 3, [1, 2], P.lab, true)], { danger: 1 }),
  z('vault', '보관실', '보안 등급이 높은 문.', [sp('safe', '시료 보관고', 1, [2, 3], mix(P.lab, P.medtech))], { locked: secure ? { key: 'lab_keycard', text: '출입카드가 필요하다.' } : HEAVY }),
];
const secretZones = (pool: Pool = P.secret): Zones => [
  z('entrance', '입구', '누군가 일부러 숨겨둔 통로.', [sp('debris', '잔해', 2, [1, 2], P.junk, true)]),
  z('hideout', '안쪽 공간', '오래된 비축품.', [sp('stash', '비축품', 2, [2, 4], pool, true)], { danger: 1 }),
];
const utilityZones = (pool: Pool = P.utility): Zones => [
  z('control', '제어실', '꺼진 모니터들.', [sp('panel', '제어반', 3, [1, 2], pool)]),
  z('plant', '설비동', '거대한 기계 소리가 멈췄다.', [sp('equip', '설비 창고', 3, [2, 3], mix(pool, P.metal))], { locked: LOCK }),
];
const harborZones = (pool: Pool = P.harbor): Zones => [
  z('pier', '부두', '바닷바람과 썩은 냄새.', [sp('boats', '정박한 배', 3, [1, 3], pool), sp('nets', '어구 더미', 2, [1, 2], P.fishing)]),
  z('shed', '창고', '녹슨 컨테이너.', [sp('crates', '상자', 3, [1, 3], mix(pool, P.cargo))], { locked: LOCK }),
];
const openArea = (name: string, desc: string, pool: Pool): Zones => [
  z('area', name, desc, [sp('a', '구석', 3, [1, 3], pool), sp('b', '안쪽', 2, [1, 2], pool)]),
];

// ───────────── 대분류 / 소분류 ─────────────
export interface SubType {
  id: string;
  name: string;
  icon: string;
  danger: number;
  size: 'S' | 'M' | 'L';
  zones: () => Zones;
  count?: number;
  requires?: { itemId: string; text: string };
  desc?: string;
}

export interface District {
  id: D;
  name: string;
  short: string;
  color: string; // 지도 라벨 색
  roof: number; // 지도 건물 색
  desc: string;
  loot: string;
  hidden?: boolean;
  types: SubType[];
}

const T = (id: string, name: string, icon: string, danger: number, size: SubType['size'], zones: () => Zones, opt: Partial<SubType> = {}): SubType => ({ id, name, icon, danger, size, zones, ...opt });

export const DISTRICTS: District[] = [
  {
    id: D.Residential, name: '주거지구', short: '주거', color: '#c98a52', roof: 0xa8643a,
    desc: '평범한 시민들이 살던 지역. 거점으로 쓰기 좋은 건물이 많다.', loot: '식량, 옷, 침구, 가전, 가구, 생활용품, 개인 소장품',
    types: [
      T('old_houses', '낡은 단독주택가', '🏚️', 1, 'S', () => home([], true, true), { count: 3 }),
      T('new_houses', '신축 단독주택가', '🏠', 1, 'S', () => home(P.decor), { count: 2 }),
      T('villas', '빌라 밀집구역', '🏘️', 2, 'M', () => apartment(2), { count: 2 }),
      T('low_apt', '저층 아파트 단지', '🏢', 2, 'M', () => apartment(3)),
      T('high_apt', '고층 아파트 단지', '🏙️', 3, 'L', () => apartment(4)),
      T('rich_houses', '고급 주택가', '🏡', 2, 'M', () => [...home(P.lux, true, true), z('study', '서재', '가죽 의자와 책장.', [sp('shelf', '책장', 2, [1, 2], mix(P.books, P.lux))])]),
      T('townhouse', '타운하우스 단지', '🏘️', 1, 'M', () => home(P.decor, false)),
      T('oneroom', '원룸 및 고시원촌', '🚪', 2, 'S', () => apartment(2)),
      T('mixed_apt', '주상복합 아파트', '🏬', 3, 'L', () => [...shop(P.snack, '1층 상가'), ...apartment(3).slice(1)]),
      T('ruined_homes', '폐허가 된 주거단지', '🏚️', 3, 'M', () => openArea('무너진 집터', '불탄 집들이 줄지어 있다.', mix(P.junk, P.garage, P.living))),
    ],
  },
  {
    id: D.Commercial, name: '중심상업지구', short: '상업', color: '#a89ad0', roof: 0x7d6fa0,
    desc: '도시 중심의 번화가. 물자가 많지만 감염자도 많다.', loot: '음식, 의류, 가구, 장식품, 귀중품, 전자제품',
    types: [
      T('downtown', '번화가', '🌃', 3, 'M', () => [...shop(P.clothes, '옷가게'), ...restaurant()]),
      T('food_alley', '먹자골목', '🍢', 2, 'M', () => restaurant().concat(shop(P.grocery, '반찬가게'))),
      T('cafe_street', '카페거리', '☕', 2, 'M', () => [z('cafe', '카페', '창가 자리에 먼지가 쌓였다.', [sp('bar', '바 카운터', 3, [1, 2], P.cafe), sp('deco', '인테리어 소품', 2, [1, 2], P.decor)])]),
      T('shopping_st', '쇼핑거리', '🛍️', 3, 'M', () => [...shop(mix(P.clothes, P.decor), '편집숍'), z('acc', '잡화점', '액세서리 진열대.', [sp('shelf', '진열대', 3, [1, 2], P.lux)])]),
      T('market', '전통시장', '🏮', 2, 'M', () => [z('stalls', '시장 골목', '천막이 찢어진 좌판들.', [sp('veg', '청과 좌판', 3, [1, 3], P.farm), sp('dry', '건어물 가게', 3, [1, 2], mix(P.grocery, P.fishing)), sp('goods', '잡화 좌판', 3, [1, 2], P.homeKitchen)])]),
      T('underground_mall', '지하상가', '🚇', 4, 'M', () => [z('corridor', '지하 통로', '비상등만 깜빡인다.', [sp('shops', '상점들', 4, [1, 3], mix(P.clothes, P.decor, P.snack), true)], { danger: 1 }), ...shop(P.electronics, '전자상가')]),
      T('dept_store', '대형 백화점', '🏬', 4, 'L', () => bigStore(mix(P.clothes, P.lux), P.furniture, ['1층 명품관', '5층 가구관'])),
      T('mall', '복합 쇼핑몰', '🏢', 4, 'L', () => bigStore(mix(P.snack, P.clothes, P.electronics), mix(P.decor, P.sports, P.books))),
      T('hypermarket', '대형마트', '🛒', 3, 'L', () => bigStore(P.grocery, mix(P.hardware, P.homeKitchen), ['식품관', '생활용품관'])),
      T('hotel', '호텔 및 숙박거리', '🏨', 3, 'L', () => [z('lobby', '로비', '샹들리에가 떨어져 있다.', [sp('desk', '프런트', 2, [1, 2], P.office)]), ...apartment(3).slice(1), z('kitchen', '호텔 주방', '대형 냉동고.', [sp('frz', '냉동고', 2, [2, 3], P.restaurant)])]),
      T('office_towers', '오피스 빌딩가', '🏢', 2, 'L', () => office(P.electronics)),
      T('nightlife', '유흥가', '🍸', 3, 'M', () => [z('bar', '바', '네온이 꺼진 바.', [sp('counter', '카운터', 3, [1, 2], mix(P.snack, [L('f_neon', 2), L('p_lp', 2)]))]), z('karaoke', '노래방', '마이크가 바닥에 굴러다닌다.', [sp('rooms', '방', 3, [1, 2], mix(P.junk, P.snack), true)])]),
    ],
  },
  {
    id: D.Local, name: '생활상권지구', short: '상권', color: '#e0c070', roof: 0xb08a4a,
    desc: '주거지 근처의 작은 상권. 개인 방을 꾸밀 물건을 구하기 좋다.', loot: '식재료, 생필품, 공구, 가구, 책, 인테리어 소품',
    types: [
      T('conv', '편의점 거리', '🏪', 1, 'S', () => shop(P.snack, '편의점'), { count: 3 }),
      T('super', '동네 슈퍼마켓', '🛒', 2, 'S', () => shop(P.grocery, '슈퍼'), { count: 2 }),
      T('eatery', '식당가', '🍚', 1, 'S', () => restaurant(), { count: 2 }),
      T('bakery', '베이커리', '🥐', 1, 'S', () => shop(mix(P.cafe, [L('honey', 3), L('cereal', 3)]), '빵집')),
      T('florist', '꽃집 및 원예상가', '💐', 1, 'S', () => shop(P.flowers, '화원', '온실')),
      T('laundry', '세탁소', '👔', 1, 'S', () => shop(mix(P.clothes, [L('f_rug', 2)]), '세탁소')),
      T('salon', '미용실 및 이발소', '💇', 1, 'S', () => shop(mix(P.bathroom, [L('f_vanity', 3), L('p_perfume', 3), L('f_armchair', 2)]), '미용실')),
      T('stationery', '문구점', '✏️', 1, 'S', () => shop(mix(P.school, [L('p_snowglobe', 2), L('p_figurine', 2), L('p_cat_plush', 2)]), '문구점')),
      T('bookstore', '서점', '📚', 1, 'S', () => shop(P.books, '서가')),
      T('furniture_shop', '가구점', '🛋️', 2, 'M', () => [z('show', '전시장', '쇼룸에 가구가 그대로 놓여 있다.', [sp('a', '거실 쇼룸', 3, [1, 2], P.furniture), sp('b', '침실 쇼룸', 3, [1, 2], P.furniture)]), ...shop(P.decor, '소품 코너', '출고 창고').slice(1)], { count: 2 }),
      T('hardware_store', '철물점', '🔨', 1, 'S', () => shop(P.hardware, '철물점'), { count: 2 }),
      T('electronics_store', '전자제품 판매점', '📺', 2, 'S', () => shop(P.electronics, '매장')),
      T('pet_shop', '애완동물 용품점', '🐾', 1, 'S', () => shop(P.pets, '매장')),
      T('interior', '인테리어 소품샵', '🕯️', 1, 'S', () => shop(P.decor, '소품샵'), { count: 2 }),
      T('antique', '골동품 가게', '🏺', 2, 'S', () => shop(P.lux, '골동품점')),
      T('record', '레코드 가게', '💿', 1, 'S', () => shop(mix([L('p_lp', 8), L('p_radio', 2), L('f_neon', 1)], P.decor), '음반점')),
    ],
  },
  {
    id: D.Medical, name: '의료·보건지구', short: '의료', color: '#e08a9a', roof: 0xc0707a,
    desc: '치료용품과 의료 장비를 구하는 곳. 일부 구역은 매우 위험하다.', loot: '의약품, 붕대, 의료 도구, 치료 설비, 연구 자료',
    types: [
      T('clinic_street', '개인 병원 거리', '🩺', 2, 'M', () => clinic()),
      T('pharmacies', '약국 밀집구역', '💊', 2, 'S', () => shop(P.pharmacy, '약국'), { count: 2 }),
      T('health_center', '보건소', '🏥', 2, 'M', () => clinic(mix(P.medical, P.office))),
      T('local_clinic', '동네 의원', '🩹', 1, 'S', () => clinic(), { count: 2 }),
      T('general_hosp', '종합병원', '🏥', 4, 'L', () => hospital(true)),
      T('univ_hosp', '대학병원', '🏨', 5, 'L', () => hospital(true)),
      T('er_center', '응급의료센터', '🚑', 4, 'M', () => hospital(false)),
      T('nursing', '요양병원', '🛏️', 3, 'M', () => hospital(false)),
      T('psych', '정신건강 의료시설', '🧠', 4, 'M', () => [...hospital(false), z('isolation', '격리실', '안쪽에서 긁는 소리.', [sp('room', '병실', 2, [1, 2], mix(P.bedroom, P.medical), true)], { locked: HEAVY, danger: 2 })]),
      T('blood_bank', '혈액 보관센터', '🩸', 3, 'S', () => [z('storage', '냉장 보관실', '전기가 끊겼다.', [sp('fridge', '보관 냉장고', 2, [1, 2], mix(P.medtech, P.medical))])]),
      T('med_logistics', '의료용품 물류창고', '📦', 3, 'M', () => warehouse(mix(P.medical, P.pharmacy))),
      T('quarantine', '감염병 격리병동', '☣️', 5, 'L', () => [...hospital(false), z('ward2', '격리병동', '봉인 테이프가 찢겨 있다.', [sp('rooms', '격리실', 3, [1, 3], mix(P.lab, P.medical), true)], { danger: 2 })]),
    ],
  },
  {
    id: D.Education, name: '교육·문화지구', short: '교육', color: '#9a8ae0', roof: 0x6f5ab0,
    desc: '책과 실습 장비, 희귀 서적까지 다양한 자원이 있다.', loot: '책, 연구 자료, 문구류, 스포츠 장비, 가구, 취미용품',
    types: [
      T('kinder', '유치원 및 어린이집', '🧸', 1, 'M', () => [z('room', '놀이방', '작은 의자와 그림.', [sp('toys', '장난감 상자', 3, [1, 2], [L('p_teddy', 4), L('p_cat_plush', 3), L('cloth', 3), L('f_rug', 2), L('chocolate', 2)])]), z('kitchen', '간식실', '작은 냉장고.', [sp('snack', '간식 선반', 2, [1, 2], P.snack)])]),
      T('elem', '초등학교', '🏫', 2, 'L', () => school()),
      T('middle', '중학교', '🏫', 2, 'L', () => school()),
      T('high', '고등학교', '🏫', 3, 'L', () => school(P.sports)),
      T('campus', '대학교 캠퍼스', '🎓', 3, 'L', () => [...school(P.books), z('lab', '과학관', '실험 기구들.', [sp('bench', '실험대', 2, [1, 2], mix(P.lab, P.parts))], { locked: LOCK })]),
      T('dorm', '대학교 기숙사', '🛏️', 2, 'M', () => apartment(3)),
      T('library', '공공도서관', '📖', 1, 'M', () => [z('stacks', '서가', '조용한 서가.', [sp('a', '서가 A', 4, [1, 3], P.books), sp('b', '서가 B', 4, [1, 3], P.books)]), z('archive', '고문서실', '희귀 서적.', [sp('safe', '보존 서고', 1, [2, 3], mix(P.books, [L('research_notes', 4), L('area_map', 3)]))], { locked: LOCK })]),
      T('museum', '박물관', '🏛️', 2, 'L', () => [z('hall', '전시관', '깨진 진열장.', [sp('case', '진열장', 3, [1, 2], P.lux)]), z('store', '수장고', '포장된 유물들.', [sp('crate', '나무 상자', 2, [1, 2], mix(P.lux, P.wood))], { locked: HEAVY })]),
      T('gallery', '미술관', '🖼️', 1, 'M', () => [z('hall', '전시실', '그림들이 비스듬히 걸려 있다.', [sp('wall', '전시 공간', 3, [1, 2], mix(P.decor, P.lux))])]),
      T('theater', '공연장', '🎭', 3, 'L', () => [z('hall', '객석', '어둠 속의 수백 개 좌석.', [sp('seats', '좌석 사이', 3, [1, 2], P.junk, true)], { danger: 1 }), z('backstage', '무대 뒤', '소품실.', [sp('props', '소품 창고', 3, [1, 3], mix(P.decor, P.clothes, [L('f_piano', 1)]))])]),
      T('cinema', '영화관', '🎬', 2, 'M', () => [z('lobby', '매점', '팝콘 기계.', [sp('snack', '매점', 3, [1, 3], P.snack)]), z('screen', '상영관', '스크린이 찢겨 있다.', [sp('seats', '좌석', 2, [1, 2], P.junk, true)], { danger: 1 })]),
      T('gym_pool', '체육관 및 실내수영장', '🏊', 2, 'M', () => [z('gym', '체육관', '운동기구들.', [sp('lock', '탈의실', 3, [1, 2], P.sports)]), z('pool', '수영장', '물이 썩었다.', [sp('side', '풀사이드', 2, [1, 2], P.junk)])]),
      T('youth', '청소년 수련시설', '⛺', 2, 'M', () => natureZones(P.camping, mix(P.camping, P.sports))),
    ],
  },
  {
    id: D.Admin, name: '행정·치안지구', short: '행정', color: '#6a9ad0', roof: 0x4f7aa8,
    desc: '경찰 장비와 공공시설의 중요한 정보가 있다.', loot: '방어 장비, 무기, 무전기, 구조 장비',
    types: [
      T('police_box', '경찰 지구대', '🚓', 2, 'S', () => police(false).slice(0, 2), { count: 2 }),
      T('police_hq', '경찰서', '🚔', 3, 'L', () => [...police(false), z('cells', '유치장', '창살 너머에서 무언가 움직인다.', [sp('cell', '수감실', 2, [1, 2], mix(P.junk, [L('lockpick', 3)]))], { danger: 2 })]),
      T('swat', '경찰특공대 시설', '🛡️', 4, 'M', () => police(true)),
      T('fire_station', '소방서', '🚒', 2, 'M', () => [z('garage', '차고', '소방차가 서 있다.', [sp('truck', '소방차', 2, [1, 3], P.fire)]), z('quarters', '대기실', '침상과 주방.', [sp('room', '침상', 2, [1, 2], mix(P.homeKitchen, P.bedroom))])], { count: 2 }),
      T('city_hall', '시청', '🏛️', 3, 'L', () => [...office(), z('emergency', '비상 상황실', '지도와 무전 기록.', [sp('map', '상황판', 2, [1, 2], [L('area_map', 5), L('walkie_talkie', 2), L('research_notes', 1)])], { locked: LOCK })]),
      T('district_office', '구청', '🏢', 2, 'M', () => office()),
      T('court', '법원', '⚖️', 2, 'M', () => [...office(), z('evidence', '증거물 보관실', '봉인된 상자.', [sp('box', '증거물 상자', 2, [1, 2], mix(P.police, P.lux))], { locked: HEAVY })]),
      T('prison', '교도소', '⛓️', 5, 'L', () => [z('yard', '운동장', '철조망 너머 무리.', [sp('yard', '운동장 구석', 2, [1, 2], P.junk)], { danger: 2 }), z('block', '수용동', '열린 감방들.', [sp('cells', '감방', 3, [1, 2], mix(P.junk, [L('lockpick', 4), L('military_knife', 1)]), true)], { danger: 1 }), z('armory', '교도관 무기고', '철문.', [sp('rack', '거치대', 2, [1, 2], P.police)], { locked: HEAVY })]),
      T('post_office', '우체국', '📮', 1, 'M', () => warehouse(P.cargo)),
      T('welfare', '행정복지센터', '🏢', 1, 'S', () => office(P.snack)),
      T('disaster_hq', '재난안전대책본부', '📡', 4, 'M', () => [...office(P.electronics), z('supply', '비상 물자 창고', '구호 물자.', [sp('crate', '구호 상자', 3, [2, 3], mix(P.fire, P.grocery))], { locked: LOCK })]),
      T('shelter', '긴급 대피소', '⛺', 3, 'M', () => [z('hall', '대피소 홀', '간이 침상이 줄지어 있다.', [sp('cots', '침상 사이', 4, [1, 3], mix(P.camping, P.grocery, P.medical))], { danger: 1 })]),
    ],
  },
  {
    id: D.Industrial, name: '공업·제조지구', short: '공업', color: '#9a9a9a', roof: 0x666666,
    desc: '거점 건설과 장비 제작 자재의 주요 공급처.', loot: '금속, 목재, 전자부품, 기계 부품, 연료, 공구, 건설자재',
    types: [
      T('small_factories', '소규모 공장지대', '🏭', 2, 'M', () => factory(mix(P.metal, P.parts)), { count: 2 }),
      T('industrial_complex', '대형 산업단지', '🏭', 3, 'L', () => factory(mix(P.metal, P.parts, P.wood))),
      T('steel', '철강 가공공장', '⚙️', 3, 'L', () => factory(P.metal)),
      T('lumber', '목재 가공소', '🪵', 2, 'M', () => factory(P.wood)),
      T('auto_repair', '자동차 정비공장', '🔧', 2, 'M', () => factory(P.vehicle)),
      T('electronics_factory', '전자부품 공장', '🔌', 3, 'L', () => factory(P.parts)),
      T('food_factory', '식품 가공공장', '🥫', 2, 'L', () => factory(P.foodFactory)),
      T('pharma_factory', '제약 공장', '💉', 4, 'L', () => factory(mix(P.pharmacy, P.lab))),
      T('machine', '기계 제작공장', '🛠️', 3, 'M', () => factory(mix(P.metal, P.hardware))),
      T('waste', '폐기물 처리장', '🗑️', 3, 'M', () => openArea('폐기물 더미', '악취가 진동한다.', mix(P.junk, P.metal, P.parts))),
      T('scrapyard', '고철 수집장', '🧲', 2, 'M', () => openArea('고철 산', '녹슨 고철 더미.', mix(P.metal, P.vehicle))),
      T('materials_yard', '건설자재 야적장', '🧱', 2, 'M', () => openArea('자재 야적장', '쌓인 자재들.', mix(P.wood, P.hardware, [L('tile_pack', 4, [1, 3]), L('wallpaper_roll', 2, [1, 2])]))),
    ],
  },
  {
    id: D.Transport, name: '교통·물류지구', short: '교통', color: '#b0a070', roof: 0x857850,
    desc: '차량과 물자 운송 시설이 모여 있다.', loot: '차량 부품, 연료, 운송 장비, 공구, 대량 포장 물자',
    types: [
      T('bus_terminal', '버스터미널', '🚌', 3, 'L', () => [z('hall', '대합실', '버려진 짐가방들.', [sp('bags', '짐가방', 4, [1, 2], mix(P.clothes, P.snack, P.living))], { danger: 1 }), ...shop(P.snack, '매점').slice(0, 1)]),
      T('bus_depot', '시내버스 차고지', '🚍', 2, 'M', () => warehouse(P.vehicle)),
      T('train_station', '기차역', '🚉', 3, 'L', () => [z('hall', '역사', '열차 시간표가 멈춰 있다.', [sp('bags', '버려진 짐', 4, [1, 3], mix(P.clothes, P.living, P.snack))], { danger: 1 }), z('platform', '승강장', '멈춘 열차.', [sp('train', '객차', 3, [1, 3], mix(P.cargo, P.snack), true)], { danger: 1 })]),
      T('freight_station', '화물철도역', '🚂', 3, 'L', () => warehouse(mix(P.cargo, P.metal))),
      T('subway_station', '지하철역', '🚇', 4, 'M', () => [z('concourse', '대합실', '비상등만 깜빡인다.', [sp('kiosk', '매점', 2, [1, 2], P.snack, true)], { danger: 1 }), z('tunnel', '터널', '선로 위의 그림자.', [sp('track', '선로', 2, [1, 2], P.junk, true)], { danger: 2 })]),
      T('subway_depot', '지하철 차량기지', '🚈', 3, 'L', () => warehouse(mix(P.vehicle, P.parts))),
      T('logistics', '물류창고 단지', '📦', 2, 'L', () => warehouse(P.cargo), { count: 2 }),
      T('parcel_center', '대형 택배 분류센터', '📮', 3, 'L', () => warehouse(mix(P.cargo, P.electronics, P.decor))),
      T('truck_stop', '트럭 휴게소', '🚚', 2, 'M', () => [...shop(P.snack, '휴게소'), z('lot', '주차장', '트럭들이 서 있다.', [sp('trucks', '트럭 짐칸', 3, [1, 3], mix(P.cargo, P.vehicle))])]),
      T('gas_stations', '주유소 밀집구역', '⛽', 2, 'S', () => shop(mix(P.snack, P.vehicle), '주유소'), { count: 3 }),
      T('parking', '대형 주차장', '🅿️', 2, 'M', () => openArea('주차 구역', '버려진 차들.', mix(P.vehicle, P.living, P.snack))),
      T('junkyard', '차량 폐차장', '🚗', 2, 'M', () => openArea('폐차 더미', '찌그러진 차들.', mix(P.vehicle, P.metal))),
      T('airport', '공항 및 화물터미널', '✈️', 4, 'L', () => [z('terminal', '여객 터미널', '면세점 진열대가 무너졌다.', [sp('duty', '면세점', 4, [1, 3], mix(P.lux, P.snack)), sp('bags', '수하물', 3, [1, 3], mix(P.clothes, P.living))], { danger: 1 }), ...warehouse(P.cargo).slice(0, 2)]),
    ],
  },
  {
    id: D.Farm, name: '농업·교외지구', short: '농업', color: '#b0c070', roof: 0x8a6a3a,
    desc: '도심 바깥의 넓은 땅. 장기 생존을 위한 식량 생산에 적합하다.', loot: '씨앗, 농작물, 농기구, 비료, 농업 설비',
    types: [
      T('village', '소규모 농촌 마을', '🏡', 1, 'M', () => farmZones(), { count: 2 }),
      T('big_farm', '대규모 농장', '🚜', 2, 'L', () => farmZones(mix(P.farm, P.farmTools))),
      T('allotment', '개인 텃밭 단지', '🥬', 1, 'S', () => openArea('텃밭', '이름표가 꽂힌 작은 밭들.', P.farm)),
      T('greenhouse', '비닐하우스 밀집지역', '🌱', 1, 'M', () => openArea('비닐하우스', '찢어진 비닐 안의 작물.', mix(P.farm, P.flowers))),
      T('orchard', '과수원', '🍎', 1, 'M', () => openArea('과수원', '떨어진 과일이 썩어 간다.', mix(P.farm, [L('canned_fruit', 2), L('berries', 4, [2, 4])]))),
      T('livestock', '축산 농장', '🐄', 2, 'M', () => farmZones(mix(P.farm, [L('raw_meat', 5, [1, 2])]))),
      T('poultry', '양계장', '🐔', 2, 'M', () => openArea('양계장', '텅 빈 닭장.', mix(P.farm, [L('raw_meat', 3)]))),
      T('silo', '곡물 저장고', '🌾', 2, 'M', () => openArea('사일로', '곡물 포대가 쌓여 있다.', [L('rice', 8, [1, 3]), L('cereal', 3), L('seeds', 3, [2, 4])])),
      T('machine_shed', '농기계 창고', '🚜', 2, 'M', () => openArea('농기계 창고', '트랙터와 농기구.', mix(P.farmTools, P.vehicle))),
      T('reservoir', '농업용 저수지', '💧', 1, 'S', () => natureZones(P.fishing, P.farmTools)),
      T('agri_center', '농산물 유통센터', '🏬', 2, 'L', () => warehouse(mix(P.farm, P.grocery))),
      T('farmhouse', '외딴 농가', '🛖', 1, 'S', () => farmZones(), { count: 2 }),
    ],
  },
  {
    id: D.Nature, name: '자연·휴양지구', short: '자연', color: '#80b070', roof: 0x5a4a30,
    desc: '도시 외곽과 중심의 녹지. 채집과 낚시를 할 수 있다.', loot: '목재, 약초, 자연 식재료, 낚시 도구, 캠핑 장비',
    types: [
      T('central_park', '도시 중앙공원', '🌳', 2, 'L', () => natureZones()),
      T('neighborhood_park', '근린공원', '🌲', 1, 'S', () => natureZones(), { count: 2 }),
      T('forest', '산림지대', '🌲', 2, 'M', () => natureZones(mix(P.nature, P.wood))),
      T('hiking', '등산로', '🥾', 2, 'S', () => natureZones(P.nature, mix(P.camping, P.sports))),
      T('valley', '계곡', '🏞️', 2, 'S', () => natureZones(mix(P.nature, P.fishing))),
      T('lake', '호수', '🛶', 1, 'M', () => natureZones(P.fishing)),
      T('riverwalk', '강변 산책로', '🚶', 1, 'S', () => natureZones(mix(P.nature, P.fishing), P.snack)),
      T('campground', '캠핑장', '🏕️', 2, 'M', () => natureZones(P.nature, P.camping)),
      T('rec_forest', '휴양림', '🌿', 2, 'M', () => natureZones(P.nature, mix(P.camping, P.living))),
      T('fishing_spot', '낚시터', '🎣', 1, 'S', () => natureZones(P.fishing, P.fishing)),
      T('cemetery', '공동묘지', '🪦', 3, 'M', () => openArea('묘역', '안개 낀 묘비들 사이.', P.grave)),
      T('wildlife', '야생동물 서식지', '🦌', 3, 'M', () => natureZones(mix(P.nature, [L('raw_meat', 3)]))),
      T('cabin', '버려진 산장', '🛖', 2, 'S', () => [...home(P.camping, false), z('cellar', '지하 저장고', '먼지 쌓인 선반.', [sp('jars', '병조림 선반', 2, [1, 3], [L('honey', 4), L('canned_fruit', 3), L('berries', 3)])], { secret: { from: 'living', text: '바닥 깔개 아래 뚜껑문을 발견했다!' } })]),
    ],
  },
  {
    id: D.Harbor, name: '수변·항만지구', short: '항만', color: '#60b0c0', roof: 0x4f6a80,
    desc: '강을 끼고 있는 지역. 대량 물자와 특수 장비가 있다.', loot: '수산 식재료, 어구, 연료, 선박 부품, 컨테이너 물자',
    types: [
      T('river_houses', '강변 주택가', '🏠', 1, 'S', () => home(P.fishing), { count: 2 }),
      T('river_warehouses', '하천변 창고지대', '🏚️', 2, 'M', () => warehouse(mix(P.cargo, P.harbor))),
      T('port', '항구', '⚓', 3, 'L', () => harborZones()),
      T('container_yard', '컨테이너 야적장', '📦', 3, 'L', () => warehouse(mix(P.cargo, P.electronics, P.furniture))),
      T('fish_market', '어시장', '🐟', 2, 'M', () => openArea('경매장', '얼음이 녹은 수조.', mix(P.fishing, P.grocery))),
      T('cold_storage', '수산물 냉동창고', '🧊', 2, 'M', () => warehouse([L('fish', 8, [1, 3]), L('canned_tuna', 4)])),
      T('shipyard', '선박 정비소', '🛥️', 2, 'M', () => factory(mix(P.harbor, P.vehicle))),
      T('marina', '마리나 및 요트 선착장', '⛵', 2, 'M', () => harborZones(mix(P.harbor, P.lux))),
      T('cargo_pier', '화물 선착장', '🚢', 3, 'M', () => harborZones(P.cargo)),
      T('coast_guard', '해안경비 시설', '🚨', 3, 'M', () => police(false)),
      T('lighthouse', '등대', '🗼', 2, 'S', () => [z('tower', '등대', '나선 계단.', [sp('room', '관리실', 2, [1, 2], mix(P.camping, P.electronics, P.fishing))])]),
      T('wrecks', '폐선박 구역', '🛳️', 3, 'M', () => openArea('폐선', '기울어진 배 안.', mix(P.harbor, P.junk, P.secret))),
    ],
  },
  {
    id: D.Utility, name: '도시 기반시설지구', short: '기반', color: '#c0c070', roof: 0x8a8a50,
    desc: '거점이 발전한 뒤에도 계속 찾게 되는 핵심 시설.', loot: '발전 설비, 전력 부품, 정수 장비, 통신 장비, 기계 부품',
    types: [
      T('power_plant', '발전소', '⚡', 4, 'L', () => utilityZones(mix(P.utility, P.metal))),
      T('substation', '변전소', '🔌', 3, 'M', () => utilityZones()),
      T('water_plant', '정수장', '💧', 3, 'L', () => utilityZones(mix(P.utility, [L('water_bottle', 4, [2, 4]), L('plastic', 3)]))),
      T('sewage', '하수처리장', '🕳️', 3, 'M', () => utilityZones(mix(P.metal, P.junk))),
      T('water_mgmt', '상수도 관리시설', '🚰', 2, 'S', () => utilityZones()),
      T('cell_tower', '통신기지국', '📶', 2, 'S', () => utilityZones(P.electronics)),
      T('broadcast', '방송국', '📺', 3, 'L', () => [...office(P.electronics), z('studio', '스튜디오', '조명과 카메라.', [sp('gear', '장비실', 2, [1, 2], P.electronics)])]),
      T('datacenter', '데이터센터', '🖥️', 3, 'L', () => utilityZones(mix(P.electronics, P.parts))),
      T('underground_power', '지하 전력시설', '🔋', 4, 'M', () => utilityZones(mix(P.utility, P.parts))),
      T('gas_supply', '가스 공급시설', '🔥', 3, 'M', () => utilityZones(mix(P.utility, [L('gas_can', 6, [1, 3])]))),
      T('disaster_facility', '도시 방재시설', '🌊', 3, 'M', () => utilityZones(mix(P.utility, P.fire))),
      T('equipment_depot', '대형 설비 관리창고', '🏗️', 2, 'L', () => warehouse(mix(P.metal, P.parts, P.hardware))),
    ],
  },
  {
    id: D.Military, name: '군사·통제지구', short: '군사', color: '#90a060', roof: 0x5a6a40,
    desc: '사태 초기 군대가 통제하던 지역. 위험하지만 귀중한 장비가 있다.', loot: '군용 장비, 무기, 탄약, 차량 부품, 특수 생존 물품',
    types: [
      T('checkpoint', '군사 검문소', '🚧', 3, 'S', () => military().slice(0, 2), { count: 2 }),
      T('temp_camp', '임시 군사 주둔지', '⛺', 4, 'M', () => military()),
      T('army_base', '육군 기지', '🪖', 5, 'L', () => military()),
      T('supply_depot', '군수 물자창고', '📦', 4, 'L', () => warehouse(P.military)),
      T('motor_pool', '군용 차량 차고지', '🚛', 3, 'M', () => warehouse(mix(P.vehicle, P.military))),
      T('ammo_depot', '탄약 저장시설', '💥', 5, 'M', () => military([L('ammo_9mm', 6, [5, 12]), L('ammo_shell', 5, [3, 8]), L('shotgun', 1)])),
      T('mil_hospital', '군 병원', '🏥', 4, 'L', () => hospital(false)),
      T('mil_comms', '군 통신시설', '📡', 3, 'M', () => utilityZones(mix(P.electronics, P.military))),
      T('quarantine_camp', '감염자 격리 캠프', '☣️', 5, 'L', () => [...military(), z('tents', '격리 텐트', '봉인된 천막들.', [sp('tent', '텐트 안', 3, [1, 3], mix(P.medical, P.lab), true)], { danger: 2 })]),
      T('refugee_camp', '임시 피난민 수용소', '🏕️', 3, 'L', () => [z('tents', '천막촌', '버려진 생활의 흔적.', [sp('tents', '천막', 4, [1, 3], mix(P.camping, P.living, P.grocery))])]),
      T('blocked_road', '봉쇄된 도로', '🚧', 3, 'S', () => openArea('바리케이드', '뒤엉킨 차량과 철조망.', mix(P.military, P.vehicle))),
      T('command_post', '철수한 군사 작전본부', '🎖️', 4, 'M', () => [...military(), z('ops', '작전실', '찢어진 작전 지도.', [sp('maps', '작전 테이블', 2, [1, 2], [L('area_map', 5), L('research_notes', 2), L('walkie_talkie', 3)])])]),
    ],
  },
  {
    id: D.Research, name: '연구·특수시설지구', short: '연구', color: '#90d0d0', roof: 0x7aa0a0,
    desc: '희귀 제작법과 고급 연구 장비를 얻을 수 있는 후반 지역.', loot: '연구 장비, 가상 연구 시료, 특수 약품, 실험 자료',
    types: [
      T('univ_lab', '대학 부설 연구소', '🔬', 3, 'M', () => lab(false)),
      T('bio_center', '생명과학 연구센터', '🧬', 4, 'L', () => lab(true)),
      T('pharma_lab', '민간 제약 연구소', '💊', 4, 'M', () => lab(false)),
      T('national_lab', '국립 감염병 연구시설', '☣️', 5, 'L', () => lab(true), { requires: { itemId: 'lab_keycard', text: '보안문을 열려면 연구소 출입카드가 필요하다.' } }),
      T('underground_lab', '지하 연구시설', '🕳️', 5, 'M', () => lab(true), { requires: { itemId: 'lab_keycard', text: '지하 승강기는 출입카드로만 움직인다.' } }),
      T('mil_bio', '군사 생물학 연구시설', '🧪', 5, 'L', () => [...military(), ...lab(true).slice(1)]),
      T('observation', '감염자 관찰시설', '👁️', 5, 'M', () => [...lab(false), z('pens', '관찰실', '두꺼운 유리 너머.', [sp('cell', '관찰실', 2, [1, 2], P.lab, true)], { danger: 2 })]),
      T('med_equipment', '특수 의료장비 보관소', '🩻', 3, 'M', () => warehouse(P.medtech)),
      T('researcher_dorm', '연구원 숙소', '🛏️', 2, 'M', () => apartment(2)),
      T('sealed_wing', '폐쇄된 실험동', '🚫', 5, 'M', () => lab(true)),
      T('data_vault', '보안 데이터 보관시설', '💾', 4, 'M', () => utilityZones(mix(P.electronics, P.lab))),
    ],
  },
  {
    id: D.Secret, name: '특수·비밀구역', short: '비밀', color: '#d070d0', roof: 0x6a4a6a, hidden: true,
    desc: '처음에는 지도에 없다. 탐험과 사건으로 발견하는 장소.', loot: '희귀 장비, 특별한 가구, 비밀 문서, 고유 아이템',
    types: [
      T('survivor_hideout', '비밀 생존자 은신처', '🏚️', 2, 'S', () => secretZones(mix(P.secret, P.grocery))),
      T('bunker', '지하 벙커', '🚪', 3, 'M', () => secretZones(mix(P.secret, P.military))),
      T('air_raid', '버려진 방공호', '🕳️', 2, 'S', () => secretZones(mix(P.camping, P.grocery))),
      T('smuggler', '밀수업자 창고', '💰', 3, 'M', () => secretZones(mix(P.secret, P.lux, P.electronics))),
      T('tunnel', '지하 터널', '🚇', 4, 'M', () => secretZones(mix(P.junk, P.secret))),
      T('mine', '폐광', '⛏️', 3, 'M', () => secretZones(mix(P.metal, P.camping))),
      T('secret_armory', '비밀 무기고', '🔫', 4, 'S', () => secretZones(P.military)),
      T('outbreak_site', '감염자 집단 발생지', '☣️', 5, 'M', () => secretZones(mix(P.lab, P.medical))),
      T('horde', '대규모 좀비 집결지', '🧟', 5, 'L', () => secretZones(mix(P.military, P.secret))),
      T('last_seen', '실종자 마지막 목격 장소', '👣', 3, 'S', () => secretZones(mix(P.living, P.bedroom, [L('p_photo', 4), L('p_music_box', 2)]))),
      T('sealed_subway', '폐쇄된 지하철 구간', '🚇', 4, 'M', () => secretZones(mix(P.junk, P.cargo))),
      T('mansion', '외딴 저택', '🏰', 3, 'L', () => [...home(P.lux, false, true), z('hall', '대연회장', '먼지 쌓인 샹들리에.', [sp('hall', '전시장', 2, [1, 2], mix(P.lux, P.furniture))])]),
      T('secret_lab', '비밀 연구구역', '🧪', 5, 'M', () => lab(true)),
    ],
  },
];

export const DISTRICT_BY_ID: Record<number, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
