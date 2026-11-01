import { CENTERS, claimBuilding, distanceFromBase, type D } from '../world/cityGen';
import { DISTRICTS } from '../world/districts';
import { PLACE_LOOT, PLACE_RX } from './packLoot';
import { PACK_ITEMS } from './packItems';

export interface LootEntry {
  itemId: string;
  w: number;
  qty?: [number, number];
}

export interface SpotDef {
  id: string;
  name: string;
  /** 처음 수색 가능 횟수 (고갈) */
  capacity: number;
  /** 1회 수색 시 아이템 개수 범위 */
  rolls: [number, number];
  loot: LootEntry[];
  /** 어두운 곳: 손전등 없으면 놓치는 물건이 많다 */
  dark?: boolean;
}

export interface ZoneDef {
  id: string;
  name: string;
  desc: string;
  /** 잠긴 구역: 해금 방법 */
  locked?: { pry?: boolean; lockpick?: boolean; key?: string; text: string };
  /** 숨은 공간: 다른 구역을 철저히 수색해야 발견 */
  secret?: { from: string; text: string };
  /** 구역 위험도 보정 */
  danger?: number;
  /** 오염 구역: 방독면 없이는 행동할 때마다 다친다 */
  toxic?: boolean;
  /** 처음 들어가면 거구 감염자가 기다린다 */
  boss?: boolean;
  spots: SpotDef[];
}

export interface LocationDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  danger: number; // 1~5
  travel: number; // 편도 이동 시간(분)
  pos: { x: number; y: number }; // 월드맵 타일 좌표 (cityGen 에서 배정)
  startDiscovered: boolean;
  /** 대분류(구역) 번호 */
  district: number;
  /** 지도 라벨에 쓰는 짧은 종류 이름 */
  kind: string;
  size: 'S' | 'M' | 'L';
  /** 동네 이름 */
  area?: string;
  /** 진입에 필요한 아이템 */
  requires?: { itemId: string; text: string };
  /** 먼 원정지: 차량(스쿠터·자동차)이 있어야 갈 수 있고 연료가 더 든다 */
  far?: boolean;
  /** 일시적(보급 투하) */
  temporary?: boolean;
  zones: ZoneDef[];
}

// 공통 루트 테이블
const KITCHEN: LootEntry[] = [
  { itemId: 'canned_beans', w: 6 }, { itemId: 'canned_tuna', w: 4 }, { itemId: 'chips', w: 4 },
  { itemId: 'rice', w: 3 }, { itemId: 'water_bottle', w: 5 }, { itemId: 'soda', w: 3 },
  { itemId: 'kitchen_knife', w: 2 }, { itemId: 'p_mug', w: 2 }, { itemId: 'gas_can', w: 2 },
  { itemId: 'coffee', w: 2 }, { itemId: 'lighter', w: 1 }, { itemId: 'raw_meat', w: 1 }, { itemId: 'f_stove', w: 1 },
];
const BEDROOM: LootEntry[] = [
  { itemId: 'cloth', w: 6, qty: [1, 3] }, { itemId: 'p_teddy', w: 2 }, { itemId: 'p_photo', w: 2 },
  { itemId: 'p_book', w: 3 }, { itemId: 'painkiller', w: 2 }, { itemId: 'bandage', w: 2 },
  { itemId: 'school_bag', w: 1 }, { itemId: 'chocolate', w: 2 }, { itemId: 'p_candle', w: 2 },
  { itemId: 'battery', w: 2 }, { itemId: 'f_lamp', w: 1 }, { itemId: 'f_rug', w: 1 }, { itemId: 'w_hoodie', w: 1 }, { itemId: 'w_cap', w: 1 }, { itemId: 'glasses', w: 1 },
];
const GARAGE: LootEntry[] = [
  { itemId: 'plank', w: 6, qty: [1, 3] }, { itemId: 'nails', w: 6, qty: [2, 6] }, { itemId: 'hammer', w: 2 },
  { itemId: 'saw', w: 2 }, { itemId: 'scrap', w: 4, qty: [1, 2] }, { itemId: 'duct_tape', w: 3 },
  { itemId: 'crowbar', w: 1 }, { itemId: 'bat', w: 2 }, { itemId: 'pipe', w: 1 }, { itemId: 'screwdriver', w: 2 },
  { itemId: 'flashlight', w: 2 }, { itemId: 'dirt_bag', w: 2 }, { itemId: 'seeds', w: 2, qty: [1, 3] }, { itemId: 'f_stove', w: 1 },
];
const MEDICAL: LootEntry[] = [
  { itemId: 'bandage', w: 8, qty: [1, 3] }, { itemId: 'disinfectant', w: 5 }, { itemId: 'painkiller', w: 5 },
  { itemId: 'antibiotics', w: 2 }, { itemId: 'first_aid', w: 1 }, { itemId: 'cloth', w: 3 },
];

