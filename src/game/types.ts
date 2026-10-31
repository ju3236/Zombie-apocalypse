// ───────────── 공통 타입 정의 ─────────────

export type SkillId =
  | 'melee'
  | 'firearm'
  | 'scavenge'
  | 'stealth'
  | 'crafting'
  | 'cooking'
  | 'medical'
  | 'farming';

export type ItemCategory =
  | 'food'
  | 'drink'
  | 'medical'
  | 'weapon'
  | 'tool'
  | 'material'
  | 'furniture'
  | 'prop'
  | 'backpack'
  | 'rare';

/** 인벤토리 한 칸. 내구도가 있는 물건은 항상 qty 1 로 따로 보관된다. */
export interface ItemStack {
  uid: string;
  itemId: string;
  qty: number;
  durability?: number;
}

export type InjuryType = 'scratch' | 'laceration' | 'bite';

export interface Injury {
  id: string;
  type: InjuryType;
  bandaged: boolean;
  /** 붕대를 감은 뒤 회복까지 남은 게임 시간(시간) */
  healHours: number;
}

export interface Appearance {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
}

export interface Relation {
  targetId: string;
  /** 오너가 직접 적는 관계 설명. 시스템은 관계를 자동으로 바꾸지 않는다. */
  text: string;
}

export type CharacterStatus = 'base' | 'expedition' | 'down' | 'dead';

export type BaseTask = 'free' | 'rest' | 'farm' | 'water' | 'guard' | 'workshop';

export interface Character {
  id: string;
  name: string;
  owner: string;
  job: string;
  age: string;
  bio: string;
  appearance: Appearance;
  health: number; // 0~100
  hunger: number; // 포만감 100=배부름
  thirst: number; // 수분 100=충분
  energy: number; // 기력 100=쌩쌩
  infection: number; // 0~100
  injuries: Injury[];
  skills: Record<SkillId, number>; // 경험치
  weapon: ItemStack | null;
  backpack: ItemStack | null;
  inventory: ItemStack[];
  status: CharacterStatus;
  permadeathAllowed: boolean;
  relations: Relation[];
  journal: string;
  task: BaseTask;
  /** 거점 내 위치(타일) */
  pos: { x: number; y: number };
  createdAt: number;
  stats: { expeditions: number; kills: number; crafted: number };
}

// ───────────── 거점 ─────────────

export interface PlacedFurniture {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
  ownerId?: string;
  /** 위에 올려둔 소품 / 진열품 (아이템 id) */
  props: string[];
  /** 생산 시설 상태 */
  prod?: {
    lastTick: number; // 실제 시간(ms)
    progress: number; // 0~1
    stored: number;
    planted?: boolean;
  };
}

export interface BaseState {
  width: number;
  height: number;
  /** 바닥 종류 id. '' 는 바깥 흙/풀 */
  floor: string[];
  /** 벽 종류 id. '' 는 벽 없음. 'door_*' 는 문 */
  walls: string[];
  furniture: PlacedFurniture[];
  /** 거점 확장 레벨 (확장 가능 영역) */
  claimed: { x0: number; y0: number; x1: number; y1: number };
}

// ───────────── 탐험 ─────────────

export interface SpotState {
  remaining: number;
  searched: number;
}

export interface ZoneState {
  unlocked: boolean;
  spots: Record<string, SpotState>;
  secretFound: boolean;
}

export interface LocationState {
  discovered: boolean;
  visits: number;
  zones: Record<string, ZoneState>;
  notes: string[];
  /** 일시적 장소(보급 투하)의 만료 게임시간 */
  expiresAt?: number;
}

export interface Zombie {
  id: string;
  hp: number;
  maxHp: number;
  kind: 'walker' | 'runner' | 'bloated';
  staggered: boolean;
}

export interface Encounter {
  zombies: Zombie[];
  engaged: boolean; // 아직 들키지 않았으면 false (숨기 가능)
}

export interface FoundLoot {
  spotId: string;
  items: ItemStack[];
}

export interface Expedition {
  characterId: string;
  locationId: string;
  zoneId: string;
  noise: number;
  encounter: Encounter | null;
  found: FoundLoot | null;
  log: { t: number; text: string; kind?: 'good' | 'bad' | 'info' }[];
  startedAt: number;
}

// ───────────── 역극 ─────────────

export type RpKind = 'say' | 'action' | 'ooc' | 'system' | 'letter';

export interface RpMessage {
  id: string;
  t: number; // 게임 시간
  real: number; // 실제 시간
  kind: RpKind;
  characterId?: string;
  targetId?: string;
  owner: string;
  text: string;
}

// ───────────── 전체 상태 ─────────────

export interface NewsItem {
  t: number;
  text: string;
  kind?: 'good' | 'bad' | 'info';
}

export interface GameState {
  version: number;
  worldName: string;
  createdAt: number;
  lastRealTime: number;
  /** 게임 시간(분) */
  time: number;
  players: string[];
  characters: Record<string, Character>;
  characterOrder: string[];
  storage: ItemStack[];
  base: BaseState;
  locations: Record<string, LocationState>;
  expeditions: Record<string, Expedition>;
  rpLog: RpMessage[];
  news: NewsItem[];
  settings: {
    autoConsume: boolean;
  };
}