const HANDCRAFTED: LocationDef[] = [
  {
    id: 'suburb', name: '이웃 주택가', icon: '🏘️', danger: 1, travel: 30, pos: { x: 0, y: 0 }, startDiscovered: true, district: 1, kind: '이웃집', size: 'S',
    desc: '거점 근처의 조용한 주택가. 위험은 적지만 이미 많이 털렸다.',
    zones: [
      { id: 'living', name: '거실', desc: '먼지 쌓인 소파와 넘어진 TV.', spots: [
        { id: 'sofa', name: '소파 틈', capacity: 2, rolls: [1, 1], loot: [{ itemId: 'chips', w: 3 }, { itemId: 'battery', w: 2 }, { itemId: 'p_gameboy', w: 1 }, { itemId: 'chocolate', w: 2 }, { itemId: 'p_book', w: 2 }] },
        { id: 'cabinet', name: '장식장', capacity: 2, rolls: [1, 2], loot: [{ itemId: 'p_vase', w: 2 }, { itemId: 'p_photo', w: 3 }, { itemId: 'p_candle', w: 3 }, { itemId: 'lighter', w: 2 }, { itemId: 'area_map', w: 1 }] },
        { id: 'furniture', name: '쓸 만한 가구', capacity: 2, rolls: [1, 1], loot: [{ itemId: 'f_chair', w: 4 }, { itemId: 'f_plant', w: 3 }, { itemId: 'f_rug', w: 2 }, { itemId: 'f_lamp', w: 2 }, { itemId: 'f_tv', w: 1 }] },
      ] },
      { id: 'kitchen', name: '부엌', desc: '냉장고에서 끔찍한 냄새가 난다.', spots: [
        { id: 'pantry', name: '찬장', capacity: 4, rolls: [1, 3], loot: KITCHEN },
        { id: 'fridge', name: '냉장고', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'soda', w: 3 }, { itemId: 'water_bottle', w: 3 }, { itemId: 'raw_meat', w: 1 }] },
      ] },
      { id: 'bedroom', name: '침실', desc: '커튼이 쳐져 어둡다.', spots: [
        { id: 'drawer', name: '서랍장', capacity: 3, rolls: [1, 2], loot: BEDROOM, dark: true },
        { id: 'closet', name: '옷장', capacity: 2, rolls: [1, 3], loot: [{ itemId: 'cloth', w: 6, qty: [2, 4] }, { itemId: 'school_bag', w: 2 }, { itemId: 'p_teddy', w: 1 }, { itemId: 'w_jeans', w: 2 }, { itemId: 'w_leather_jacket', w: 1 }, { itemId: 'w_beanie', w: 1 }], dark: true },
      ] },
      { id: 'garage', name: '차고', desc: '셔터가 반쯤 내려와 있다.', locked: { pry: true, lockpick: true, text: '차고 문이 잠겨 있다.' }, spots: [
        { id: 'toolbox', name: '공구함', capacity: 3, rolls: [1, 3], loot: GARAGE },
        { id: 'wood', name: '목재 더미', capacity: 3, rolls: [2, 3], loot: [{ itemId: 'plank', w: 8, qty: [1, 3] }, { itemId: 'nails', w: 4, qty: [2, 5] }] },
      ] },
      { id: 'attic', name: '숨겨진 다락', desc: '천장 판넬 위에 누군가 비축해둔 공간.', secret: { from: 'bedroom', text: '천장에 열리는 판넬을 발견했다!' }, spots: [
        { id: 'stash', name: '비축 상자', capacity: 1, rolls: [3, 5], loot: [{ itemId: 'canned_beans', w: 4 }, { itemId: 'water_bottle', w: 4 }, { itemId: 'antibiotics', w: 1 }, { itemId: 'ammo_9mm', w: 2, qty: [3, 8] }, { itemId: 'hiking_pack', w: 1 }, { itemId: 'first_aid', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'mart', name: '동네 마트', icon: '🏪', danger: 2, travel: 45, pos: { x: 0, y: 0 }, startDiscovered: true, district: 3, kind: '동네 마트', size: 'M',
    desc: '식량이 많지만 좀비도 많다. 유리창이 깨져 있다.',
    zones: [
      { id: 'aisles', name: '진열대', desc: '대부분 털렸지만 바닥에 떨어진 것들이 있다.', danger: 1, spots: [
        { id: 'snack', name: '과자 코너', capacity: 4, rolls: [1, 3], loot: [{ itemId: 'chips', w: 5 }, { itemId: 'chocolate', w: 4 }, { itemId: 'soda', w: 3 }] },
        { id: 'canned', name: '통조림 코너', capacity: 4, rolls: [1, 3], loot: [{ itemId: 'canned_beans', w: 5 }, { itemId: 'canned_tuna', w: 4 }, { itemId: 'rice', w: 2 }] },
        { id: 'drinks', name: '음료 냉장고', capacity: 3, rolls: [1, 3], loot: [{ itemId: 'water_bottle', w: 6 }, { itemId: 'soda', w: 3 }, { itemId: 'coffee', w: 2 }] },
      ] },
      { id: 'goods', name: '생활용품 코너', desc: '공구와 잡화가 남아 있다.', spots: [
        { id: 'hardware', name: '공구 진열대', capacity: 3, rolls: [1, 2], loot: [{ itemId: 'duct_tape', w: 4 }, { itemId: 'battery', w: 4 }, { itemId: 'flashlight', w: 2 }, { itemId: 'lighter', w: 3 }, { itemId: 'gas_can', w: 3 }, { itemId: 'seeds', w: 3, qty: [1, 3] }] },
        { id: 'deco', name: '인테리어 코너', capacity: 3, rolls: [1, 2], loot: [{ itemId: 'wallpaper_roll', w: 4, qty: [1, 3] }, { itemId: 'p_candle', w: 3 }, { itemId: 'p_vase', w: 2 }, { itemId: 'f_rug', w: 2 }, { itemId: 'f_plant', w: 2 }, { itemId: 'tile_pack', w: 2, qty: [1, 2] }] },
      ] },
      { id: 'storage', name: '창고', desc: '직원 전용 문 너머.', locked: { pry: true, lockpick: true, text: '직원 전용 문이 잠겨 있다.' }, danger: 1, spots: [
        { id: 'pallet', name: '팔레트', capacity: 3, rolls: [2, 4], loot: [{ itemId: 'canned_beans', w: 5, qty: [1, 2] }, { itemId: 'water_bottle', w: 5, qty: [1, 3] }, { itemId: 'rice', w: 3 }, { itemId: 'plastic', w: 3, qty: [1, 2] }, { itemId: 'f_crate', w: 2 }] },
      ], },
    ],
  },
  {
    id: 'school', name: '피난처 초등학교', icon: '🏫', danger: 2, travel: 50, pos: { x: 0, y: 0 }, startDiscovered: true, district: 5, kind: '대피소 학교', size: 'L',
    desc: '대피소였던 곳. 복도에 피난민의 흔적이 남아 있다.',
    zones: [
      { id: 'classroom', name: '교실', desc: '책상들이 바리케이드처럼 쌓여 있다.', spots: [
        { id: 'desks', name: '책상 서랍', capacity: 4, rolls: [1, 2], loot: [{ itemId: 'p_book', w: 3 }, { itemId: 'chocolate', w: 2 }, { itemId: 'school_bag', w: 3 }, { itemId: 'p_globe', w: 1 }, { itemId: 'cloth', w: 2 }, { itemId: 'area_map', w: 1 }] },
        { id: 'furniture', name: '쓸 만한 가구', capacity: 3, rolls: [1, 1], loot: [{ itemId: 'f_chair', w: 4 }, { itemId: 'f_desk', w: 3 }, { itemId: 'f_shelf', w: 2 }] },
      ] },
      { id: 'nurse', name: '보건실', desc: '침대 시트가 피로 얼룩져 있다.', spots: [
        { id: 'cabinet', name: '약품장', capacity: 3, rolls: [1, 2], loot: MEDICAL },
        { id: 'bed', name: '간이 침대', capacity: 1, rolls: [1, 1], loot: [{ itemId: 'f_mattress', w: 3 }, { itemId: 'f_medcab', w: 1 }] },
      ] },
      { id: 'cafeteria', name: '급식실', desc: '대형 조리 시설이 있다.', danger: 1, spots: [
        { id: 'kitchen', name: '조리실', capacity: 4, rolls: [1, 3], loot: [...KITCHEN, { itemId: 'rice', w: 5, qty: [1, 2] }] },
      ] },
      { id: 'gym', name: '체육관', desc: '피난민들이 머물던 곳. 많은 것이 남아 있다.', danger: 2, spots: [
        { id: 'camp', name: '피난민 캠프', capacity: 3, rolls: [2, 3], loot: [{ itemId: 'water_bottle', w: 4 }, { itemId: 'canned_beans', w: 4 }, { itemId: 'cloth', w: 3, qty: [1, 3] }, { itemId: 'f_mattress', w: 2 }, { itemId: 'bat', w: 2 }, { itemId: 'hiking_pack', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'police', name: '중부 경찰서', icon: '🚓', danger: 3, travel: 70, pos: { x: 0, y: 0 }, startDiscovered: true, district: 6, kind: '중부 경찰서', size: 'L',
    desc: '무기와 장비가 있을 수 있지만, 마지막까지 저항한 흔적이 짙다.',
    zones: [
      { id: 'lobby', name: '민원실', desc: '서류가 흩어져 있다.', spots: [
        { id: 'desk', name: '접수 데스크', capacity: 3, rolls: [1, 2], loot: [{ itemId: 'coffee', w: 3 }, { itemId: 'battery', w: 3 }, { itemId: 'p_mug', w: 2 }, { itemId: 'flashlight', w: 2 }, { itemId: 'area_map', w: 2 }] },
      ] },
      { id: 'office', name: '형사과', desc: '사건 기록과 개인 사물함.', spots: [
        { id: 'lockers', name: '사물함', capacity: 3, rolls: [1, 2], loot: [{ itemId: 'bandage', w: 3 }, { itemId: 'painkiller', w: 2 }, { itemId: 'ammo_9mm', w: 3, qty: [2, 6] }, { itemId: 'school_bag', w: 1 }, { itemId: 'p_photo', w: 2 }, { itemId: 'lab_keycard', w: 1 }, { itemId: 'glasses', w: 1 }] },
        { id: 'files', name: '사건 파일', capacity: 2, rolls: [1, 1], loot: [{ itemId: 'area_map', w: 3 }, { itemId: 'research_notes', w: 1 }, { itemId: 'p_book', w: 2 }] },
      ] },
      { id: 'armory', name: '무기고', desc: '두꺼운 철문. 무기가 남아 있을지도.', danger: 1, locked: { pry: true, text: '무거운 철문이 잠겨 있다. 쇠지렛대가 필요하다.' }, spots: [
        { id: 'rack', name: '무기 거치대', capacity: 2, rolls: [1, 2], loot: [{ itemId: 'pistol', w: 2 }, { itemId: 'ammo_9mm', w: 5, qty: [4, 10] }, { itemId: 'crowbar', w: 1 }, { itemId: 'flashlight', w: 2 }] },
      ] },
      { id: 'cells', name: '유치장', desc: '창살 너머에서 무언가 움직인다.', danger: 2, spots: [
        { id: 'cell', name: '수감실', capacity: 2, rolls: [1, 2], loot: [{ itemId: 'cloth', w: 3 }, { itemId: 'f_mattress', w: 2 }, { itemId: 'lockpick', w: 3 }] },
      ] },
    ],
  },
  {
    id: 'hospital', name: '시립 병원', icon: '🏥', danger: 4, travel: 80, pos: { x: 0, y: 0 }, startDiscovered: true, district: 4, kind: '시립 병원', size: 'L',
    desc: '의료품의 보고. 그만큼 감염자도 가장 많다.',
    zones: [
      { id: 'er', name: '응급실', desc: '들것과 쓰러진 사람들. 그 중 일부는 아직 움직인다.', danger: 1, spots: [
        { id: 'cart', name: '응급 카트', capacity: 4, rolls: [1, 3], loot: MEDICAL },
      ] },
      { id: 'ward', name: '입원 병동', desc: '긴 복도에 병실 문이 줄지어 있다.', spots: [
        { id: 'rooms', name: '병실', capacity: 4, rolls: [1, 2], loot: [...MEDICAL, { itemId: 'p_teddy', w: 1 }, { itemId: 'f_bed', w: 1 }, { itemId: 'p_vase', w: 1 }], dark: true },
      ] },
      { id: 'pharmacy', name: '약제실', desc: '항생제가 남아 있을지도 모른다.', locked: { lockpick: true, pry: true, text: '약제실 문은 전자식이었지만 지금은 기계식 자물쇠만 남았다.' }, spots: [
        { id: 'shelves', name: '약품 선반', capacity: 3, rolls: [2, 3], loot: [{ itemId: 'antibiotics', w: 5 }, { itemId: 'disinfectant', w: 4 }, { itemId: 'painkiller', w: 4 }, { itemId: 'first_aid', w: 2 }] },
      ] },
      { id: 'director', name: '원장실', desc: '고급 가구와 잠긴 금고.', secret: { from: 'ward', text: '병동 끝에서 직원용 계단을 찾았다. 원장실로 이어진다.' }, spots: [
        { id: 'safe', name: '책상과 금고', capacity: 1, rolls: [2, 3], loot: [{ itemId: 'lab_keycard', w: 3 }, { itemId: 'research_notes', w: 3 }, { itemId: 'p_globe', w: 1 }, { itemId: 'f_desk', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'factory', name: '폐공장', icon: '🏭', danger: 3, travel: 90, pos: { x: 0, y: 0 }, startDiscovered: true, district: 7, kind: '폐공장', size: 'L',
    desc: '고철과 전자 부품, 건축 자재가 잔뜩 쌓여 있다.',
    zones: [
      { id: 'floor', name: '작업 현장', desc: '멈춘 컨베이어 벨트.', spots: [
        { id: 'scrap', name: '고철 더미', capacity: 5, rolls: [2, 4], loot: [{ itemId: 'scrap', w: 8, qty: [1, 3] }, { itemId: 'wire', w: 4 }, { itemId: 'nails', w: 4, qty: [3, 8] }, { itemId: 'pipe', w: 2 }] },
        { id: 'parts', name: '부품 상자', capacity: 3, rolls: [1, 3], loot: [{ itemId: 'electronics', w: 4 }, { itemId: 'wire', w: 5 }, { itemId: 'battery', w: 3 }, { itemId: 'plastic', w: 4, qty: [1, 3] }] },
      ] },
      { id: 'warehouse', name: '자재 창고', desc: '건축 자재가 그대로 남아 있다.', danger: 1, spots: [
        { id: 'lumber', name: '목재 선반', capacity: 4, rolls: [2, 4], loot: [{ itemId: 'plank', w: 8, qty: [2, 4] }, { itemId: 'tile_pack', w: 3, qty: [1, 3] }, { itemId: 'wallpaper_roll', w: 2 }] },
        { id: 'furniture', name: '사무 가구', capacity: 2, rolls: [1, 1], loot: [{ itemId: 'f_desk', w: 3 }, { itemId: 'f_shelf', w: 3 }, { itemId: 'f_crate', w: 3 }, { itemId: 'f_workbench', w: 1 }] },
      ] },
      { id: 'office', name: '관리동', desc: '2층 사무실.', locked: { lockpick: true, pry: true, text: '관리동 출입문이 잠겨 있다.' }, spots: [
        { id: 'locker', name: '경비원 사물함', capacity: 2, rolls: [1, 2], loot: [{ itemId: 'fire_axe', w: 2 }, { itemId: 'hiking_pack', w: 1 }, { itemId: 'flashlight', w: 2 }, { itemId: 'coffee', w: 3 }] },
      ] },
    ],
  },
  {
    id: 'depot', name: '물류 창고', icon: '🏗️', danger: 2, travel: 75, pos: { x: 0, y: 0 }, startDiscovered: true, district: 8, kind: '물류 창고', size: 'L',
    desc: '컨테이너가 미로처럼 쌓인 넓은 부지.',
    zones: [
      { id: 'yard', name: '야적장', desc: '컨테이너 사이로 바람이 분다.', spots: [
        { id: 'container', name: '열린 컨테이너', capacity: 5, rolls: [1, 3], loot: [{ itemId: 'f_sofa', w: 1 }, { itemId: 'f_bed', w: 1 }, { itemId: 'f_table', w: 2 }, { itemId: 'f_wardrobe', w: 1 }, { itemId: 'f_lamp', w: 2 }, { itemId: 'plastic', w: 4, qty: [1, 3] }, { itemId: 'dirt_bag', w: 3 }, { itemId: 'seeds', w: 3, qty: [2, 4] }] },
      ] },
      { id: 'dock', name: '하역장', desc: '지게차가 쓰러져 있다.', danger: 1, spots: [
        { id: 'boxes', name: '택배 박스', capacity: 4, rolls: [1, 3], loot: [{ itemId: 'canned_beans', w: 3 }, { itemId: 'water_bottle', w: 3 }, { itemId: 'p_gameboy', w: 1 }, { itemId: 'p_radio', w: 2 }, { itemId: 'p_teddy', w: 2 }, { itemId: 'battery', w: 3 }, { itemId: 'duct_tape', w: 2 }] },
      ] },
      { id: 'cold', name: '냉동 창고', desc: '전기가 끊긴 지 오래다.', locked: { pry: true, text: '두꺼운 냉동 창고 문이 얼어붙어 있다.' }, spots: [
        { id: 'meat', name: '냉동 선반', capacity: 2, rolls: [2, 3], loot: [{ itemId: 'raw_meat', w: 5, qty: [1, 2] }, { itemId: 'canned_tuna', w: 3 }] },
      ] },
    ],
  },
  {
    id: 'lab', name: '외곽 연구소', icon: '🧬', danger: 5, travel: 120, pos: { x: 0, y: 0 }, startDiscovered: true, district: 14, kind: '외곽 연구소', size: 'L',
    requires: { itemId: 'lab_keycard', text: '보안문을 열려면 연구소 출입카드가 필요하다.' },
    desc: '감염 사태 초기 무언가를 연구하던 곳. 보안문이 굳게 닫혀 있다.',
    zones: [
      { id: 'lobby', name: '보안 로비', desc: '경비 로봇이 쓰러져 있다.', spots: [
        { id: 'guard', name: '경비실', capacity: 2, rolls: [1, 2], loot: [{ itemId: 'electronics', w: 4 }, { itemId: 'battery', w: 3 }, { itemId: 'ammo_9mm', w: 3, qty: [3, 8] }, { itemId: 'first_aid', w: 2 }] },
      ] },
      { id: 'labroom', name: '연구실', desc: '깨진 유리관과 기록 장치.', danger: 1, spots: [
        { id: 'bench', name: '실험대', capacity: 3, rolls: [1, 2], loot: [{ itemId: 'research_notes', w: 6 }, { itemId: 'antibiotics', w: 4 }, { itemId: 'electronics', w: 4 }, { itemId: 'disinfectant', w: 3 }], dark: true },
      ] },
    ],
  },
  // ───────────── 유랑 상인 (며칠씩 자리를 옮긴다) ─────────────
  {
    id: 'merchant_1', name: '유랑 상인의 노점 (번화가 골목)', icon: '🧳', danger: 1, travel: 40, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 2, kind: '유랑 상인', size: 'S',
    desc: '커다란 배낭을 멘 상인이 담요를 깔고 물건을 늘어놓았다. 며칠 뒤면 다른 곳으로 떠난다.',
    zones: [
      { id: 'stall', name: '노점', desc: '모닥불 옆에 물건이 늘어서 있다. 가져온 물건과 바꿀 수 있다.', spots: [
        { id: 'crate', name: '버려진 상자', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'scrap', w: 3 }, { itemId: 'cloth', w: 3 }, { itemId: 'empty_can', w: 2 }, { itemId: 'battery', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'merchant_2', name: '유랑 상인의 노점 (주택가 공터)', icon: '🧳', danger: 1, travel: 40, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 1, kind: '유랑 상인', size: 'S',
    desc: '커다란 배낭을 멘 상인이 담요를 깔고 물건을 늘어놓았다. 며칠 뒤면 다른 곳으로 떠난다.',
    zones: [
      { id: 'stall', name: '노점', desc: '모닥불 옆에 물건이 늘어서 있다. 가져온 물건과 바꿀 수 있다.', spots: [
        { id: 'crate', name: '버려진 상자', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'scrap', w: 3 }, { itemId: 'cloth', w: 3 }, { itemId: 'empty_can', w: 2 }, { itemId: 'battery', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'merchant_3', name: '유랑 상인의 노점 (버스 차고지 앞)', icon: '🧳', danger: 1, travel: 40, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 8, kind: '유랑 상인', size: 'S',
    desc: '커다란 배낭을 멘 상인이 담요를 깔고 물건을 늘어놓았다. 며칠 뒤면 다른 곳으로 떠난다.',
    zones: [
      { id: 'stall', name: '노점', desc: '모닥불 옆에 물건이 늘어서 있다. 가져온 물건과 바꿀 수 있다.', spots: [
        { id: 'crate', name: '버려진 상자', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'scrap', w: 3 }, { itemId: 'cloth', w: 3 }, { itemId: 'empty_can', w: 2 }, { itemId: 'battery', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'merchant_4', name: '유랑 상인의 노점 (농로 옆 천막)', icon: '🧳', danger: 1, travel: 40, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 9, kind: '유랑 상인', size: 'S',
    desc: '커다란 배낭을 멘 상인이 담요를 깔고 물건을 늘어놓았다. 며칠 뒤면 다른 곳으로 떠난다.',
    zones: [
      { id: 'stall', name: '노점', desc: '모닥불 옆에 물건이 늘어서 있다. 가져온 물건과 바꿀 수 있다.', spots: [
        { id: 'crate', name: '버려진 상자', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'scrap', w: 3 }, { itemId: 'cloth', w: 3 }, { itemId: 'empty_can', w: 2 }, { itemId: 'battery', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'merchant_5', name: '유랑 상인의 노점 (공원 정자)', icon: '🧳', danger: 1, travel: 40, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 10, kind: '유랑 상인', size: 'S',
    desc: '커다란 배낭을 멘 상인이 담요를 깔고 물건을 늘어놓았다. 며칠 뒤면 다른 곳으로 떠난다.',
    zones: [
      { id: 'stall', name: '노점', desc: '모닥불 옆에 물건이 늘어서 있다. 가져온 물건과 바꿀 수 있다.', spots: [
        { id: 'crate', name: '버려진 상자', capacity: 1, rolls: [1, 2], loot: [{ itemId: 'scrap', w: 3 }, { itemId: 'cloth', w: 3 }, { itemId: 'empty_can', w: 2 }, { itemId: 'battery', w: 1 }] },
      ] },
    ],
  },
  // ───────────── 먼 원정지 (차량 필요) ─────────────
  {
    id: 'far_city', name: '이웃 도시 새벽시', icon: '🌆', danger: 4, travel: 600, pos: { x: 354, y: 176 }, startDiscovered: true, far: true, district: 14, kind: '이웃 도시', size: 'L',
    desc: '고속도로를 타고 한참 달려야 닿는 이웃 도시. 아무도 손대지 않은 상점이 남아 있다.',
    zones: [
      { id: 'street', name: '번화가', desc: '버려진 차들 사이로 상점 간판이 늘어서 있다.', spots: [
        { id: 'shops', name: '상점가', capacity: 6, rolls: [2, 4], loot: [...KITCHEN, { itemId: 'hiking_pack', w: 2 }, { itemId: 'w_leather_jacket', w: 2 }, { itemId: 'p_music_box', w: 1 }] },
        { id: 'pharmacy', name: '대형 약국', capacity: 4, rolls: [2, 3], loot: [...MEDICAL, { itemId: 'antibiotics', w: 4 }, { itemId: 'first_aid', w: 3 }] },
      ] },
      { id: 'mall', name: '백화점', desc: '에스컬레이터가 멈춘 6층 건물.', danger: 1, spots: [
        { id: 'furniture', name: '가구 매장', capacity: 4, rolls: [1, 2], loot: [{ itemId: 'f_double_bed', w: 2 }, { itemId: 'f_sofa', w: 3 }, { itemId: 'f_aquarium', w: 1 }, { itemId: 'f_jukebox', w: 1 }, { itemId: 'f_arcade', w: 1 }, { itemId: 'f_piano', w: 1 }, { itemId: 'f_rug', w: 3 }] },
        { id: 'electronics', name: '전자 매장', capacity: 3, rolls: [1, 3], loot: [{ itemId: 'electronics', w: 6, qty: [1, 3] }, { itemId: 'battery', w: 5, qty: [2, 4] }, { itemId: 'wire', w: 4, qty: [1, 3] }, { itemId: 'walkie_talkie', w: 2 }] },
      ] },
      { id: 'garage', name: '지하 주차장', desc: '칠흑같이 어둡다. 무언가 거대한 것이 숨 쉬는 소리.', boss: true, danger: 2, spots: [
        { id: 'cars', name: '주차된 차들', capacity: 4, rolls: [2, 3], loot: [{ itemId: 'gasoline', w: 6 }, { itemId: 'scrap', w: 4, qty: [2, 4] }, { itemId: 'v_scooter', w: 1 }, { itemId: 'duct_tape', w: 3 }], dark: true },
      ] },
    ],
  },
  {
    id: 'far_rest', name: '고속도로 휴게소', icon: '⛽', danger: 4, travel: 520, pos: { x: 230, y: 316 }, startDiscovered: true, far: true, district: 14, kind: '휴게소', size: 'M',
    desc: '약탈자 무리가 드나든다는 소문이 있는 휴게소. 주유소 탱크에는 아직 기름이 남아 있을지도.',
    zones: [
      { id: 'station', name: '주유소', desc: '주유기 옆에 기름통이 굴러다닌다.', spots: [
        { id: 'pumps', name: '주유기', capacity: 5, rolls: [1, 3], loot: [{ itemId: 'gasoline', w: 8, qty: [1, 2] }, { itemId: 'gas_can', w: 3 }, { itemId: 'lighter', w: 2 }] },
      ] },
      { id: 'food', name: '푸드코트', desc: '우동 국물 냄새 대신 썩은 내가 난다.', spots: [
        { id: 'kitchen', name: '주방', capacity: 4, rolls: [2, 3], loot: [...KITCHEN, { itemId: 'ration_pack', w: 2 }] },
      ] },
      { id: 'camp', name: '약탈자 야영지', desc: '총알 자국과 빈 술병. 주인은 잠시 자리를 비웠다.', danger: 2, locked: { pry: true, lockpick: true, text: '철조망 문이 자물쇠로 잠겨 있다.' }, spots: [
        { id: 'stash', name: '약탈품 더미', capacity: 3, rolls: [2, 4], loot: [{ itemId: 'ammo_9mm', w: 5, qty: [4, 10] }, { itemId: 'ammo_shell', w: 3, qty: [2, 5] }, { itemId: 'shotgun', w: 1 }, { itemId: 'military_knife', w: 2 }, { itemId: 'first_aid', w: 2 }, { itemId: 'v_car', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'far_chem', name: '외곽 화학 단지', icon: '☣️', danger: 5, travel: 680, pos: { x: 6, y: 150 }, startDiscovered: true, far: true, district: 14, kind: '화학 단지', size: 'L',
    desc: '사고 이후 봉쇄된 화학 단지. 노란 연기가 아직 피어오른다. 방독면 없이는 오래 버틸 수 없다.',
    zones: [
      { id: 'gate', name: '검문소', desc: '버려진 방역 차량과 천막.', spots: [
        { id: 'tent', name: '방역 천막', capacity: 3, rolls: [1, 3], loot: [{ itemId: 'gas_mask', w: 4 }, { itemId: 'disinfectant', w: 5 }, { itemId: 'antibiotics', w: 3 }, { itemId: 'first_aid', w: 2 }] },
      ] },
      { id: 'plant', name: '반응 공정동', desc: '탱크가 터진 자리. 공기가 따끔거린다.', toxic: true, danger: 1, spots: [
        { id: 'lab', name: '품질 관리실', capacity: 4, rolls: [2, 3], loot: [{ itemId: 'electronics', w: 6, qty: [2, 4] }, { itemId: 'research_notes', w: 3 }, { itemId: 'battery', w: 4, qty: [2, 5] }, { itemId: 'wire', w: 4, qty: [2, 4] }, { itemId: 'lab_keycard', w: 1 }] },
      ] },
      { id: 'core', name: '저장 탱크 구역', desc: '거대한 그림자가 탱크 사이를 어슬렁거린다.', toxic: true, boss: true, danger: 2, spots: [
        { id: 'vault', name: '비상 물자 창고', capacity: 3, rolls: [3, 5], loot: [{ itemId: 'antibiotics', w: 5, qty: [1, 2] }, { itemId: 'first_aid', w: 4 }, { itemId: 'gasoline', w: 4 }, { itemId: 'ration_pack', w: 4, qty: [1, 3] }, { itemId: 'f_generator', w: 1 }, { itemId: 'f_radio_tower', w: 1 }] },
      ] },
    ],
  },
  {
    id: 'far_outlet', name: '교외 아울렛', icon: '🛍️', danger: 3, travel: 480, pos: { x: 120, y: 316 }, startDiscovered: true, far: true, district: 14, kind: '아울렛', size: 'L',
    desc: '도시 밖 넓은 들판에 선 아울렛 단지. 옷과 캠핑 용품이 가득하다.',
    zones: [
      { id: 'brands', name: '의류 매장', desc: '마네킹이 사람처럼 서 있다.', spots: [
        { id: 'racks', name: '옷걸이', capacity: 5, rolls: [2, 3], loot: [{ itemId: 'w_leather_jacket', w: 3 }, { itemId: 'w_hoodie', w: 4 }, { itemId: 'w_jeans', w: 4 }, { itemId: 'w_beanie', w: 3 }, { itemId: 'w_cap', w: 3 }, { itemId: 'cloth', w: 4, qty: [2, 5] }] },
      ] },
      { id: 'outdoor', name: '캠핑 용품점', desc: '텐트가 펼쳐진 채 전시되어 있다.', spots: [
        { id: 'gear', name: '진열대', capacity: 4, rolls: [1, 3], loot: [{ itemId: 'hiking_pack', w: 4 }, { itemId: 'f_sleeping_bag', w: 3 }, { itemId: 'flashlight', w: 4 }, { itemId: 'f_stove', w: 2 }, { itemId: 'v_bicycle', w: 1 }, { itemId: 'gas_can', w: 3 }] },
      ] },
      { id: 'home', name: '리빙관', desc: '온갖 인테리어 소품.', spots: [
        { id: 'deco', name: '소품 코너', capacity: 4, rolls: [1, 3], loot: [{ itemId: 'p_candle', w: 4 }, { itemId: 'p_vase', w: 3 }, { itemId: 'p_cat_plush', w: 2 }, { itemId: 'p_music_box', w: 1 }, { itemId: 'f_plant', w: 3 }, { itemId: 'f_lamp', w: 3 }, { itemId: 'f_neon', w: 1 }, { itemId: 'wallpaper_roll', w: 3, qty: [1, 3] }] },
      ] },
    ],
  },
  {
    id: 'airdrop', name: '보급 투하 지점', icon: '🪂', danger: 3, travel: 60, pos: { x: 0, y: 0 }, startDiscovered: false, temporary: true, district: 10, kind: '보급 투하', size: 'M',
    desc: '헬기가 무언가를 떨어뜨렸다. 소리를 듣고 좀비들이 몰려들고 있다.',
    zones: [
      { id: 'crate', name: '보급 상자', desc: '낙하산에 걸린 군용 상자.', spots: [
        { id: 'box', name: '보급 상자', capacity: 3, rolls: [2, 4], loot: [{ itemId: 'ration_pack', w: 6, qty: [1, 2] }, { itemId: 'water_bottle', w: 6, qty: [1, 3] }, { itemId: 'first_aid', w: 3 }, { itemId: 'antibiotics', w: 2 }, { itemId: 'ammo_9mm', w: 3, qty: [4, 10] }, { itemId: 'seeds', w: 3, qty: [2, 4] }, { itemId: 'hiking_pack', w: 1 }] },
      ] },
    ],
  },
];

// ───────────── 도시 전체 장소 구성 ─────────────

function nearestArea(p: { x: number; y: number }): string {
  let best = CENTERS[0];
  let bd = Infinity;
  for (const c of CENTERS) {
    const d = Math.hypot(p.x - c.x, p.y - c.y) / c.w;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best.name;
}

/** 초반 탐험지는 거점 가까이에 둔다 */
const NEAR_BASE = new Set(['suburb', 'mart', 'conv_1', 'old_houses_1', 'eatery_1', 'local_clinic_1', 'hardware_store_1', 'neighborhood_park_1']);

function finalize(def: LocationDef): LocationDef {
  // 먼 원정지는 지도 가장자리, 이동 시간도 정해 둔 대로
  if (def.far) {
    def.area = '도시 밖';
    return def;
  }
  def.pos = claimBuilding(def.district as D, def.size, def.id, NEAR_BASE.has(def.id));
  def.area = nearestArea(def.pos);
  // 이동 시간: 거점과의 거리 (도보)
  def.travel = Math.round(12 + distanceFromBase(def.pos) * 0.42);
  return def;
}

function buildLocations(): LocationDef[] {
  const out: LocationDef[] = HANDCRAFTED.map(finalize);
  const usedNames = new Set(out.map((l) => l.name));
  for (const dist of DISTRICTS) {
    for (const t of dist.types) {
      const n = t.count ?? 1;
      for (let k = 0; k < n; k++) {
        const def: LocationDef = finalize({
          id: n > 1 ? `${t.id}_${k + 1}` : t.id,
          name: t.name,
          icon: t.icon,
          desc: t.desc ?? dist.desc,
          danger: t.danger,
          travel: 0,
          pos: { x: 0, y: 0 },
          startDiscovered: !dist.hidden,
          district: dist.id,
          kind: t.name,
          size: t.size,
          requires: t.requires,
          zones: t.zones(),
        });
        let name = `${def.area} ${t.name}`;
        for (let j = 2; usedNames.has(name); j++) name = `${def.area} ${t.name} ${j}`;
        usedNames.add(name);
        def.name = name;
        out.push(def);
      }
    }
  }
  return out;
}

/** 콘텐츠팩 파밍: 장소 종류에 맞는 물건을 수색 지점마다 몇 개씩 더한다 (모두에게 같은 결과가 나오도록 고정 난수) */
const hash = (t: string) => {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** 아이템 희귀도 (순환 참조를 피하려고 데이터에서 직접) */
const ITEMS_RARITY: Record<string, number> = Object.fromEntries(PACK_ITEMS.map((i) => [i.id, i.rarity ?? 1]));

/** 제작에 꼭 필요한 도구·재료: 여러 곳에서 넉넉히 나온다 */
const ESSENTIAL = new Set(['pan_empty', 'pot_empty', 'cooking_pot', 'thread', 'medical_gloves', 'scissors', 'sewing_kit', 'glasses', 'gas_mask', 'alcohol_pad', 'salt', 'cooking_oil', 'egg', 'flour', 'jar_empty', 'bag_empty', 'charcoal', 'paper', 'winter_coat', 'mask_filter', 'scarf']);

function addPackLoot(list: LocationDef[]): LocationDef[] {
  for (const def of list) {
    const text = `${def.kind} ${def.name}`;
    const places = PLACE_RX.filter(([, rx]) => rx.test(text)).map(([p]) => p).slice(0, 3);
    if (!places.length) places.push('주택가');
    const pool = places.flatMap((p) => PLACE_LOOT[p] ?? []);
    if (!pool.length) continue;
    for (const z of def.zones)
      for (const sp of z.spots) {
        sp.loot = [...sp.loot]; // 여러 지점이 같은 목록을 함께 쓰므로 복사
        let h = hash(def.id + '/' + z.id + '/' + sp.id);
        const n = def.far ? 6 : 4;
        for (let k = 0, tries = 0; k < n && tries < 20; tries++) {
          h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
          const e = pool[h % pool.length];
          if (sp.loot.some((x) => x.itemId === e.itemId)) continue;
          sp.loot.push({ ...e });
          k++;
        }
      }
  }
  // 운이 나빠 거의 안 뽑힌 물건은 어울리는 장소에 더 깔아 둔다 (흔한 것 12곳 · 드문 것 7곳 · 귀한 것 4곳 이상)
  const spotsOf = new Map<string, number>();
  for (const def of list) for (const z of def.zones) for (const sp of z.spots) for (const e of sp.loot) spotsOf.set(e.itemId, (spotsOf.get(e.itemId) ?? 0) + 1);
  const candidates = new Map<string, { sp: SpotDef; key: string }[]>();
  const proto = new Map<string, LootEntry>();
  for (const def of list) {
    if (def.temporary) continue;
    const text = `${def.kind} ${def.name}`;
    const places = PLACE_RX.filter(([, rx]) => rx.test(text)).map(([p]) => p).slice(0, 3);
    if (!places.length) places.push('주택가');
    const ids = new Map<string, LootEntry>();
    for (const p of places) for (const e of PLACE_LOOT[p] ?? []) ids.set(e.itemId, e);
    for (const z of def.zones)
      for (const sp of z.spots)
        for (const [id, e] of ids) {
          proto.set(id, e);
          let arr = candidates.get(id);
          if (!arr) candidates.set(id, (arr = []));
          arr.push({ sp, key: def.id + '/' + z.id + '/' + sp.id });
        }
  }
  for (const [id, arr] of candidates) {
    const rar = ITEMS_RARITY[id] ?? 1;
    const need = ESSENTIAL.has(id) ? 30 : rar >= 3 ? 4 : rar === 2 ? 7 : 12;
    let have = spotsOf.get(id) ?? 0;
    if (have >= need) continue;
    const order = arr.map((c) => ({ c, h: hash(c.key + '#' + id) })).sort((a, b) => a.h - b.h);
    for (const { c } of order) {
      if (have >= need) break;
      if (c.sp.loot.some((x) => x.itemId === id)) continue;
      c.sp.loot.push({ ...proto.get(id)!, w: Math.max(2, proto.get(id)!.w) });
      have++;
    }
  }
  return list;
}

export const LOCATIONS: LocationDef[] = addPackLoot(buildLocations());
export const LOCATION_BY_ID: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
